// Núcleo do agente do computador da pista: serve tanto a linha de comando
// (`node coletor/agente.mjs`) quanto o executável (GridLap-Agente.exe). Roda
// sempre e avisa o Grid Lap, a cada poucos segundos, o que está ligado neste
// computador. Quando o decoder é conectado, ele aparece em destaque na tela do
// sistema. É só leitura: nada é enviado aos aparelhos.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { coletarInventario } from "./inventario.mjs";

const TAMANHO_MAXIMO_DO_LOG = 1024 * 1024;

export const AJUDA = `Agente do computador da pista (Grid Lap)

Uso:
  GridLap-Agente.exe                      Primeira vez: pergunta o endereço e o código.
                                          Depois: vigia o que está ligado e avisa o sistema.
  GridLap-Agente.exe parear CODIGO --servidor http://endereco-do-sistema
                  [--nome "PC da pista"]  Liga este computador ao sistema (uma vez)
  GridLap-Agente.exe rodar [--intervalo 8]  Vigia e avisa o sistema
  GridLap-Agente.exe ver                  Mostra o que este computador enxerga (não envia)
  GridLap-Agente.exe iniciar-com-windows  Faz o agente abrir sozinho com o Windows
  GridLap-Agente.exe remover-inicio       Desfaz o anterior

(Na linha de comando do projeto: node coletor/agente.mjs <mesmos comandos>.)
O CODIGO é gerado em /admin/cronometragem → Equipamentos → Computador da pista
(vale 15 minutos e só uma vez).
`;

export function argumentos(lista) {
  const opcoes = {};
  const posicionais = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.startsWith("--")) {
      const proximo = lista[i + 1];
      if (proximo === undefined || proximo.startsWith("--")) {
        opcoes[a.slice(2)] = true;
      } else {
        opcoes[a.slice(2)] = proximo;
        i++;
      }
    } else posicionais.push(a);
  }
  return { opcoes, posicionais };
}

export function urlDoServidor(texto) {
  let valor = String(texto).trim();
  if (!/^https?:\/\//i.test(valor)) valor = `http://${valor}`;
  const url = new URL(valor);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Use http:// ou https://");
  }
  return url.origin;
}

