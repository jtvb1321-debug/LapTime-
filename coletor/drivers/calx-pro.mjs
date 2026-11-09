import { execFile } from "node:child_process";
import dgram from "node:dgram";
import { appendFileSync, createWriteStream, existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarAnalisador } from "./linhas-tcp.mjs";

// Driver do decoder CalX Pro (Sisecom / LapTime).
//
// O CalX Pro tem um conversor serial→rede (módulo Eport-EP20) e envia as
// passagens em texto na porta TCP 5100 (veja criarAnalisadorCalx). O driver
// conecta, lê as passagens, converte o tempo do decoder em hora real e as
// envia ao Grid Lap. Por segurança também grava os bytes recebidos em
// agente/capturas/calx-*.log ("gravar": false desliga).
//
// config.json:
//   "driver": "calx-pro",
//   "modo": "cliente",      // cliente: o PC conecta no decoder (host + porta)
//                           // servidor: o decoder conecta no PC (portaEscuta)
//                           // udp: o decoder manda pacotes UDP (portaUdp)
//   "host": "192.168.137.50", "porta": 5100,
//   "mac": "34:ea:e7:57:78:41"   // opcional: acha o IP pelo MAC a cada conexão
//                                // (o IP muda quando o decoder pega outro DHCP)
//   "portaEscuta": 5000,
//   "portaUdp": 5000,
//   "formato": "...",  "unidadeTempo": "ms"   // opcional: troca o leitor CalX por uma regex
//   "gravar": true                            // padrão true (bytes brutos em capturas/)
//   "registrarPassagens": true                // padrão true (planilha em passagens/AAAA-MM-DD.csv)
//   "janelaDuplicadaMs": 3000                 // leituras do mesmo transponder mais próximas são ignoradas

// No executável do agente (pacote CJS) import.meta.url não existe: usa a pasta
// de trabalho. O agente sempre informa pastaCapturas/pastaPassagens.
function pastaDoDriver() {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return path.join(process.cwd(), "drivers");
  }
}

const PASTA_PADRAO = path.join(pastaDoDriver(), "..", "capturas");

// ---------------------------------------------------------------------------
// Protocolo do CalX Pro (confirmado em captura real, porta TCP 5100):
// uma mensagem por linha, campos separados por TAB, começa com SOH (0x01) e
// termina em CR LF. O último campo é sempre "xCALXPRO".
//
//   SOH @ <decoder> <seq> <transponder> <tempo s> <leituras> <força> <estado> xCALXPRO   passagem
//   SOH $ <decoder> <seq> <ruído> <0> xCALXPRO                                           sinal de vida (~4,7 s)
//
// <tempo> é em segundos desde que o decoder ligou (ex.: 89.206). Para virar
// hora real guardamos a diferença "hora do PC na chegada − tempo do decoder";
// a menor diferença vista é a que tem menos atraso de rede. Se o tempo do
// decoder voltar para trás (ele reiniciou), a referência recomeça.
export function criarAnalisadorCalx() {
  let ancora = null;
  let ultimoTempo = -1;
  return function analisar(linha, recebidoMs = Date.now()) {
    const campos = linha.replace(/^[\x00-\x1f]+/, "").replace(/[\r\n]+$/, "").split("\t");
    const tipo = campos[0];
    if (tipo === "$") {
      return { tipo: "status", decoder: campos[1], seq: campos[2], ruido: Number(campos[3]) };
    }
    if (tipo !== "@" || campos.length < 8) return null;
    const [, decoder, seq, transponder, tempoTxt, leituras, forca, estado] = campos;
    const tempo = Number(tempoTxt);
    if (!/^\d+$/.test(transponder) || !Number.isFinite(tempo)) return null;
    if (tempo < ultimoTempo - 1) ancora = null; // decoder reiniciou
    ultimoTempo = tempo;
    const diferenca = recebidoMs - tempo * 1000;
    if (ancora === null || diferenca < ancora) ancora = diferenca;
    return {
      tipo: "passagem",
      decoder,
      seq,
      tempo,
      leituras: Number(leituras),
      estado,
      passagem: {
        transponder,
        instanteMs: Math.round(ancora + tempo * 1000),
        forca: Number(forca),
        eventoExterno: `calx-${decoder}-${seq}-${tempoTxt}`,
        bruto: `@ ${decoder} ${seq} ${transponder} ${tempoTxt} leituras=${leituras} forca=${forca} estado=${estado}`,
      },
    };
  };
}

