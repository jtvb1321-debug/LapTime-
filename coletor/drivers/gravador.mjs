import { createWriteStream, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";

// Não interpreta nada: conecta no decoder e GRAVA os bytes que chegam (hora,
// hexadecimal e texto) num arquivo. Serve para estudar o protocolo de um
// decoder novo — o arquivo é a base para escrever um driver de verdade.
//
// Só recebe, nunca envia. Mesmo assim, decoders que aceitam um programa por
// vez podem recusar o LapTime enquanto o gravador estiver conectado: use com
// o outro programa fechado e fora de corrida.
export const driver = {
  id: "gravador",
  nome: "Gravador (só para estudar um protocolo)",
  portasComuns: [],

  reconhece() {
    return false;
  },

  async iniciar(config, ctx) {
    const pasta = config.pastaCapturas ?? path.join("coletor", "capturas");
    mkdirSync(pasta, { recursive: true });
    const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
    const arquivo = path.join(
      pasta,
      `${String(config.host).replace(/[^\w.-]/g, "_")}-${config.porta}-${carimbo}.log`,
    );
    const saida = createWriteStream(arquivo, { flags: "a" });
    ctx.log(`gravando em ${arquivo}`);

    const socket = net.connect({ host: config.host, port: config.porta });
    socket.on("connect", () => {
      ctx.conectado(true);
      ctx.log(
        "conectado; gravando o que o decoder enviar (Ctrl+C para parar).",
      );
    });
    socket.on("data", (pedaco) => {
      const texto = pedaco.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
      saida.write(
        `${new Date().toISOString()}\t${pedaco.toString("hex")}\t${texto}\n`,
      );
    });
    socket.on("error", (e) => {
      ctx.log(`erro de conexão: ${e.message}`);
      ctx.erro?.(`${config.host}:${config.porta}: ${e.message}`);
    });
    socket.on("close", () => {
      ctx.conectado(false);
      ctx.log("conexão encerrada.");
    });

    return {
      parar() {
        socket.destroy();
        saida.end();
      },
    };
  },
};
