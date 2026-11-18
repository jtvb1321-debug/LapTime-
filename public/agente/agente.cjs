"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// coletor/agente-instalado.mjs
var import_node_child_process4 = require("node:child_process");
var import_node_fs6 = require("node:fs");
var import_node_path4 = __toESM(require("node:path"), 1);

// coletor/agente-nucleo.mjs
var import_node_fs5 = require("node:fs");
var import_node_os3 = __toESM(require("node:os"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var import_promises = require("node:readline/promises");

// coletor/calx-automatico.mjs
var import_node_fs3 = require("node:fs");
var import_node_net3 = __toESM(require("node:net"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);

// coletor/descoberta.mjs
var import_node_child_process = require("node:child_process");
var import_node_net = __toESM(require("node:net"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var IGNORAR_MAC = /^(ff[-:]ff[-:]ff[-:]ff[-:]ff[-:]ff|01[-:]00[-:]5e)/i;
function lerTabelaArp(texto) {
  const achados = [];
  const re = /(\d{1,3}(?:\.\d{1,3}){3})\D+?([0-9a-f]{2}([-:])[0-9a-f]{2}(?:\3[0-9a-f]{2}){4})/gi;
  for (const m of texto.matchAll(re)) {
    const [, ip, mac] = m;
    const primeiro = Number(ip.split(".")[0]);
    if (primeiro >= 224 || IGNORAR_MAC.test(mac)) continue;
    achados.push({ ip, mac: mac.toLowerCase().replaceAll("-", ":") });
  }
  return achados;
}
function listarVizinhos() {
  return new Promise((resolve) => {
    (0, import_node_child_process.execFile)("arp", ["-a"], { timeout: 5e3 }, (erro, saida) => {
      resolve(erro ? [] : lerTabelaArp(String(saida)));
    });
  });
}
function interfacesLocais() {
  const lista = [];
  for (const [nome, enderecos] of Object.entries(import_node_os.default.networkInterfaces())) {
    for (const e of enderecos ?? []) {
      if (e.family !== "IPv4" || e.internal) continue;
      lista.push({ nome, ip: e.address, mascara: e.netmask, cidr: e.cidr });
    }
  }
  return lista;
}
function ipParaNumero(ip) {
  return ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
}
function numeroParaIp(n) {
  return [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join(".");
}
function hostsDaFaixa(cidr) {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(cidr.trim());
  if (!m)
    throw new Error(`Faixa inv\xE1lida: ${cidr} (use o formato 192.168.1.0/24).`);
  const bits = Number(m[2]);
  if (bits < 22 || bits > 30) {
    throw new Error("Use uma faixa entre /22 e /30.");
  }
  const tamanho = 2 ** (32 - bits);
  const rede = Math.floor(ipParaNumero(m[1]) / tamanho) * tamanho;
  const hosts = [];
  for (let i = 1; i < tamanho - 1; i++) hosts.push(numeroParaIp(rede + i));
  return hosts;
}
function espiar(host, porta, { timeoutMs = 400, escutaMs = 1500 } = {}) {
  return new Promise((resolve) => {
    const pedacos = [];
    let abriu = false;
    const socket = import_node_net.default.connect({ host, port: porta });
    const terminar = () => {
      clearTimeout(limite);
      socket.destroy();
      resolve({ abriu, bytes: Buffer.concat(pedacos).subarray(0, 512) });
    };
    const limite = setTimeout(terminar, timeoutMs);
    socket.on("connect", () => {
      abriu = true;
      clearTimeout(limite);
      setTimeout(terminar, escutaMs);
    });
    socket.on("data", (d) => pedacos.push(d));
    socket.on("error", terminar);
  });
}
async function varrer({
  hosts,
  portas,
  concorrencia = 48,
  timeoutMs = 400,
  escutaMs = 1500,
  reconhecer,
  aoAchar
}) {
  const alvos = hosts.flatMap(
    (host) => portas.map((porta) => ({ host, porta }))
  );
  const achados = [];
  let proximo = 0;
  async function trabalhador() {
    while (proximo < alvos.length) {
      const { host, porta } = alvos[proximo++];
      const { abriu, bytes } = await espiar(host, porta, {
        timeoutMs,
        escutaMs
      });
      if (!abriu) continue;
      const driver2 = reconhecer ? reconhecer(bytes, host, porta) : null;
      const achado = { host, porta, bytes, driver: driver2?.id ?? null };
      achados.push(achado);
      aoAchar?.(achado);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concorrencia, alvos.length) }, trabalhador)
  );
  return achados;
}
var MAC_DECODER_CALX = "34:ea:e7:57:78:41";
var FAIXA_PADRAO_DECODER = "192.168.137.0/24";
var ultimaBusca = 0;
async function acordarFaixasDoDecoder() {
  if (Date.now() - ultimaBusca < 3e4) return false;
  ultimaBusca = Date.now();
  const faixas = (process.env.GRIDLAP_FAIXAS_DECODER || FAIXA_PADRAO_DECODER).split(",").map((f) => f.trim()).filter(Boolean);
  const locais = interfacesLocais().map((i) => i.ip);
  let acordou = false;
  for (const faixa of faixas) {
    let hosts;
    try {
      hosts = hostsDaFaixa(faixa);
    } catch {
      continue;
    }
    const base = faixa.split("/")[0].split(".").slice(0, 3).join(".");
    if (!locais.some((ip) => ip.startsWith(`${base}.`))) continue;
    await varrer({
      hosts: hosts.filter((h) => !locais.includes(h)),
      portas: [9],
      concorrencia: 128,
      timeoutMs: 600,
      escutaMs: 0
    });
    acordou = true;
  }
  return acordou;
}

// coletor/drivers/calx-pro.mjs
var import_node_child_process2 = require("node:child_process");
var import_node_dgram = __toESM(require("node:dgram"), 1);
var import_node_fs = require("node:fs");
var import_node_net2 = __toESM(require("node:net"), 1);
var import_node_os2 = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_url = require("node:url");

// coletor/drivers/tempo.mjs
function converterTempo(valor, unidade, agora = Date.now()) {
  const v = String(valor).trim();
  switch (unidade) {
    case "ms": {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "s": {
      const n = Number(v);
      return Number.isFinite(n) ? n * 1e3 : null;
    }
    case "us": {
      const n = Number(v);
      return Number.isFinite(n) ? n / 1e3 : null;
    }
    case "iso": {
      const t = Date.parse(v);
      return Number.isNaN(t) ? null : t;
    }
    case "hhmmss": {
      const m = /^(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?$/.exec(v);
      if (!m) return null;
      const d = new Date(agora);
      const milis = m[4] ? Math.round(Number(`0.${m[4]}`) * 1e3) : 0;
      d.setHours(Number(m[1]), Number(m[2]), Number(m[3]), milis);
      let t = d.getTime();
      if (t > agora + 6e4) t -= 864e5;
      return t;
    }
    default:
      return null;
  }
}

// coletor/drivers/linhas-tcp.mjs
function criarAnalisador(config) {
  if (!config.formato) {
    throw new Error(
      'linhas-tcp: informe "formato" (express\xE3o regular com o grupo nomeado transponder).'
    );
  }
  if (!config.formato.includes("(?<transponder>")) {
    throw new Error(
      'linhas-tcp: "formato" precisa ter o grupo (?<transponder>...).'
    );
  }
  const re = new RegExp(config.formato);
  const unidade = config.unidadeTempo ?? "ms";
  return function analisar(linha) {
    const m = re.exec(linha);
    const g = m?.groups;
    if (!g?.transponder) return null;
    const passagem = { transponder: g.transponder, bruto: linha.slice(0, 400) };
    if (g.tempo !== void 0) {
      const t = converterTempo(g.tempo, unidade);
      if (t !== null) passagem.instanteMs = t;
    }
    if (g.forca !== void 0 && /^\d+$/.test(g.forca)) {
      passagem.forca = Number(g.forca);
    }
    return passagem;
  };
}

// coletor/drivers/calx-pro.mjs
var import_meta = {};
function pastaDoDriver() {
  try {
    return import_node_path.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url));
  } catch {
    return import_node_path.default.join(process.cwd(), "drivers");
  }
}
var PASTA_PADRAO = import_node_path.default.join(pastaDoDriver(), "..", "capturas");
function criarAnalisadorCalx() {
  let ancora = null;
  let ultimoTempo = -1;
  return function analisar(linha, recebidoMs = Date.now()) {
    const campos = linha.replace(/^[\x00-\x1f]+/, "").replace(/[\r\n]+$/, "").split("	");
    const tipo = campos[0];
    if (tipo === "$") {
      return { tipo: "status", decoder: campos[1], seq: campos[2], ruido: Number(campos[3]) };
    }
    if (tipo !== "@" || campos.length < 8) return null;
    const [, decoder, seq, transponder, tempoTxt, leituras, forca, estado] = campos;
    const tempo = Number(tempoTxt);
    if (!/^\d+$/.test(transponder) || !Number.isFinite(tempo)) return null;
    if (tempo < ultimoTempo - 1) ancora = null;
    ultimoTempo = tempo;
    const diferenca = recebidoMs - tempo * 1e3;
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
        instanteMs: Math.round(ancora + tempo * 1e3),
        forca: Number(forca),
        eventoExterno: `calx-${decoder}-${seq}-${tempoTxt}`,
        bruto: `@ ${decoder} ${seq} ${transponder} ${tempoTxt} leituras=${leituras} forca=${forca} estado=${estado}`
      }
    };
  };
}
function criarGravador(config, ctx, rotulo) {
  if (config.gravar === false) return { escrever() {
  }, fechar() {
  } };
  const pasta2 = config.pastaCapturas ?? PASTA_PADRAO;
  (0, import_node_fs.mkdirSync)(pasta2, { recursive: true });
  const carimbo = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const arquivo = import_node_path.default.join(pasta2, `calx-${rotulo.replace(/[^\w.-]/g, "_")}-${carimbo}.log`);
  const saida = (0, import_node_fs.createWriteStream)(arquivo, { flags: "a" });
  ctx.log(`gravando tudo o que chegar em ${arquivo}`);
  return {
    escrever(origem, pedaco) {
      const texto = pedaco.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
      saida.write(`${(/* @__PURE__ */ new Date()).toISOString()}	${origem}	${pedaco.length}	${pedaco.toString("hex")}	${texto}
`);
    },
    fechar() {
      saida.end();
    }
  };
}
var PASTA_PASSAGENS = import_node_path.default.join(pastaDoDriver(), "..", "passagens");
function criarRegistro(config) {
  if (config.registrarPassagens === false) return () => {
  };
  const pasta2 = config.pastaPassagens ?? PASTA_PASSAGENS;
  (0, import_node_fs.mkdirSync)(pasta2, { recursive: true });
  return (r, situacao) => {
    const d = new Date(r.passagem.instanteMs);
    const dois = (n) => String(n).padStart(2, "0");
    const dia = `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
    const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
    const arquivo = import_node_path.default.join(pasta2, `${dia}.csv`);
    const novo = !(0, import_node_fs.existsSync)(arquivo);
    const linha = [dia, hora, r.passagem.transponder, r.tempo.toFixed(3), r.leituras, r.passagem.forca, r.estado, r.decoder, r.seq, situacao].join(";");
    try {
      (0, import_node_fs.appendFileSync)(arquivo, (novo ? "data;hora;transponder;tempo_decoder_s;leituras;forca;estado;decoder;seq;situacao\r\n" : "") + linha + "\r\n");
    } catch {
    }
  };
}
function criarLeitor(config, ctx) {
  const analisarTexto = config.formato ? criarAnalisador(config) : null;
  const analisarCalx = criarAnalisadorCalx();
  const registrar = criarRegistro(config);
  const janela = Number(config.janelaDuplicadaMs ?? 3e3) / 1e3;
  const ultimaPorTransponder = /* @__PURE__ */ new Map();
  let texto = "";
  let avisouStatus = false;
  const info = {};
  return function ler(pedaco) {
    texto += pedaco.toString("latin1");
    if (texto.length > 65536) texto = texto.slice(-4096);
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
        if (anterior !== void 0 && r.tempo >= anterior && r.tempo - anterior < janela) {
          registrar(r, "leitura dupla ignorada");
          ctx.log(`leitura dupla ignorada: transponder ${r.passagem.transponder} (+${Math.round((r.tempo - anterior) * 1e3)} ms)`);
          continue;
        }
        ultimaPorTransponder.set(r.passagem.transponder, r.tempo);
        registrar(r, "enviada");
        ctx.emitir(r.passagem);
        info.ultimaPassagem = r.passagem.transponder;
        ctx.info?.({ ...info });
        ctx.log(`passagem: transponder ${r.passagem.transponder} for\xE7a ${r.passagem.forca}`);
      } else if (r?.tipo === "status") {
        info.decoder = r.decoder;
        if (Number.isFinite(r.ruido)) info.ruido = r.ruido;
        ctx.info?.({ ...info });
        if (!avisouStatus) {
          avisouStatus = true;
          ctx.log(`decoder ${r.decoder} respondendo (ru\xEDdo da antena ${r.ruido}).`);
        }
      }
    }
  };
}
var driver = {
  id: "calx-pro",
  nome: "CalX Pro (Sisecom / LapTime)",
  portasComuns: [5100],
  reconhece(bytes, config) {
    if (bytes.includes("xCALXPRO")) return true;
    if (!config?.formato) return false;
    const analisar = criarAnalisador(config);
    return bytes.toString("latin1").split(/\r?\n|\r/).some((linha) => analisar(linha) !== null);
  },
  async iniciar(config, ctx) {
    const modo = config.modo ?? "cliente";
    if (modo === "servidor") return iniciarServidor(config, ctx);
    if (modo === "udp") return iniciarUdp(config, ctx);
    if (modo !== "cliente") throw new Error(`calx-pro: modo "${modo}" inv\xE1lido (cliente, servidor ou udp).`);
    if (!config.host && !config.mac || !config.porta) throw new Error('calx-pro: no modo cliente informe "porta" e "host" (ou "mac").');
    return iniciarCliente(config, ctx);
  }
};
function lerArp() {
  return new Promise((resolve) => {
    (0, import_node_child_process2.execFile)("arp", ["-a"], { windowsHide: true, timeout: 5e3 }, (e, saida) => {
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
    const s = import_node_net2.default.connect({ host: ip, port: 9 });
    const fim = () => {
      s.destroy();
      resolve();
    };
    s.setTimeout(500, fim);
    s.on("error", fim);
    s.on("connect", fim);
  });
}
function candidatosDoMac(vizinhos, mac) {
  const alvo = mac.toLowerCase().replaceAll("-", ":");
  const ips = [...new Set(vizinhos.filter((v) => v.mac === alvo).map((v) => v.ip))];
  const local = (ip) => ip.startsWith("169.254.");
  return [...ips.filter((ip) => !local(ip)), ...ips.filter(local)];
}
function atende(ip, porta, ms = 2500) {
  return new Promise((resolve) => {
    const s = import_node_net2.default.connect({ host: ip, port: porta });
    const fim = (ok) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(ms, () => fim(false));
    s.on("error", () => fim(false));
    s.on("connect", () => fim(true));
  });
}
async function escolher(candidatos, porta) {
  if (candidatos.length <= 1) return candidatos[0] ?? null;
  for (const ip of candidatos) if (await atende(ip, porta)) return ip;
  return null;
}
async function ipPorMac(mac, ctx, porta = 5100) {
  const alvo = mac.toLowerCase().replaceAll("-", ":");
  let achado = await escolher(candidatosDoMac(await lerArp(), alvo), porta);
  if (achado) return achado;
  for (const ends of Object.values(import_node_os2.default.networkInterfaces())) {
    for (const e of ends ?? []) {
      if (e.family !== "IPv4" || e.internal || e.netmask !== "255.255.255.0" || e.address.startsWith("169.254.")) continue;
      const base = e.address.split(".").slice(0, 3).join(".");
      ctx.log(`procurando o decoder (MAC ${alvo}) em ${base}.0/24\u2026`);
      await Promise.all(Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`).map(cutucar));
    }
  }
  return escolher(candidatosDoMac(await lerArp(), alvo), porta);
}
function iniciarCliente(config, ctx) {
  const gravador = criarGravador(config, ctx, `${config.mac ? "calx" : config.host}-${config.porta}`);
  let parado = false;
  let socket = null;
  let espera = 2e3;
  let host = config.host;
  const conectar = async () => {
    if (parado) return;
    if (config.mac) {
      const ip = await ipPorMac(config.mac, ctx, config.porta);
      if (parado) return;
      if (!ip) {
        ctx.conectado(false);
        ctx.erro?.(`decoder (MAC ${config.mac}) n\xE3o encontrado na rede`);
        ctx.log(`decoder n\xE3o encontrado; nova tentativa em ${espera / 1e3}s.`);
        setTimeout(conectar, espera);
        espera = Math.min(espera * 2, 3e4);
        return;
      }
      if (ip !== host) ctx.log(`decoder est\xE1 em ${ip}`);
      host = ip;
    }
    ctx.log(`conectando em ${host}:${config.porta}\u2026`);
    const ler = criarLeitor(config, ctx);
    socket = import_node_net2.default.connect({ host, port: config.porta });
    socket.setKeepAlive(true, 1e4);
    socket.on("connect", () => {
      espera = 2e3;
      ctx.conectado(true);
      ctx.log("conectado ao CalX Pro.");
    });
    socket.on("data", (pedaco) => {
      gravador.escrever(`${host}:${config.porta}`, pedaco);
      ler(pedaco);
    });
    socket.on("error", (e) => {
      ctx.log(`erro de conex\xE3o: ${e.message}`);
      ctx.erro?.(`${host}:${config.porta}: ${e.message}`);
    });
    socket.on("close", () => {
      ctx.conectado(false);
      if (parado) return;
      ctx.log(`conex\xE3o encerrada; nova tentativa em ${espera / 1e3}s.`);
      setTimeout(conectar, espera);
      espera = Math.min(espera * 2, 3e4);
    });
  };
  conectar();
  return {
    parar() {
      parado = true;
      socket?.destroy();
      gravador.fechar();
    }
  };
}
function iniciarServidor(config, ctx) {
  const porta = Number(config.portaEscuta ?? config.porta);
  if (!porta) throw new Error('calx-pro: no modo servidor informe "portaEscuta".');
  const gravador = criarGravador(config, ctx, `escuta-${porta}`);
  const conexoes = /* @__PURE__ */ new Set();
  const servidor = import_node_net2.default.createServer((socket) => {
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
    }
  };
}
function iniciarUdp(config, ctx) {
  const porta = Number(config.portaUdp ?? config.porta);
  if (!porta) throw new Error('calx-pro: no modo udp informe "portaUdp".');
  const gravador = criarGravador(config, ctx, `udp-${porta}`);
  const ler = criarLeitor(config, ctx);
  let ultimo = 0;
  const vigia = setInterval(() => {
    if (ultimo && Date.now() - ultimo > 6e4) {
      ultimo = 0;
      ctx.conectado(false);
    }
  }, 1e4);
  const sock = import_node_dgram.default.createSocket({ type: "udp4", reuseAddr: true });
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
    }
  };
}

