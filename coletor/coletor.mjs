#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PORTAS_CANDIDATAS,
  escutarUdp,
  hostsDaFaixa,
  interfacesLocais,
  listarVizinhos,
  varrer,
} from "./descoberta.mjs";
import { DRIVERS } from "./drivers/index.mjs";
import { criarEnvio } from "./envio.mjs";

const PASTA = path.dirname(fileURLToPath(import.meta.url));

const AJUDA = `Coletor de decoders do Grid Lap

Uso:
  node coletor/coletor.mjs descobrir [opções]   Procura decoders na rede
  node coletor/coletor.mjs rodar [--config arquivo]   Lê o decoder e envia as passagens

descobrir (só observa; não envia dados aos aparelhos):
  (sem opções)           lista as placas de rede e os aparelhos já conhecidos (ARP)
  --udp 9000,30718       escuta essas portas UDP por alguns segundos
  --segundos 10          duração da escuta UDP (padrão 10)
  --ativo                também tenta abrir conexão TCP nas portas candidatas e
                         espera o que o aparelho mandar sozinho. Exige --faixa
                         ou --interface. Faça fora de corrida e com o outro
                         programa (ex.: LapTime) fechado.
  --faixa 192.168.1.0/24 faixa a varrer (entre /22 e /30)
  --interface "Ethernet 4" usa a faixa dessa placa de rede
  --portas 5100,10001    portas TCP a testar (padrão: ${PORTAS_CANDIDATAS.join(", ")})
  --naoconectar 192.168.1.10   IPs que a busca deve pular
  --config arquivo       usa o formato/driver do arquivo para reconhecer o aparelho

rodar: lê o arquivo coletor/config.json (modelo: coletor/exemplo.config.json).
  Variáveis GRIDLAP_URL e GRIDLAP_TOKEN substituem servidor e token do arquivo.
`;

function argumentos(lista) {
  const opcoes = {};
  const posicionais = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.startsWith("--")) {
      const chave = a.slice(2);
      const proximo = lista[i + 1];
      if (proximo === undefined || proximo.startsWith("--"))
        opcoes[chave] = true;
      else {
        opcoes[chave] = proximo;
        i++;
      }
    } else posicionais.push(a);
  }
  return { opcoes, posicionais };
}

function hora() {
  return new Date().toLocaleTimeString("pt-BR");
}
const log = (mensagem) => console.log(`[${hora()}] ${mensagem}`);

function lerConfig(caminho) {
  if (!existsSync(caminho)) return null;
  try {
    return JSON.parse(readFileSync(caminho, "utf8"));
  } catch (erro) {
    throw new Error(`Não consegui ler ${caminho}: ${erro.message}`);
  }
}

function lista(texto, converter = (x) => x) {
  return String(texto)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(converter);
}

function previa(bytes) {
  const texto = bytes
    .toString("latin1")
    .replace(/[^\x20-\x7e]/g, ".")
    .slice(0, 60);
  return `${bytes.length} bytes: ${bytes.subarray(0, 16).toString("hex")}  "${texto}"`;
}

// Devolve quem reconhece os bytes (com a configuração do driver, se houver).
function reconhecedor(config) {
  return (bytes) => {
    for (const driver of Object.values(DRIVERS)) {
      try {
        if (driver.reconhece(bytes, config ?? {})) return driver;
      } catch {
        // configuração incompleta para este driver
      }
    }
    return null;
  };
}

function faixaDaInterface(nome) {
  const placa = interfacesLocais().find((i) => i.nome === nome);
  if (!placa) {
    throw new Error(
      `Placa "${nome}" não encontrada. Placas: ${
        interfacesLocais()
          .map((i) => i.nome)
          .join(", ") || "nenhuma"
      }.`,
    );
  }
  return placa.cidr;
}