function criarGravador(config, ctx, rotulo) {
  if (config.gravar === false) return { escrever() {}, fechar() {} };
  const pasta = config.pastaCapturas ?? PASTA_PADRAO;
  mkdirSync(pasta, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  const arquivo = path.join(pasta, `calx-${rotulo.replace(/[^\w.-]/g, "_")}-${carimbo}.log`);
  const saida = createWriteStream(arquivo, { flags: "a" });
  ctx.log(`gravando tudo o que chegar em ${arquivo}`);
  return {
    escrever(origem, pedaco) {
      const texto = pedaco.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
      saida.write(`${new Date().toISOString()}\t${origem}\t${pedaco.length}\t${pedaco.toString("hex")}\t${texto}\n`);
    },
    fechar() {
      saida.end();
    },
  };
}

const PASTA_PASSAGENS = path.join(pastaDoDriver(), "..", "passagens");

// Registro local de todas as passagens lidas (uma planilha CSV por dia em
// agente/passagens/AAAA-MM-DD.csv), inclusive as leituras duplas ignoradas.
// Serve de conferência e de cópia de segurança do que foi enviado ao sistema.
function criarRegistro(config) {
  if (config.registrarPassagens === false) return () => {};
  const pasta = config.pastaPassagens ?? PASTA_PASSAGENS;
  mkdirSync(pasta, { recursive: true });
  return (r, situacao) => {
    const d = new Date(r.passagem.instanteMs);
    const dois = (n) => String(n).padStart(2, "0");
    const dia = `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
    const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
    const arquivo = path.join(pasta, `${dia}.csv`);
    const novo = !existsSync(arquivo);
    const linha = [dia, hora, r.passagem.transponder, r.tempo.toFixed(3), r.leituras, r.passagem.forca, r.estado, r.decoder, r.seq, situacao].join(";");
    try {
      appendFileSync(arquivo, (novo ? "data;hora;transponder;tempo_decoder_s;leituras;forca;estado;decoder;seq;situacao\r\n" : "") + linha + "\r\n");
    } catch {
      // planilha aberta no Excel, por exemplo: não pode travar a leitura
    }
  };
}

// Transforma o fluxo de bytes em passagens: protocolo CalX (padrão) ou, se
// houver "formato" no config, a regex de texto do driver linhas-tcp.
//
// Leitura dupla: a antena às vezes lê o mesmo transponder 2 vezes na mesma
// passagem (visto na captura: 727855 em 147,245 s e 147,391 s). Leituras do
// mesmo transponder dentro de "janelaDuplicadaMs" (padrão 3000) são ignoradas.
export function criarLeitor(config, ctx) {
  const analisarTexto = config.formato ? criarAnalisador(config) : null;
  const analisarCalx = criarAnalisadorCalx();
  const registrar = criarRegistro(config);
  const janela = Number(config.janelaDuplicadaMs ?? 3000) / 1000;
  const ultimaPorTransponder = new Map();
  let texto = "";
  let avisouStatus = false;
  // Informações mostradas na tela do sistema (ruído da antena, última leitura).
  const info = {};
  return function ler(pedaco) {
    texto += pedaco.toString("latin1");
    if (texto.length > 65_536) texto = texto.slice(-4096);
    const linhas = texto.split(/\r?\n|\r/);
    texto = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.trim()) continue;
      if (analisarTexto) {
        const p = analisarTexto(linha);
        if (p) ctx.emitir(p);
        continue;
      }
      const r = analisarCalx(linha);
      if (r?.tipo === "passagem") {
        const anterior = ultimaPorTransponder.get(r.passagem.transponder);
        if (anterior !== undefined && r.tempo >= anterior && r.tempo - anterior < janela) {
          registrar(r, "leitura dupla ignorada");
          ctx.log(`leitura dupla ignorada: transponder ${r.passagem.transponder} (+${Math.round((r.tempo - anterior) * 1000)} ms)`);
          continue;
        }
        ultimaPorTransponder.set(r.passagem.transponder, r.tempo);
        registrar(r, "enviada");
        ctx.emitir(r.passagem);
        info.ultimaPassagem = r.passagem.transponder;
        ctx.info?.({ ...info });
        ctx.log(`passagem: transponder ${r.passagem.transponder} força ${r.passagem.forca}`);
      } else if (r?.tipo === "status") {
        info.decoder = r.decoder;
        if (Number.isFinite(r.ruido)) info.ruido = r.ruido;
        ctx.info?.({ ...info });
        if (!avisouStatus) {
          avisouStatus = true;
          ctx.log(`decoder ${r.decoder} respondendo (ruído da antena ${r.ruido}).`);
        }
      }
    }
  };
}

export const driver = {
  id: "calx-pro",
  nome: "CalX Pro (Sisecom / LapTime)",
  portasComuns: [5100],

  reconhece(bytes, config) {
    if (bytes.includes("xCALXPRO")) return true;
    if (!config?.formato) return false;
    const analisar = criarAnalisador(config);
    return bytes
      .toString("latin1")
      .split(/\r?\n|\r/)
      .some((linha) => analisar(linha) !== null);
  },

  async iniciar(config, ctx) {
    const modo = config.modo ?? "cliente";
    if (modo === "servidor") return iniciarServidor(config, ctx);
    if (modo === "udp") return iniciarUdp(config, ctx);
    if (modo !== "cliente") throw new Error(`calx-pro: modo "${modo}" inválido (cliente, servidor ou udp).`);
    if ((!config.host && !config.mac) || !config.porta) throw new Error('calx-pro: no modo cliente informe "porta" e "host" (ou "mac").');
    return iniciarCliente(config, ctx);
  },
};

function lerArp() {
  return new Promise((resolve) => {
    execFile("arp", ["-a"], { windowsHide: true, timeout: 5000 }, (e, saida) => {
      const lista = [];
      for (const m of String(saida ?? "").matchAll(/(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}(?:[-:][0-9a-f]{2}){5})/gi)) {
        lista.push({ ip: m[1], mac: m[2].toLowerCase().replaceAll("-", ":") });
      }
      resolve(lista);
    });
  });
}

function cutucar(ip) {
  return new Promise((resolve) => {
    const s = net.connect({ host: ip, port: 9 });
    const fim = () => {
      s.destroy();
      resolve();
    };
    s.setTimeout(500, fim);
    s.on("error", fim);
    s.on("connect", fim);
  });
}

// Descobre o IP atual do decoder pelo MAC (tabela ARP; se não estiver lá,
// "cutuca" as faixas /24 das placas com cabo para o Windows aprender).
async function ipPorMac(mac, ctx) {
  const alvo = mac.toLowerCase().replaceAll("-", ":");
  let achado = (await lerArp()).find((v) => v.mac === alvo);
  if (achado) return achado.ip;
  for (const ends of Object.values(os.networkInterfaces())) {
    for (const e of ends ?? []) {
      if (e.family !== "IPv4" || e.internal || e.netmask !== "255.255.255.0" || e.address.startsWith("169.254.")) continue;
      const base = e.address.split(".").slice(0, 3).join(".");
      ctx.log(`procurando o decoder (MAC ${alvo}) em ${base}.0/24…`);
      await Promise.all(Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`).map(cutucar));
    }
  }
  achado = (await lerArp()).find((v) => v.mac === alvo);
  return achado?.ip ?? null;
}