// coletor/envio.mjs
var import_node_fs2 = require("node:fs");
function criarEnvio({
  servidor,
  token,
  arquivoFila = null,
  log,
  tamanhoLote = 100,
  intervaloMs = 500,
  batimentoMs = 1e4,
  esperaInicialMs = 1e3
}) {
  const url = `${servidor.replace(/\/+$/, "")}/api/cronometragem/passagens`;
  let pendentes = [];
  let eventos = [
    { tipo: "coletor_iniciado", detalhe: null, instanteMs: Date.now() }
  ];
  let conectado = false;
  let ultimoErro = null;
  let infoDoDriver = null;
  let enviando = false;
  let ultimoEnvio = 0;
  let espera = 0;
  let proximaTentativa = 0;
  let avisouToken = false;
  if (arquivoFila && (0, import_node_fs2.existsSync)(arquivoFila)) {
    pendentes = (0, import_node_fs2.readFileSync)(arquivoFila, "utf8").split("\n").filter(Boolean).flatMap((linha) => {
      try {
        return [JSON.parse(linha)];
      } catch {
        return [];
      }
    });
    if (pendentes.length) {
      log(`${pendentes.length} passagem(ns) pendente(s) de antes.`);
    }
  }
  function regravarFila() {
    if (!arquivoFila) return;
    if (pendentes.length === 0) {
      if ((0, import_node_fs2.existsSync)(arquivoFila)) (0, import_node_fs2.unlinkSync)(arquivoFila);
      return;
    }
    const temporario = `${arquivoFila}.tmp`;
    (0, import_node_fs2.writeFileSync)(
      temporario,
      pendentes.map((p) => JSON.stringify(p)).join("\n") + "\n"
    );
    (0, import_node_fs2.renameSync)(temporario, arquivoFila);
  }
  function emitir(passagem) {
    const normal = {
      transponder: String(passagem.transponder),
      instanteMs: passagem.instanteMs ?? Date.now(),
      relogio: passagem.instanteMs === void 0 ? "coletor" : "decoder",
      forca: passagem.forca ?? null,
      bruto: passagem.bruto ?? null,
      eventoExterno: passagem.eventoExterno ?? null
    };
    pendentes.push(normal);
    if (arquivoFila) (0, import_node_fs2.appendFileSync)(arquivoFila, JSON.stringify(normal) + "\n");
  }
  function registrarEvento(tipo, detalhe = null) {
    eventos.push({ tipo, detalhe, instanteMs: Date.now() });
    if (eventos.length > 50) eventos = eventos.slice(-50);
  }
  async function enviar(lote, eventosDoLote) {
    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        passagens: lote,
        estado: {
          conectado,
          erro: ultimoErro ?? void 0,
          info: infoDoDriver ?? void 0
        },
        eventos: eventosDoLote
      }),
      signal: AbortSignal.timeout(1e4)
    });
  }
  async function ciclo() {
    if (enviando || Date.now() < proximaTentativa) return;
    const precisaBatimento = Date.now() - ultimoEnvio >= batimentoMs;
    if (pendentes.length === 0 && eventos.length === 0 && !precisaBatimento) {
      return;
    }
    enviando = true;
    const lote = pendentes.slice(0, tamanhoLote);
    const eventosDoLote = eventos.slice();
    try {
      const resposta = await enviar(lote, eventosDoLote);
      if (resposta.ok) {
        const r = await resposta.json().catch(() => ({}));
        pendentes = pendentes.slice(lote.length);
        eventos = eventos.slice(eventosDoLote.length);
        ultimoErro = null;
        regravarFila();
        ultimoEnvio = Date.now();
        espera = 0;
        avisouToken = false;
        if (lote.length) {
          log(
            `enviadas ${lote.length} (novas ${r.gravadas ?? "?"}, repetidas ${r.repetidas ?? "?"}${r.rejeitadas ? `, rejeitadas ${r.rejeitadas}: ${r.motivoRejeicao}` : ""}).`
          );
        }
      } else if (resposta.status === 401) {
        if (!avisouToken) {
          log("token recusado pelo sistema \u2014 confira o token do decoder.");
        }
        avisouToken = true;
        espera = 3e4;
      } else if (resposta.status === 400 || resposta.status === 413) {
        const r = await resposta.json().catch(() => ({}));
        log(
          `lote recusado (${resposta.status}): ${r.erro ?? "sem detalhe"}; descartado.`
        );
        pendentes = pendentes.slice(lote.length);
        eventos = eventos.slice(eventosDoLote.length);
        regravarFila();
      } else {
        throw new Error(`HTTP ${resposta.status}`);
      }
    } catch (erro) {
      espera = Math.min((espera || esperaInicialMs) * 2, 3e4);
      log(
        `sem conex\xE3o com o sistema (${erro.message}); tentando de novo em ${espera / 1e3}s.`
      );
    } finally {
      proximaTentativa = Date.now() + espera;
      enviando = false;
    }
  }
  const timer = setInterval(ciclo, intervaloMs);
  return {
    emitir,
    // O driver avisa quando a ligação com o decoder sobe ou cai.
    conectado(valor) {
      const novo = Boolean(valor);
      if (novo !== conectado) {
        registrarEvento(novo ? "conectado" : "desconectado");
      }
      conectado = novo;
    },
    // ...e quando acontece um erro de comunicação.
    erro(mensagem) {
      ultimoErro = String(mensagem).slice(0, 300);
      registrarEvento("erro", ultimoErro);
    },
    // Informações extras do driver (ex.: ruído da antena), mostradas na tela.
    info(valor) {
      infoDoDriver = valor;
    },
    pendentes: () => pendentes.length,
    async parar() {
      clearInterval(timer);
      for (let i = 0; i < 5 && pendentes.length; i++) {
        proximaTentativa = 0;
        await ciclo();
      }
      if (pendentes.length) {
        log(
          `${pendentes.length} passagem(ns) ficaram na fila para o pr\xF3ximo in\xEDcio.`
        );
      }
    }
  };
}

