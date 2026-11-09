// Plug-and-play do CalX Pro dentro do agente do computador da pista:
//   1. procura o decoder (host de teste → MAC conhecido → qualquer aparelho
//      novo da faixa do cabo que se identifique como CalX Pro na porta 5100);
//   2. pede ao sistema o cadastro dele (token do COMPUTADOR; o sistema cria o
//      decoder e devolve o token dele — ninguém copia nada);
//   3. liga o driver calx-pro (drivers/calx-pro.mjs) e envia as passagens pela
//      fila segura (envio.mjs).
// Só LEITURA: nunca envia dados ao decoder.
//
// Modo manual (antigo): se existir config.json com "driver": "calx-pro" na
// pasta do agente, o agente NÃO liga o CalX sozinho (quem lê é o coletor.mjs).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import {
  MAC_DECODER_CALX,
  hostsDaFaixa,
  interfacesLocais,
  listarVizinhos,
} from "./descoberta.mjs";
import { driver as calxPro } from "./drivers/calx-pro.mjs";
import { criarEnvio } from "./envio.mjs";

const PORTA_CALX = 5100;
const MARCA = "xCALXPRO";
const FAIXA_PADRAO = "192.168.137.0/24";
const ESCUTA_MS = 6000; // o sinal de vida chega a cada ~4,7 s

// Conecta e SÓ ESCUTA: true se o aparelho se identificar como CalX Pro.
export function sondarCalx(host, porta = PORTA_CALX, ms = ESCUTA_MS) {
  return new Promise((resolve) => {
    let texto = "";
    let fim = false;
    const s = net.connect({ host, port: porta });
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
  return (process.env.GRIDLAP_FAIXAS_DECODER || FAIXA_PADRAO)
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * @param {{ pasta: string, servidor: string, token: string, log: (m: string) => void }} opcoes
 */
export function criarExecutorCalx({ pasta, servidor, token, log }) {
  const arquivoHost = path.join(pasta, "calx-host.txt");
  const arquivoDecoder = path.join(pasta, "decoder-calx.json");
  const arquivoManual = path.join(pasta, "config.json");
  const naoCalx = new Map(); // ip -> até quando não testar de novo
  let ativo = false;
  let ocupado = false;
  let avisouManual = false;
  let envio = null;
  let instancia = null;

  function modoManual() {
    try {
      if (!existsSync(arquivoManual)) return false;
      return JSON.parse(readFileSync(arquivoManual, "utf8"))?.driver === "calx-pro";
    } catch {
      return false;
    }
  }

  // Host de teste (simulador): variável de ambiente ou arquivo calx-host.txt.
  function hostConfigurado() {
    const env = process.env.GRIDLAP_CALX_HOST?.trim();
    if (env) return env;
    try {
      if (existsSync(arquivoHost)) {
        return readFileSync(arquivoHost, "utf8").trim() || null;
      }
    } catch {
      // arquivo ilegível: ignora
    }
    return null;
  }

  // -> { host, mac? } do decoder, ou null.
  async function procurar() {
    const configurado = hostConfigurado();
    // Host de teste que não responde (simulador fechado): segue a busca normal,
    // para um arquivo esquecido não esconder o decoder de verdade.
    if (configurado && (await sondarCalx(configurado))) {
      return { host: configurado };
    }
    const vizinhos = await listarVizinhos();
    const conhecido = vizinhos.find((v) => v.mac === MAC_DECODER_CALX);
    if (conhecido) return { host: conhecido.ip, mac: conhecido.mac };

    // Qualquer CalX Pro: aparelho novo da faixa do cabo que fale o protocolo.
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
        naoCalx.set(v.ip, Date.now() + 5 * 60_000);
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
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            driver: "calx-pro",
            nome: "Decoder CalX Pro",
            modelo: "CalX Pro",
            endereco: host,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        throw new Error(corpo.erro ?? `HTTP ${resposta.status}`);
      }
      writeFileSync(
        arquivoDecoder,
        JSON.stringify({ decoderId: corpo.decoderId, token: corpo.token }),
        { mode: 0o600 },
      );
      log(
        corpo.criado
          ? "Decoder CalX Pro cadastrado no sistema automaticamente."
          : "Decoder CalX Pro já cadastrado; chave renovada.",
      );
      return corpo.token;
    } catch (erro) {
      // Sem o sistema agora: usa a chave guardada da última vez, se houver.
      try {
        const guardado = JSON.parse(readFileSync(arquivoDecoder, "utf8"));
        if (guardado?.token) {
          log(`Sistema indisponível (${erro.message}); usando a chave guardada.`);
          return guardado.token;
        }
      } catch {
        // nada guardado
      }
      throw erro;
    }
  }

  async function ligar({ host, mac }) {
    const tokenDecoder = await cadastrar(host);
    envio = criarEnvio({
      servidor,
      token: tokenDecoder,
      arquivoFila: path.join(pasta, "fila-calx.jsonl"),
      log: (m) => log(`[envio] ${m}`),
    });
    instancia = await calxPro.iniciar(
      {
        modo: "cliente",
        host,
        // Com o MAC, o driver acha o IP de novo a cada conexão (DHCP muda).
        ...(mac ? { mac } : {}),
        porta: PORTA_CALX,
        pastaCapturas: path.join(pasta, "capturas"),
        pastaPassagens: path.join(pasta, "passagens"),
      },
      {
        emitir: envio.emitir,
        conectado: envio.conectado,
        erro: envio.erro,
        info: envio.info,
        log: (m) => log(`[calx-pro] ${m}`),
      },
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
        log(`Não consegui ligar o CalX Pro agora: ${erro.message}`);
      } finally {
        ocupado = false;
      }
    },
    async parar() {
      instancia?.parar();
      await envio?.parar();
    },
  };
}