function iniciarCliente(config, ctx) {
  const gravador = criarGravador(config, ctx, `${config.mac ? "calx" : config.host}-${config.porta}`);
  let parado = false;
  let socket = null;
  let espera = 2000;
  let host = config.host;

  const conectar = async () => {
    if (parado) return;
    if (config.mac) {
      const ip = await ipPorMac(config.mac, ctx);
      if (parado) return;
      if (!ip) {
        ctx.conectado(false);
        ctx.erro?.(`decoder (MAC ${config.mac}) não encontrado na rede`);
        ctx.log(`decoder não encontrado; nova tentativa em ${espera / 1000}s.`);
        setTimeout(conectar, espera);
        espera = Math.min(espera * 2, 30_000);
        return;
      }
      if (ip !== host) ctx.log(`decoder está em ${ip}`);
      host = ip;
    }
    ctx.log(`conectando em ${host}:${config.porta}…`);
    const ler = criarLeitor(config, ctx);
    socket = net.connect({ host, port: config.porta });
    socket.setKeepAlive(true, 10_000);
    socket.on("connect", () => {
      espera = 2000;
      ctx.conectado(true);
      ctx.log("conectado ao CalX Pro.");
    });
    socket.on("data", (pedaco) => {
      gravador.escrever(`${host}:${config.porta}`, pedaco);
      ler(pedaco);
    });
    socket.on("error", (e) => {
      ctx.log(`erro de conexão: ${e.message}`);
      ctx.erro?.(`${host}:${config.porta}: ${e.message}`);
    });
    socket.on("close", () => {
      ctx.conectado(false);
      if (parado) return;
      ctx.log(`conexão encerrada; nova tentativa em ${espera / 1000}s.`);
      setTimeout(conectar, espera);
      espera = Math.min(espera * 2, 30_000);
    });
  };

  conectar();
  return {
    parar() {
      parado = true;
      socket?.destroy();
      gravador.fechar();
    },
  };
}