// coletor/calx-automatico.mjs
var PORTA_CALX = 5100;
var MARCA = "xCALXPRO";
var FAIXA_PADRAO = "192.168.137.0/24";
var ESCUTA_MS = 6e3;
function sondarCalx(host, porta = PORTA_CALX, ms = ESCUTA_MS) {
  return new Promise((resolve) => {
    let texto = "";
    let fim = false;
    const s = import_node_net3.default.connect({ host, port: porta });
    const terminar = (ok) => {
      if (fim) return;
      fim = true;
      clearTimeout(t);
      s.destroy();
      resolve(ok);
    };
    const t = setTimeout(() => terminar(false), ms);
    s.on("data", (d) => {
      texto += d.toString("latin1");
      if (texto.includes(MARCA)) terminar(true);
    });
    s.on("error", () => terminar(false));
    s.on("close", () => terminar(false));
  });
}
function faixasDeBusca() {
  return (process.env.GRIDLAP_FAIXAS_DECODER || FAIXA_PADRAO).split(",").map((f) => f.trim()).filter(Boolean);
}
function criarExecutorCalx({ pasta: pasta2, servidor, token, log }) {
  const arquivoHost = import_node_path2.default.join(pasta2, "calx-host.txt");
  const arquivoDecoder = import_node_path2.default.join(pasta2, "decoder-calx.json");
  const arquivoManual = import_node_path2.default.join(pasta2, "config.json");
  const naoCalx = /* @__PURE__ */ new Map();
  let ativo = false;
  let ocupado = false;
  let avisouManual = false;
  let envio = null;
  let instancia = null;
  function modoManual() {
    try {
      if (!(0, import_node_fs3.existsSync)(arquivoManual)) return false;
      return JSON.parse((0, import_node_fs3.readFileSync)(arquivoManual, "utf8"))?.driver === "calx-pro";
    } catch {
      return false;
    }
  }
  function hostConfigurado() {
    const env = process.env.GRIDLAP_CALX_HOST?.trim();
    if (env) return env;
    try {
      if ((0, import_node_fs3.existsSync)(arquivoHost)) {
        return (0, import_node_fs3.readFileSync)(arquivoHost, "utf8").trim() || null;
      }
    } catch {
    }
    return null;
  }
  async function procurar() {
    const configurado = hostConfigurado();
    if (configurado && await sondarCalx(configurado)) {
      return { host: configurado };
    }
    const vizinhos = await listarVizinhos();
    for (const ip of candidatosDoMac(vizinhos, MAC_DECODER_CALX)) {
      if (await sondarCalx(ip)) return { host: ip, mac: MAC_DECODER_CALX };
    }
    const locais = interfacesLocais().map((i) => i.ip);
    for (const faixa of faixasDeBusca()) {
      let hosts;
      try {
        hosts = new Set(hostsDaFaixa(faixa));
      } catch {
        continue;
      }
      for (const v of vizinhos) {
        if (!hosts.has(v.ip) || locais.includes(v.ip)) continue;
        if ((naoCalx.get(v.ip) ?? 0) > Date.now()) continue;
        if (await sondarCalx(v.ip)) return { host: v.ip, mac: v.mac };
        naoCalx.set(v.ip, Date.now() + 5 * 6e4);
      }
    }
    return null;
  }
  async function cadastrar(host) {
    try {
      const resposta = await fetch(
        `${servidor}/api/cronometragem/coletor/decoder`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            driver: "calx-pro",
            nome: "Decoder CalX Pro",
            modelo: "CalX Pro",
            endereco: host
          }),
          signal: AbortSignal.timeout(15e3)
        }
      );
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(corpo.erro ?? `HTTP ${resposta.status}`);
      }
      (0, import_node_fs3.writeFileSync)(
        arquivoDecoder,
        JSON.stringify({ decoderId: corpo.decoderId, token: corpo.token }),
        { mode: 384 }
      );
      log(
        corpo.criado ? "Decoder CalX Pro cadastrado no sistema automaticamente." : "Decoder CalX Pro j\xE1 cadastrado; chave renovada."
      );
      return corpo.token;
    } catch (erro) {
      try {
        const guardado = JSON.parse((0, import_node_fs3.readFileSync)(arquivoDecoder, "utf8"));
        if (guardado?.token) {
          log(`Sistema indispon\xEDvel (${erro.message}); usando a chave guardada.`);
          return guardado.token;
        }
      } catch {
      }
      throw erro;
    }
  }
  async function ligar({ host, mac }) {
    const tokenDecoder = await cadastrar(host);
    envio = criarEnvio({
      servidor,
      token: tokenDecoder,
      arquivoFila: import_node_path2.default.join(pasta2, "fila-calx.jsonl"),
      log: (m) => log(`[envio] ${m}`)
    });
    instancia = await driver.iniciar(
      {
        modo: "cliente",
        host,
        // Com o MAC, o driver acha o IP de novo a cada conexão (DHCP muda).
        ...mac ? { mac } : {},
        porta: PORTA_CALX,
        pastaCapturas: import_node_path2.default.join(pasta2, "capturas"),
        pastaPassagens: import_node_path2.default.join(pasta2, "passagens")
      },
      {
        emitir: envio.emitir,
        conectado: envio.conectado,
        erro: envio.erro,
        info: envio.info,
        log: (m) => log(`[calx-pro] ${m}`)
      }
    );
    ativo = true;
    log(`CalX Pro em ${host}: lendo passagens.`);
  }
  return {
    get ativo() {
      return ativo;
    },
    // Chamado a cada ciclo do agente; seguro chamar sem esperar.
    async ciclo() {
      if (ativo || ocupado) return;
      if (modoManual()) {
        if (!avisouManual) {
          avisouManual = true;
          log("CalX Pro em modo manual (config.json): o coletor faz a leitura.");
        }
        return;
      }
      ocupado = true;
      try {
        const achado = await procurar();
        if (achado) {
          log(`CalX Pro detectado em ${achado.host}.`);
          await ligar(achado);
        }
      } catch (erro) {
        log(`N\xE3o consegui ligar o CalX Pro agora: ${erro.message}`);
      } finally {
        ocupado = false;
      }
    },
    async parar() {
      instancia?.parar();
      await envio?.parar();
    }
  };
}

