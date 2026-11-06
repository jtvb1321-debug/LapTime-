import { beforeEach, describe, expect, it, vi } from "vitest";

// Nada de disco: o estado da demonstração e da simulação só vive em memória.
vi.mock("node:fs", () => ({
  default: {
    readFileSync: () => {
      throw new Error("sem arquivo");
    },
    writeFileSync: () => undefined,
    mkdirSync: () => undefined,
    rmSync: () => undefined,
  },
}));

import {
  controlarDemoCorrida,
  lerPainelDemo,
  limparDemoCorrida,
  sincronizarDemoCorrida,
} from "@/lib/demo-corrida";
import { baterias, getResultadosPorBateria } from "@/lib/mock/data";

const final = () => baterias.find((b) => b.id === "bat-2-final")!;

describe("corrida de demonstração", () => {
  beforeEach(() => {
    vi.useRealTimers();
    controlarDemoCorrida("padrao");
  });

  it("cenário padrão: final ao vivo na volta 9", () => {
    expect(final().status).toBe("ao_vivo");
    expect(lerPainelDemo().fase).toBe("padrao");
  });

  it("grid: largada na ordem da classificatória, sem pontos nem volta", () => {
    controlarDemoCorrida("grid");
    expect(final().status).toBe("grid");
    const linhas = getResultadosPorBateria("bat-2-final");
    expect(linhas[0].pilotoId).toBe("pil-bruno"); // pole da classificatória
    expect(linhas.every((l) => l.pontos === 0)).toBe(true);
    expect(linhas.every((l) => l.voltaAtual === undefined)).toBe(true);
  });

  it("correndo: volta e posições avançam com o relógio", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    controlarDemoCorrida("iniciar");
    expect(final().status).toBe("ao_vivo");
    expect(lerPainelDemo().voltaDoLider).toBe(1);

    vi.setSystemTime(new Date("2026-11-06T12:01:00Z")); // 60 s = ~5 voltas
    sincronizarDemoCorrida();
    const meio = getResultadosPorBateria("bat-2-final");
    expect(meio[0].voltaAtual).toBeGreaterThan(3);
    expect(meio[0].voltaAtual).toBeLessThan(10);
    expect(meio[0].gapMs).toBe(0);
    expect(meio.map((r) => r.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("pausar congela, retomar continua, velocidade 2x acelera", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    controlarDemoCorrida("iniciar");
    vi.setSystemTime(new Date("2026-11-06T12:00:30Z"));
    controlarDemoCorrida("pausar");
    const antes = lerPainelDemo().voltaDoLider;
    vi.setSystemTime(new Date("2026-11-06T12:05:00Z"));
    expect(lerPainelDemo().voltaDoLider).toBe(antes);
    expect(lerPainelDemo().fase).toBe("pausada");

    controlarDemoCorrida("retomar");
    controlarDemoCorrida("velocidade-4");
    vi.setSystemTime(new Date("2026-11-06T12:05:30Z"));
    expect(lerPainelDemo().voltaDoLider).toBeGreaterThan(antes);
  });

  it("termina sozinha e encerrar mostra o resultado final com pontos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    controlarDemoCorrida("iniciar");
    vi.setSystemTime(new Date("2026-11-06T12:10:00Z"));
    sincronizarDemoCorrida();
    expect(final().status).toBe("encerrada");
    const linhas = getResultadosPorBateria("bat-2-final");
    expect(linhas.map((l) => l.pontos)).toEqual([
      25, 20, 16, 13, 11, 10, 9, 8, 7, 6,
    ]);
    expect(linhas.every((l) => l.voltaAtual === 15)).toBe(true);

    controlarDemoCorrida("grid"); // recomeçar do zero
    expect(final().status).toBe("grid");
  });

  it("encerrar à força e limpar voltam ao padrão sem sujar as constantes", () => {
    controlarDemoCorrida("iniciar");
    controlarDemoCorrida("encerrar");
    expect(final().status).toBe("encerrada");
    controlarDemoCorrida("padrao");
    limparDemoCorrida();
    expect(final().status).toBe("ao_vivo");
    expect(getResultadosPorBateria("bat-2-final")[0].voltaAtual).toBe(9);
  });
});
