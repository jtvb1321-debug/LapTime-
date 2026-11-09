import { readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  criarAnalisadorCalx,
  criarLeitor,
  driver,
} from "../coletor/drivers/calx-pro.mjs";
import { alertaPlacaDoDecoder } from "../coletor/inventario.mjs";

// Gravação REAL do decoder (colunas separadas por TAB: hora ISO, origem,
// tamanho, hexadecimal, texto). Esperado: 16 leituras "@", 15 passagens (a
// leitura dupla do 727855 é ignorada), 3 por transponder.
const CAPTURA = readFileSync(
  path.join(__dirname, "fixtures", "calx-pro-captura-real.log"),
  "utf8",
);
const PEDACOS = CAPTURA.split("\n")
  .filter(Boolean)
  .map((linha) => {
    const [hora, , , hex] = linha.split("\t");
    return { chegadaMs: Date.parse(hora), bytes: Buffer.from(hex, "hex") };
  });

type Passagem = { transponder: string; instanteMs: number; eventoExterno: string };
type Info = Record<string, string | number>;

function ctxFalso() {
  const passagens: Passagem[] = [];
  const logs: string[] = [];
  const infos: Info[] = [];
  return {
    passagens,
    logs,
    infos,
    ctx: {
      emitir: (p: Passagem) => passagens.push(p),
      log: (m: string) => logs.push(m),
      info: (i: Info) => infos.push(i),
      conectado: () => undefined,
      erro: () => undefined,
    },
  };
}

const SEM_ARQUIVOS = { registrarPassagens: false, gravar: false };

describe("CalX Pro: captura real", () => {
  it("a fixture é a gravação esperada (16 leituras @)", () => {
    const leituras = PEDACOS.filter((p) =>
      p.bytes.includes(Buffer.from("\x01@")),
    ).length;
    expect(leituras).toBe(16);
  });

  it("15 passagens, 3 por transponder, leitura dupla ignorada", () => {
    const { passagens, logs, ctx } = ctxFalso();
    const ler = criarLeitor(SEM_ARQUIVOS, ctx);
    for (const p of PEDACOS) ler(p.bytes);
    expect(passagens).toHaveLength(15);
    const por = new Map<string, number>();
    for (const p of passagens) {
      por.set(p.transponder, (por.get(p.transponder) ?? 0) + 1);
    }
    expect([...por.keys()].sort()).toEqual(
      ["1246485", "1837094", "2888472", "396149", "727855"].sort(),
    );
    expect([...por.values()]).toEqual([3, 3, 3, 3, 3]);
    expect(
      logs.some((l) => l.includes("leitura dupla ignorada: transponder 727855")),
    ).toBe(true);
    // Repetição nunca vira passagem extra no servidor.
    expect(new Set(passagens.map((p) => p.eventoExterno)).size).toBe(15);
  });

  it("hora real coerente com a chegada e voltas de ~56-60 s", () => {
    const analisar = criarAnalisadorCalx();
    const instantes = new Map<string, number[]>();
    for (const p of PEDACOS) {
      for (const linha of p.bytes.toString("latin1").split(/\r?\n/)) {
        const r = analisar(linha, p.chegadaMs);
        if (r?.tipo !== "passagem" || !r.passagem) continue;
        const { instanteMs, transponder } = r.passagem;
        expect(Math.abs(instanteMs - p.chegadaMs)).toBeLessThan(100);
        const lista = instantes.get(transponder) ?? [];
        lista.push(instanteMs);
        instantes.set(transponder, lista);
      }
    }
    for (const [codigo, lista] of instantes) {
      if (codigo === "727855") lista.splice(1, 1); // leitura dupla
      for (let i = 1; i < lista.length; i++) {
        const volta = (lista[i] - lista[i - 1]) / 1000;
        expect(volta).toBeGreaterThan(50);
        expect(volta).toBeLessThan(65);
      }
    }
  });

  it("reinício do decoder (tempo voltando) recomeça a referência", () => {
    const analisar = criarAnalisadorCalx();
    const linha = (tempo: string) =>
      `\x01@\t03\t1\t111\t${tempo}\t5\t200\t2\txCALXPRO\r\n`;
    const a = analisar(linha("500.000"), 1_000_000_000_000);
    const b = analisar(linha("3.000"), 1_000_000_900_000); // decoder reiniciou
    expect(a?.tipo).toBe("passagem");
    expect(b?.tipo).toBe("passagem");
    expect(b?.passagem?.instanteMs).toBe(1_000_000_900_000);
  });

  it("reconhece() só com a marca xCALXPRO", () => {
    expect(
      driver.reconhece(Buffer.from("\x01$\t03\t1\t30\t0\txCALXPRO\r\n"), {}),
    ).toBe(true);
    expect(driver.reconhece(Buffer.from("qualquer outra coisa"), {})).toBe(
      false,
    );
  });

  it("driver lê a captura por TCP e relata ruído e última leitura", async () => {
    const servidor = net.createServer((socket) => {
      for (const p of PEDACOS) socket.write(p.bytes);
      setTimeout(() => socket.end(), 200);
    });
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    const porta = (servidor.address() as net.AddressInfo).port;
    const { passagens, infos, ctx } = ctxFalso();
    const instancia = await driver.iniciar(
      { modo: "cliente", host: "127.0.0.1", porta, ...SEM_ARQUIVOS },
      ctx,
    );
    await new Promise((r) => setTimeout(r, 800));
    instancia.parar();
    servidor.close();
    expect(passagens).toHaveLength(15);
    expect(infos.some((i) => typeof i.ruido === "number")).toBe(true);
    expect(infos.at(-1)?.ultimaPassagem).toBeDefined();
  });
});

describe("aviso da placa do decoder sem rede", () => {
  const adaptador = {
    chave: "usb:VID_2357&PID_0601",
    tipo: "usb",
    nome: "TP-Link",
  };
  const placa = (ip: string) => ({
    nome: "Ethernet 4",
    ip,
    mascara: "255.255.0.0",
    cidr: "",
  });

  it("avisa com o adaptador presente e IP 169.254.x", () => {
    const a = alertaPlacaDoDecoder([adaptador], [placa("169.254.10.2")]);
    expect(a?.chave).toBe("alerta:placa-decoder-sem-rede");
  });

  it("não avisa quando a placa já está em 192.168.137.x ou sem o adaptador", () => {
    expect(
      alertaPlacaDoDecoder([adaptador], [placa("192.168.137.1")]),
    ).toBeNull();
    expect(alertaPlacaDoDecoder([], [placa("169.254.1.1")])).toBeNull();
  });
});