async function descobrir(opcoes) {
  const config = opcoes.config ? lerConfig(String(opcoes.config)) : null;

  console.log("Placas de rede deste computador:");
  for (const i of interfacesLocais()) console.log(`  ${i.nome}: ${i.cidr}`);

  console.log("\nAparelhos que este computador já conhece na rede (ARP):");
  const vizinhos = await listarVizinhos();
  if (vizinhos.length === 0)
    console.log("  nenhum (normal se a rede acabou de ser ligada).");
  for (const v of vizinhos) console.log(`  ${v.ip}  ${v.mac}`);

  if (opcoes.udp) {
    const portas = lista(opcoes.udp, Number);
    const segundos = Number(opcoes.segundos ?? 10);
    console.log(
      `\nEscutando UDP ${portas.join(", ")} por ${segundos}s (sem enviar nada)…`,
    );
    const vistos = await escutarUdp(portas, segundos * 1000);
    if (vistos.length === 0) console.log("  ninguém falou nessas portas.");
    for (const v of vistos) {
      console.log(
        `  ${v.origem}:${v.porta}  ${v.pacotes} pacote(s)  ${previa(v.exemplo)}`,
      );
    }
  }

  if (!opcoes.ativo) {
    console.log(
      "\nBusca ativa (conexão TCP) não executada. Para tentar: adicione --ativo com --faixa ou --interface.",
    );
    return;
  }

  const cidr = opcoes.faixa
    ? String(opcoes.faixa)
    : opcoes.interface
      ? faixaDaInterface(String(opcoes.interface))
      : null;
  if (!cidr) {
    throw new Error(
      '--ativo exige --faixa 192.168.1.0/24 ou --interface "Nome da placa".',
    );
  }
  const pular = new Set(lista(opcoes.naoconectar ?? ""));
  const hosts = hostsDaFaixa(cidr).filter((h) => !pular.has(h));
  const portas = opcoes.portas
    ? lista(opcoes.portas, Number)
    : PORTAS_CANDIDATAS;

  console.log(
    `\nATENÇÃO: vou tentar conectar em ${hosts.length} endereço(s) da faixa ${cidr}, portas ${portas.join(", ")}.\n` +
      "Decoders que aceitam um programa por vez podem recusar o outro programa durante a busca.\n" +
      "Ctrl+C nos próximos 5 segundos cancela.",
  );
  await new Promise((r) => setTimeout(r, 5000));

  const achados = await varrer({
    hosts,
    portas,
    reconhecer: reconhecedor(config),
    aoAchar: (a) =>
      console.log(
        `  ${a.host}:${a.porta} aberta — ${a.bytes.length ? previa(a.bytes) : "não mandou nada sozinha"}` +
          (a.driver ? `  → reconhecida pelo driver "${a.driver}"` : ""),
      ),
  });
  console.log(`\nBusca terminada: ${achados.length} porta(s) aberta(s).`);
  if (achados.some((a) => a.driver)) {
    console.log('Coloque host e porta no config.json e rode "rodar".');
  } else if (achados.length) {
    console.log(
      'Nenhuma foi reconhecida. Se uma delas for o decoder, use o driver "gravador" para registrar o que ele manda e escrever um driver novo (veja LEIA-ME.md).',
    );
  }
}

async function achar(config, motivo) {
  const cidr =
    config.faixa ??
    (config.interface ? faixaDaInterface(config.interface) : null);
  if (!cidr)
    throw new Error(
      'Com "host": "auto" informe "faixa" ou "interface" no config.',
    );
  const driver = DRIVERS[config.driver];
  const portas = config.portasBusca ?? [
    ...new Set([...PORTAS_CANDIDATAS, ...driver.portasComuns]),
  ];
  const pular = new Set(config.naoConectar ?? []);
  for (;;) {
    log(`${motivo}: procurando o decoder em ${cidr}…`);
    const achados = await varrer({
      hosts: hostsDaFaixa(cidr).filter((h) => !pular.has(h)),
      portas,
      reconhecer: (bytes) => {
        try {
          return driver.reconhece(bytes, config) ? driver : null;
        } catch {
          return null;
        }
      },
    });
    const achado = achados.find((a) => a.driver);
    if (achado) {
      log(`decoder encontrado em ${achado.host}:${achado.porta}.`);
      return achado;
    }
    log("não encontrei; nova tentativa em 30s.");
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

async function rodar(opcoes) {
  const caminho = path.resolve(
    String(opcoes.config ?? path.join(PASTA, "config.json")),
  );
  const config = lerConfig(caminho);
  if (!config) {
    throw new Error(
      `Arquivo de configuração não encontrado: ${caminho}\nCopie coletor/exemplo.config.json e preencha.`,
    );
  }
  config.servidor = process.env.GRIDLAP_URL || config.servidor;
  config.token = process.env.GRIDLAP_TOKEN || config.token;
  if (!config.servidor || !config.token) {
    throw new Error(
      'Informe "servidor" e "token" no config (ou GRIDLAP_URL e GRIDLAP_TOKEN).',
    );
  }
  const driver = DRIVERS[config.driver];
  if (!driver) {
    throw new Error(
      `Driver "${config.driver}" desconhecido. Disponíveis: ${Object.keys(DRIVERS).join(", ")}.`,
    );
  }

  if (config.host === "auto") {
    const achado = await achar(config, "início");
    config.host = achado.host;
    config.porta = achado.porta;
  }

  const envio = criarEnvio({
    servidor: config.servidor,
    token: config.token,
    arquivoFila:
      config.arquivoFila ?? path.join(path.dirname(caminho), "fila.jsonl"),
    log: (m) => log(`[envio] ${m}`),
  });
  const instancia = await driver.iniciar(config, {
    emitir: envio.emitir,
    conectado: envio.conectado,
    erro: envio.erro,
    log: (m) => log(`[${driver.id}] ${m}`),
  });

  const status = setInterval(() => {
    const n = envio.pendentes();
    if (n) log(`${n} passagem(ns) aguardando envio.`);
  }, 30_000);

  const encerrar = async () => {
    clearInterval(status);
    instancia.parar();
    await envio.parar();
    process.exit(0);
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
  log(
    `coletor rodando com o driver "${driver.id}" → ${config.servidor} (Ctrl+C encerra).`,
  );
}

const { opcoes, posicionais } = argumentos(process.argv.slice(2));
const comando = posicionais[0];

try {
  if (comando === "descobrir") await descobrir(opcoes);
  else if (comando === "rodar") await rodar(opcoes);
  else console.log(AJUDA);
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  process.exit(1);
}