// coletor/inventario.mjs
var import_node_child_process3 = require("node:child_process");
var import_node_fs4 = require("node:fs");
var NOME_GENERICO = /composite|composto|root hub|generic usb hub|hub usb|usb hub/i;
var EH_HUB = /hub/i;
function vidPid(texto) {
  const m = /VID_([0-9A-F]{4})[&+]PID_([0-9A-F]{4})/i.exec(texto);
  return m ? `VID_${m[1].toUpperCase()}&PID_${m[2].toUpperCase()}` : null;
}
function inventarioDePnp(itens) {
  const lista = Array.isArray(itens) ? itens : itens ? [itens] : [];
  const porChave = /* @__PURE__ */ new Map();
  for (const d of lista) {
    const id = String(d?.InstanceId ?? "");
    const nome = String(d?.FriendlyName ?? "").trim();
    const classe = String(d?.Class ?? "");
    if (!id) continue;
    const fabricante = String(d?.Manufacturer ?? "").trim();
    const driver2 = String(d?.Service ?? "").trim();
    const extra = [
      id,
      fabricante && `fabricante: ${fabricante}`,
      driver2 && `driver: ${driver2}`
    ].filter(Boolean).join(" | ");
    const com = /\((COM\d+)\)/i.exec(nome);
    if (classe === "Ports" && com) {
      const chave2 = `serial:${com[1].toUpperCase()}`;
      porChave.set(chave2, {
        chave: chave2,
        tipo: "serial",
        nome,
        detalhe: extra
      });
      continue;
    }
    if (!/^(USB|FTDIBUS)\\/i.test(id)) continue;
    const par = vidPid(id);
    if (!par) continue;
    if (EH_HUB.test(nome)) continue;
    const chave = `usb:${par}`;
    const atual = porChave.get(chave);
    if (!atual || NOME_GENERICO.test(atual.nome) && !NOME_GENERICO.test(nome)) {
      porChave.set(chave, {
        chave,
        tipo: "usb",
        nome: nome || chave,
        detalhe: extra
      });
    }
  }
  return [...porChave.values()];
}
function inventarioDeLsusb(texto) {
  const itens = [];
  for (const m of String(texto).matchAll(
    /ID ([0-9a-f]{4}):([0-9a-f]{4})\s*(.*)$/gim
  )) {
    const nome = m[3].trim();
    if (EH_HUB.test(nome)) continue;
    const chave = `usb:VID_${m[1].toUpperCase()}&PID_${m[2].toUpperCase()}`;
    if (!itens.some((i) => i.chave === chave)) {
      itens.push({ chave, tipo: "usb", nome: nome || chave });
    }
  }
  return itens;
}
function inventarioDeTty(arquivos) {
  return arquivos.filter((a) => /^(ttyUSB|ttyACM|tty\.usb|cu\.usb)/i.test(a)).map((a) => ({
    chave: `serial:/dev/${a}`,
    tipo: "serial",
    nome: `Porta serial /dev/${a}`
  }));
}
function inventarioDeRede(vizinhos) {
  return vizinhos.map((v) => ({
    chave: `rede:${v.mac}`,
    tipo: "rede",
    nome: v.mac === MAC_DECODER_CALX ? `Decoder CalX Pro (${v.ip})` : `Aparelho na rede (${v.ip})`,
    detalhe: v.ip
  }));
}
var CHAVE_ADAPTADOR_DECODER = "usb:VID_2357&PID_0601";
function alertaPlacaDoDecoder(itens, placas) {
  if (!itens.some((i) => i.chave === CHAVE_ADAPTADOR_DECODER)) return null;
  if (placas.some((p) => p.ip.startsWith("192.168.137."))) return null;
  if (!placas.some((p) => p.ip.startsWith("169.254."))) return null;
  return {
    chave: "alerta:placa-decoder-sem-rede",
    tipo: "outro",
    nome: "A placa do decoder est\xE1 sem rede",
    detalhe: "Rode 'Preparar rede do decoder' (uma vez, como administrador) e reconecte o adaptador."
  };
}
function executar(comando, args2, timeout = 2e4) {
  return new Promise((resolve) => {
    (0, import_node_child_process3.execFile)(
      comando,
      args2,
      { timeout, windowsHide: true, maxBuffer: 5 * 1024 * 1024 },
      (erro, saida) => resolve(erro ? null : String(saida))
    );
  });
}
var SCRIPT_WINDOWS = [
  "[Console]::OutputEncoding = [Text.Encoding]::UTF8;",
  "Get-PnpDevice -PresentOnly |",
  "Where-Object { $_.InstanceId -match '^(USB|FTDIBUS)\\\\' -or $_.Class -eq 'Ports' } |",
  "Select-Object FriendlyName, InstanceId, Class, Manufacturer, Service |",
  "ConvertTo-Json -Compress"
].join(" ");
async function coletarInventario() {
  const itens = [];
  if (process.platform === "win32") {
    const saida = await executar("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      SCRIPT_WINDOWS
    ]);
    if (saida && saida.trim()) {
      try {
        itens.push(...inventarioDePnp(JSON.parse(saida)));
      } catch {
      }
    }
  } else {
    const lsusb = await executar("lsusb", []);
    if (lsusb) itens.push(...inventarioDeLsusb(lsusb));
    try {
      itens.push(...inventarioDeTty((0, import_node_fs4.readdirSync)("/dev")));
    } catch {
    }
  }
  let vizinhos = await listarVizinhos();
  if (!vizinhos.some((v) => v.mac === MAC_DECODER_CALX) && await acordarFaixasDoDecoder()) {
    vizinhos = await listarVizinhos();
  }
  itens.push(...inventarioDeRede(vizinhos));
  const alerta = alertaPlacaDoDecoder(itens, interfacesLocais());
  if (alerta) itens.push(alerta);
  return itens;
}

