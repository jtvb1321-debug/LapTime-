import net from "node:net";
import { converterTempo } from "./tempo.mjs";

// Driver genérico para decoders que mandam uma passagem por linha de texto
// numa conexão TCP (ou por um conversor serial→rede). Você diz como a linha é
// com uma expressão regular de grupos nomeados:
//
//   "formato": "(?<transponder>\\d+);(?<tempo>[\\d.]+)"
//   "unidadeTempo": "s"          // ms | s | us | iso | hhmmss (padrão: ms)
//
// Grupos reconhecidos: transponder (obrigatório), tempo, forca. Sem o grupo
// "tempo", a passagem leva a hora em que o coletor a recebeu.
/**
 * @param {{ formato?: string, unidadeTempo?: string }} config
 * @returns {(linha: string) => { transponder: string, bruto: string, instanteMs?: number, forca?: number } | null}
 */
export function criarAnalisador(config) {
  if (!config.formato) {
    throw new Error(
      'linhas-tcp: informe "formato" (expressão regular com o grupo nomeado transponder).',
    );
  }
  if (!config.formato.includes("(?<transponder>")) {
    throw new Error(
      'linhas-tcp: "formato" precisa ter o grupo (?<transponder>...).',
    );
  }
  const re = new RegExp(config.formato);
  const unidade = config.unidadeTempo ?? "ms";

  return function analisar(linha) {
    const m = re.exec(linha);
    const g = m?.groups;
    if (!g?.transponder) return null;
    const passagem = { transponder: g.transponder, bruto: linha.slice(0, 400) };
    if (g.tempo !== undefined) {
      const t = converterTempo(g.tempo, unidade);
      if (t !== null) passagem.instanteMs = t;
    }
    if (g.forca !== undefined && /^\d+$/.test(g.forca)) {
      passagem.forca = Number(g.forca);
    }
    return passagem;
  };
}

export const driver = {
  id: "linhas-tcp",
  nome: "Texto por TCP (genérico)",
  portasComuns: [],

  // Usado na busca: só olha os bytes que chegaram, nunca envia nada.
  reconhece(bytes, config) {
    if (!config?.formato) return false;
    const analisar = criarAnalisador(config);
    return bytes
      .toString("latin1")
      .split(/\r?\n/)
      .some((linha) => analisar(linha) !== null);
  },

  async iniciar(config, ctx) {
    const analisar = criarAnalisador(config);
    let parado = false;
    let socket = null;
    let espera = 2000;

    const conectar = () => {
      if (parado) return;
      ctx.log(`conectando em ${config.host}:${config.porta}…`);
      let resto = "";
      let ignoradas = 0;
      socket = net.connect({ host: config.host, port: config.porta });
      socket.setKeepAlive(true, 10_000);

      socket.on("connect", () => {
        espera = 2000;
        ctx.conectado(true);
        ctx.log("conectado ao decoder.");
      });
      socket.on("data", (pedaco) => {
        resto += pedaco.toString("latin1");
        if (resto.length > 65_536) resto = resto.slice(-4096);
        const linhas = resto.split(/\r?\n/);
        resto = linhas.pop() ?? "";
        for (const linha of linhas) {
          if (!linha.trim()) continue;
          const p = analisar(linha);
          if (p) ctx.emitir(p);
          else if (ignoradas++ < 5)
            ctx.log(`linha ignorada: ${linha.slice(0, 80)}`);
        }
      });
      socket.on("error", (e) => {
        ctx.log(`erro de conexão: ${e.message}`);
        ctx.erro?.(`${config.host}:${config.porta}: ${e.message}`);
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
      },
    };
  },
};