function iniciarServidor(config, ctx) {
  const porta = Number(config.portaEscuta ?? config.porta);
  if (!porta) throw new Error('calx-pro: no modo servidor informe "portaEscuta".');
  const gravador = criarGravador(config, ctx, `escuta-${porta}`);
  const conexoes = new Set();
  const servidor = net.createServer((socket) => {
    const origem = `${socket.remoteAddress}:${socket.remotePort}`;
    const ler = criarLeitor(config, ctx);
    conexoes.add(socket);
    ctx.conectado(true);
    ctx.log(`decoder conectou: ${origem}`);
    socket.on("data", (pedaco) => {
      gravador.escrever(origem, pedaco);
      ler(pedaco);
    });
    socket.on("error", (e) => ctx.log(`erro com ${origem}: ${e.message}`));
    socket.on("close", () => {
      conexoes.delete(socket);
      ctx.log(`decoder desconectou: ${origem}`);
      if (conexoes.size === 0) ctx.conectado(false);
    });
  });
  servidor.on("error", (e) => {
    ctx.log(`erro ao escutar a porta ${porta}: ${e.message}`);
    ctx.erro?.(`escuta ${porta}: ${e.message}`);
  });
  servidor.listen(porta, "0.0.0.0", () => ctx.log(`esperando o decoder conectar na porta TCP ${porta}.`));
  return {
    parar() {
      for (const s of conexoes) s.destroy();
      servidor.close();
      gravador.fechar();
    },
  };
}

function iniciarUdp(config, ctx) {
  const porta = Number(config.portaUdp ?? config.porta);
  if (!porta) throw new Error('calx-pro: no modo udp informe "portaUdp".');
  const gravador = criarGravador(config, ctx, `udp-${porta}`);
  const ler = criarLeitor(config, ctx);
  let ultimo = 0;
  const vigia = setInterval(() => {
    if (ultimo && Date.now() - ultimo > 60_000) {
      ultimo = 0;
      ctx.conectado(false);
    }
  }, 10_000);
  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
  sock.on("message", (pedaco, info) => {
    if (!ultimo) ctx.conectado(true);
    ultimo = Date.now();
    gravador.escrever(`${info.address}:${info.port}/udp`, pedaco);
    ler(pedaco);
  });
  sock.on("error", (e) => {
    ctx.log(`erro UDP ${porta}: ${e.message}`);
    ctx.erro?.(`udp ${porta}: ${e.message}`);
  });
  sock.bind(porta, () => ctx.log(`escutando UDP na porta ${porta}.`));
  return {
    parar() {
      clearInterval(vigia);
      sock.close();
      gravador.fechar();
    },
  };
}