// `pasta` é onde ficam agente.json (chave deste computador) e o log: a pasta
// do projeto (linha de comando) ou a pasta do .exe.
export function criarAgente(pasta) {
  const arquivo = path.join(pasta, "agente.json");
  const arquivoLog = path.join(pasta, "GridLap-Agente.log");

  function log(mensagem) {
    const agora = new Date();
    console.log(`[${agora.toLocaleTimeString("pt-BR")}] ${mensagem}`);
    try {
      mkdirSync(pasta, { recursive: true });
      if (
        existsSync(arquivoLog) &&
        statSync(arquivoLog).size > TAMANHO_MAXIMO_DO_LOG
      ) {
        truncateSync(arquivoLog, 0);
      }
      appendFileSync(
        arquivoLog,
        `[${agora.toLocaleString("pt-BR")}] ${mensagem}\n`,
      );
    } catch {
      // sem permissão de escrita na pasta: segue só no console
    }
  }

  function lerConfig() {
    if (!existsSync(arquivo)) return null;
    try {
      return JSON.parse(readFileSync(arquivo, "utf8"));
    } catch (erro) {
      throw new Error(`Não consegui ler ${arquivo}: ${erro.message}`);
    }
  }

  async function parear(codigo, servidorBruto, nomeBruto) {
    const servidor = urlDoServidor(servidorBruto);
    const nome = (nomeBruto || os.hostname()).trim() || os.hostname();
    const resposta = await fetch(
      `${servidor}/api/cronometragem/coletor/parear`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          codigo,
          nome,
          sistema: `${os.platform()} ${os.release()}`,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(
        corpo.erro ?? `o sistema respondeu HTTP ${resposta.status}`,
      );
    }
    writeFileSync(
      arquivo,
      JSON.stringify({ servidor, token: corpo.token, nome }, null, 2),
      { mode: 0o600 },
    );
    log(`Pareado como "${nome}" no sistema ${servidor}.`);
  }

  const detalhe = (d) => (d.detalhe ? `\n      ${d.detalhe}` : "");
  const resumo = (lista) => lista.map((d) => `${d.tipo}: ${d.nome}`).join("; ");

  async function ver() {
    const lista = await coletarInventario();
    console.log(`${lista.length} dispositivo(s) visto(s) neste computador:\n`);
    for (const d of lista) {
      console.log(
        `  [${d.tipo}] ${d.nome}\n      chave: ${d.chave}${detalhe(d)}`,
      );
    }
  }

  async function rodar(intervaloSegundos) {
    const config = lerConfig();
    if (!config?.token || !config?.servidor) {
      throw new Error(
        "Este computador ainda não foi pareado com o sistema (veja o comando parear).",
      );
    }
    const intervaloMs = Math.max(3, Number(intervaloSegundos) || 8) * 1000;
    log(`Agente "${config.nome}" vigiando. Sistema: ${config.servidor}`);

    let anteriores = null;
    let semConexao = false;
    let parar = false;
    process.on("SIGINT", () => {
      parar = true;
    });

    while (!parar) {
      try {
        const lista = await coletarInventario();
        const chaves = new Set(lista.map((d) => d.chave));
        if (anteriores) {
          const entrou = lista.filter((d) => !anteriores.has(d.chave));
          const saiu = [...anteriores.entries()]
            .filter(([chave]) => !chaves.has(chave))
            .map(([, d]) => d);
          for (const d of entrou) {
            log(`APARECEU: [${d.tipo}] ${d.nome} (${d.chave})${detalhe(d)}`);
          }
          if (saiu.length) log(`saiu: ${resumo(saiu)}`);
        } else {
          const fisicos = lista.filter((d) => d.tipo !== "rede");
          log(
            `${lista.length} dispositivo(s) visto(s) agora (${fisicos.length} USB/serial, ${lista.length - fisicos.length} na rede).`,
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
              authorization: `Bearer ${config.token}`,
            },
            body: JSON.stringify({ dispositivos: lista }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (resposta.status === 401) {
          if (!semConexao) {
            log(
              "O sistema recusou este computador (foi desligado?). Gere um código novo e pareie de novo.",
            );
          }
          semConexao = true;
        } else if (!resposta.ok) {
          throw new Error(`HTTP ${resposta.status}`);
        } else {
          if (semConexao) log("Conexão com o sistema restabelecida.");
          semConexao = false;
        }
      } catch (erro) {
        if (!semConexao) log(`Sem conexão com o sistema (${erro.message}).`);
        semConexao = true;
      }
      await new Promise((r) => setTimeout(r, intervaloMs));
    }
  }

  return { arquivo, arquivoLog, log, lerConfig, parear, ver, rodar };
}

// ---- iniciar junto com o Windows (arquivo na pasta Inicializar do usuário) ----

function arquivoDeInicio() {
  const appdata = process.env.APPDATA;
  if (process.platform !== "win32" || !appdata) return null;
  return path.join(
    appdata,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "GridLap-Agente.cmd",
  );
}

export function instalarInicio(comando, pasta) {
  const alvo = arquivoDeInicio();
  if (!alvo) throw new Error("Só funciona no Windows.");
  const linhas = [
    "@echo off",
    `cd /d "${pasta}"`,
    `start "GridLap Agente" /min ${comando}`,
  ];
  writeFileSync(alvo, `${linhas.join("\r\n")}\r\n`, "ascii");
  return alvo;
}

export function removerInicio() {
  const alvo = arquivoDeInicio();
  if (alvo && existsSync(alvo)) {
    unlinkSync(alvo);
    return true;
  }
  return false;
}

// ---- conversa na primeira execução (duplo clique no .exe) ----

export async function perguntar(texto, padrao = "") {
  const leitor = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const resposta = (
      await leitor.question(padrao ? `${texto} [${padrao}]: ` : `${texto}: `)
    ).trim();
    return resposta || padrao;
  } finally {
    leitor.close();
  }
}

export async function esperarEnter() {
  await perguntar("\nPressione Enter para fechar");
}
