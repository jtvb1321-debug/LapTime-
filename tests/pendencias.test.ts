import { describe, expect, it } from "vitest";
import type { PilotoDaCorrida } from "@/lib/cronometragem/corridas-store";
import {
  pendenciasDoPiloto,
  pilotosComPendencia,
} from "@/lib/cronometragem/pendencias";

const base: PilotoDaCorrida = {
  id: "p1",
  nome: "Piloto Teste",
  capturaArmada: false,
  sensoresExtras: [],
  nomeado: true,
  vaga: false,
  termo: "valido",
  apto: true,
  penalidadeMs: 0,
  presenteEm: new Date(),
  kartNumero: "7",
  transponder: "S7",
};

const tipos = (p: Partial<PilotoDaCorrida>) =>
  pendenciasDoPiloto({ ...base, ...p }).map((x) => x.tipo);

describe("pendências para entrar na pista", () => {
  it("piloto completo não tem pendência", () => {
    expect(tipos({})).toEqual([]);
  });

  it("vaga aberta tem uma única pendência", () => {
    expect(tipos({ vaga: true })).toEqual(["vaga"]);
  });

  it("termo, check-in e kart aparecem na ordem do fluxo", () => {
    expect(
      tipos({
        termo: "pendente",
        presenteEm: undefined,
        kartNumero: undefined,
        transponder: undefined,
      }),
    ).toEqual(["termo", "checkin", "kart"]);
    expect(tipos({ termo: "sem_cadastro" })).toEqual(["termo"]);
  });

  it("kart sem sensor identificado é pendência própria", () => {
    expect(tipos({ transponder: undefined })).toEqual(["transponder"]);
  });

  it("pagamento só é pendência quando há cobrança acompanhada e não está pago", () => {
    expect(tipos({ pagamento: undefined })).toEqual([]);
    expect(
      tipos({
        pagamento: {
          situacao: "a_pagar",
          pagoCentavos: 0,
          formas: [],
        } as unknown as PilotoDaCorrida["pagamento"],
      }),
    ).toEqual(["pagamento"]);
    expect(
      tipos({
        pagamento: {
          situacao: "pago",
          pagoCentavos: 5000,
          formas: ["pix"],
        } as unknown as PilotoDaCorrida["pagamento"],
      }),
    ).toEqual([]);
  });

  it("lista só quem tem pendência", () => {
    const r = pilotosComPendencia([
      base,
      { ...base, id: "p2", termo: "pendente" },
    ]);
    expect(r.map((x) => x.piloto.id)).toEqual(["p2"]);
  });
});