// coletor/agente-nucleo.mjs
var TAMANHO_MAXIMO_DO_LOG = 1024 * 1024;
var AJUDA = `Agente do computador da pista (Grid Lap)

Uso:
  GridLap-Agente.exe                      Primeira vez: pergunta o endere\xE7o e o c\xF3digo.
                                          Depois: vigia o que est\xE1 ligado e avisa o sistema.
  GridLap-Agente.exe parear CODIGO --servidor http://endereco-do-sistema
                  [--nome "PC da pista"]  Liga este computador ao sistema (uma vez)
  GridLap-Agente.exe rodar [--intervalo 8]  Vigia e avisa o sistema
  GridLap-Agente.exe ver                  Mostra o que este computador enxerga (n\xE3o envia)
  GridLap-Agente.exe iniciar-com-windows  Faz o agente abrir sozinho com o Windows
  GridLap-Agente.exe remover-inicio       Desfaz o anterior

(Na linha de comando do projeto: node coletor/agente.mjs <mesmos comandos>.)
O CODIGO \xE9 gerado em /admin/cronometragem \u2192 Equipamentos \u2192 Computador da pista
(vale 15 minutos e s\xF3 uma vez).
`;
function argumentos(lista) {
  const opcoes = {};
  const posicionais = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.startsWith("--")) {
      const proximo = lista[i + 1];
      if (proximo === void 0 || proximo.startsWith("--")) {
        opcoes[a.slice(2)] = true;
      } else {
        opcoes[a.slice(2)] = proximo;
        i++;
      }
    } else posicionais.push(a);
  }
  return { opcoes, posicionais };
}
function urlDoServidor(texto) {
  let valor = String(texto).trim();
  if (!/^https?:\/\//i.test(valor)) valor = `http://${valor}`;
  const url = new URL(valor);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Use http:// ou https://");
  }
  return url.origin;
}
function criarAgente(pasta2) {
  const arquivo = import_node_path3.default.join(pasta2, "agente.json");
  const arquivoLog = import_node_path3.default.join(pasta2, "GridLap-Agente.log");
  function log(mensagem) {
    const agora = /* @__PURE__ */ new Date();
    console.log(`[${agora.toLocaleTimeString("pt-BR")}] ${mensagem}`);
    try {
      (0, import_node_fs5.mkdirSync)(pasta2, { recursive: true });
      if ((0, import_node_fs5.existsSync)(arquivoLog) && (0, import_node_fs5.statSync)(arquivoLog).size > TAMANHO_MAXIMO_DO_LOG) {
        (0, import_node_fs5.truncateSync)(arquivoLog, 0);
      }
      (0, import_node_fs5.appendFileSync)(
        arquivoLog,
        `[${agora.toLocaleString("pt-BR")}] ${mensagem}
`
      );
    } catch {
    }
  }
  function lerConfig() {
    if (!(0, import_node_fs5.existsSync)(arquivo)) return null;
    try {
      return JSON.parse((0, import_node_fs5.readFileSync)(arquivo, "utf8"));
    } catch (erro) {
      throw new Error(`N\xE3o consegui ler ${arquivo}: ${erro.message}`);
    }
  }
  async function parear(codigo, servidorBruto, nomeBruto) {
    const servidor = urlDoServidor(servidorBruto);
    const nome = (nomeBruto || import_node_os3.default.hostname()).trim() || import_node_os3.default.hostname();
    const resposta = await fetch(
      `${servidor}/api/cronometragem/coletor/parear`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          codigo,
          nome,
          sistema: `${import_node_os3.default.platform()} ${import_node_os3.default.release()}`
        }),
        signal: AbortSignal.timeout(15e3)
      }
    );
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(
        corpo.erro ?? `o sistema respondeu HTTP ${resposta.status}`
      );
    }
    (0, import_node_fs5.writeFileSync)(
      arquivo,
      JSON.stringify({ servidor, token: corpo.token, nome }, null, 2),
      { mode: 384 }
    );
    log(`Pareado como "${nome}" no sistema ${servidor}.`);
  }
  const detalhe = (d) => d.detalhe ? `
      ${d.detalhe}` : "";
  const resumo = (lista) => lista.map((d) => `${d.tipo}: ${d.nome}`).join("; ");
  async function ver() {
    const lista = await coletarInventario();
    console.log(`${lista.length} dispositivo(s) visto(s) neste computador:
`);
    for (const d of lista) {
      console.log(
        `  [${d.tipo}] ${d.nome}
      chave: ${d.chave}${detalhe(d)}`
      );
    }
  }
  async function rodar(intervaloSegundos) {
    const config = lerConfig();
    if (!config?.token || !config?.servidor) {
      throw new Error(
        "Este computador ainda n\xE3o foi pareado com o sistema (veja o comando parear)."
      );
    }
    const intervaloMs = Math.max(3, Number(intervaloSegundos) || 8) * 1e3;
    log(`Agente "${config.nome}" vigiando. Sistema: ${config.servidor}`);
    const calx = criarExecutorCalx({
      pasta: pasta2,
      servidor: config.servidor,
      token: config.token,
      log
    });
    let anteriores = null;
    let semConexao = false;
    let parar = false;
    process.on("SIGINT", () => {
      parar = true;
      void calx.parar();
    });
    while (!parar) {
      void calx.ciclo();
      try {
        const lista = await coletarInventario();
        const chaves = new Set(lista.map((d) => d.chave));
        if (anteriores) {
          const entrou = lista.filter((d) => !anteriores.has(d.chave));
          const saiu = [...anteriores.entries()].filter(([chave]) => !chaves.has(chave)).map(([, d]) => d);
          for (const d of entrou) {
            log(`APARECEU: [${d.tipo}] ${d.nome} (${d.chave})${detalhe(d)}`);
          }
          if (saiu.length) log(`saiu: ${resumo(saiu)}`);
        } else {
          const fisicos = lista.filter((d) => d.tipo !== "rede");
          log(
            `${lista.length} dispositivo(s) visto(s) agora (${fisicos.length} USB/serial, ${lista.length - fisicos.length} na rede).`
          );
          for (const d of fisicos) {
            log(`  [${d.tipo}] ${d.nome} (${d.chave})`);
          }
        }
        anteriores = new Map(lista.map((d) => [d.chave, d]));
        const resposta = await fetch(
          `${config.servidor}/api/cronometragem/coletor/inventario`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${config.token}`
            },
            body: JSON.stringify({ dispositivos: lista }),
            signal: AbortSignal.timeout(15e3)
          }
        );
        if (resposta.status === 401) {
          if (!semConexao) {
            log(
              "O sistema recusou este computador (foi desligado?). Gere um c\xF3digo novo e pareie de novo."
            );
          }
          semConexao = true;
        } else if (!resposta.ok) {
          throw new Error(`HTTP ${resposta.status}`);
        } else {
          if (semConexao) log("Conex\xE3o com o sistema restabelecida.");
          semConexao = false;
        }
      } catch (erro) {
        if (!semConexao) log(`Sem conex\xE3o com o sistema (${erro.message}).`);
        semConexao = true;
      }
      await new Promise((r) => setTimeout(r, intervaloMs));
    }
  }
  return { arquivo, arquivoLog, log, lerConfig, parear, ver, rodar };
}
function arquivoDeInicio() {
  const appdata = process.env.APPDATA;
  if (process.platform !== "win32" || !appdata) return null;
  return import_node_path3.default.join(
    appdata,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "GridLap-Agente.cmd"
  );
}
function instalarInicio(comando, pasta2) {
  const alvo = arquivoDeInicio();
  if (!alvo) throw new Error("S\xF3 funciona no Windows.");
  const linhas = [
    "@echo off",
    `cd /d "${pasta2}"`,
    `start "GridLap Agente" /min ${comando}`
  ];
  (0, import_node_fs5.writeFileSync)(alvo, `${linhas.join("\r\n")}\r
`, "ascii");
  return alvo;
}
function removerInicio() {
  const alvo = arquivoDeInicio();
  if (alvo && (0, import_node_fs5.existsSync)(alvo)) {
    (0, import_node_fs5.unlinkSync)(alvo);
    return true;
  }
  return false;
}
async function perguntar(texto, padrao = "") {
  const leitor = (0, import_promises.createInterface)({
    input: process.stdin,
    output: process.stdout
  });
  try {
    const resposta = (await leitor.question(padrao ? `${texto} [${padrao}]: ` : `${texto}: `)).trim();
    return resposta || padrao;
  } finally {
    leitor.close();
  }
}
async function esperarEnter() {
  await perguntar("\nPressione Enter para fechar");
}

// coletor/agente-principal.mjs
async function rodarAgente(args2, { pasta: pasta2, comandoDeInicio: comandoDeInicio2, interativo }) {
  const agente = criarAgente(pasta2);
  const { opcoes, posicionais } = argumentos(args2);
  const [comando, ...resto] = posicionais;
  try {
    if (comando === "parear") {
      if (!resto[0] || !opcoes.servidor) {
        console.log(AJUDA);
        return 1;
      }
      await agente.parear(
        resto[0],
        String(opcoes.servidor),
        typeof opcoes.nome === "string" ? opcoes.nome : ""
      );
      console.log("Agora rode o agente (sem argumentos, ou o comando rodar).");
      return 0;
    }
    if (comando === "rodar") {
      await agente.rodar(opcoes.intervalo);
      return 0;
    }
    if (comando === "ver") {
      await agente.ver();
      return 0;
    }
    if (comando === "iniciar-com-windows") {
      console.log(`Pronto: ${instalarInicio(comandoDeInicio2, pasta2)}`);
      return 0;
    }
    if (comando === "remover-inicio") {
      console.log(
        removerInicio() ? "In\xEDcio autom\xE1tico desfeito." : "Nada para desfazer."
      );
      return 0;
    }
    if (comando || opcoes.ajuda || !interativo && !comando) {
      console.log(AJUDA);
      return comando ? 1 : 0;
    }
    console.log("=== Grid Lap \xB7 Agente do computador da pista ===\n");
    if (!agente.lerConfig()) {
      console.log(
        "Primeira vez neste computador: vamos lig\xE1-lo ao sistema.\nNo sistema, abra Cronometragem \u2192 Equipamentos \u2192 Computador da pista\ne clique em 'Gerar c\xF3digo de pareamento'.\n"
      );
      for (; ; ) {
        const servidor = await perguntar(
          "Endere\xE7o do sistema (ex.: https://gridlap.exemplo.com.br)"
        );
        const codigo = await perguntar("C\xF3digo de pareamento (ex.: ABCD-EFGH)");
        const nome = await perguntar(
          "Nome deste computador",
          process.env.COMPUTERNAME || "PC da pista"
        );
        try {
          await agente.parear(codigo, servidor, nome);
          break;
        } catch (erro) {
          console.log(`
N\xE3o deu certo: ${erro.message}`);
          console.log(
            "Confira o endere\xE7o e o c\xF3digo (vale 15 minutos) e tente de novo.\n"
          );
        }
      }
      if (process.platform === "win32") {
        const sim = await perguntar(
          "\nIniciar o agente junto com o Windows? (s/N)",
          "n"
        );
        if (/^s/i.test(sim)) {
          console.log(`Pronto: ${instalarInicio(comandoDeInicio2, pasta2)}`);
        }
      }
    }
    console.log(
      `
Agora conecte o decoder a este computador. Ele vai aparecer na tela
do sistema (Equipamentos \u2192 Computador da pista). N\xE3o feche esta janela.
O registro fica em ${agente.arquivoLog}
`
    );
    await agente.rodar(8);
    return 0;
  } catch (erro) {
    console.error(`
Erro: ${erro.message}`);
    if (interativo) await esperarEnter();
    return 1;
  }
}

// coletor/agente-instalado.mjs
var script = import_node_path4.default.resolve(process.argv[1]);
var pasta = import_node_path4.default.dirname(script);
var node = process.execPath;
var comandoDeInicio = `"${node}" "${script}" rodar`;
async function instalar() {
  const agente = criarAgente(pasta);
  const arquivoCodigo = import_node_path4.default.join(pasta, "pareamento.json");
  if (!agente.lerConfig()) {
    if (!(0, import_node_fs6.existsSync)(arquivoCodigo)) {
      console.log(
        "Este computador ainda n\xE3o foi ligado ao sistema e n\xE3o h\xE1 c\xF3digo de\npareamento. Baixe o instalador de novo em Configura\xE7\xF5es \u2192 Decoder."
      );
      return 1;
    }
    const { servidor, codigo, nome } = JSON.parse(
      (0, import_node_fs6.readFileSync)(arquivoCodigo, "utf8")
    );
    try {
      await agente.parear(codigo, servidor, nome);
    } catch (erro) {
      console.log(`
N\xE3o consegui ligar ao sistema: ${erro.message}`);
      console.log(
        "O c\xF3digo vale 15 minutos e s\xF3 pode ser usado uma vez. Gere um\ninstalador novo em Configura\xE7\xF5es \u2192 Decoder e rode de novo."
      );
      return 1;
    }
  } else {
    console.log("Este computador j\xE1 est\xE1 ligado ao sistema.");
  }
  try {
    (0, import_node_fs6.unlinkSync)(arquivoCodigo);
  } catch {
  }
  if (process.platform === "win32") {
    console.log(`In\xEDcio autom\xE1tico: ${instalarInicio(comandoDeInicio, pasta)}`);
  }
  const filho = (0, import_node_child_process4.spawn)(node, [script, "rodar"], {
    cwd: pasta,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  filho.unref();
  console.log(
    "\nPronto! O agente j\xE1 est\xE1 procurando o decoder.\nConecte o decoder a este computador (cabo de rede) e ligue-o:\nele aparece sozinho no sistema, em Configura\xE7\xF5es \u2192 Decoder.\nDaqui para frente o agente abre sozinho quando o Windows iniciar."
  );
  return 0;
}
var args = process.argv.slice(2);
(args[0] === "instalar" ? instalar() : rodarAgente(args, { pasta, comandoDeInicio, interativo: false })).then((codigo) => {
  process.exitCode = codigo;
});
