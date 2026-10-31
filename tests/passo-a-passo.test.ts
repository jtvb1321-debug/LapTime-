import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cancelarCorrida,
  criarCorrida,
  finalizarCorrida,
  iniciarCorrida,
} from "@/lib/cronometragem/corridas-store";
import {
  bateriaEmFoco,
  passosDoFluxo,
  type DadosDaBateria,
} from "@/lib/cronometragem/passo-a-passo";
import { migrar } from "@/lib/db/migrar";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

function bateria(parcial: Partial<DadosDaBateria> = {}): DadosDaBateria {
  return {
    corridaId: "c1",
    nome: "Bateria 10:00",
    fase: "classificacao",
    estado: "preparada",
    pilotos: 0,
    vagas: 0,
    comTermo: 0,
    comKart: 0,
    comCobranca: 0,
    pagos: 0,
    ...parcial,
  };
}

const situacoes = (d: DadosDaBateria) =>
  Object.fromEntries(passosDoFluxo(d).passos.map((p) => [p.chave, p.situacao]));
const proximo = (d: DadosDaBateria) => passosDoFluxo(d).proximo?.chave;

describe("passo a passo do balcão (o que falta fazer)", () => {
  it("bateria vazia: o primeiro passo é cadastrar os pilotos", () => {
    const d = bateria();
    expect(proximo(d)).toBe("pilotos");
    expect(situacoes(d)).toMatchObject({
      pilotos: "agora",
      pagamento: "opcional",
      termos: "pendente",
      karts: "pendente",
      iniciar: "pendente",
    });
  });

  it("vaga aberta da reserva ainda é o passo dos pilotos", () => {
    const d = bateria({ pilotos: 2, vagas: 1 });
    expect(proximo(d)).toBe("pilotos");
    expect(passosDoFluxo(d).passos[0].detalhe).toMatch(/1 vaga aberta/);
  });

  it("pagamento é opcional: não é o próximo passo nem impede de seguir", () => {
    const d = bateria({ pilotos: 3, comCobranca: 3, pagos: 0 });
    expect(proximo(d)).toBe("termos");
    expect(situacoes(d).pagamento).toBe("opcional");
    expect(passosDoFluxo(d).passos[1].detalhe).toMatch(/0 de 3 pago/);
    expect(
      situacoes(bateria({ pilotos: 3, comCobranca: 3, pagos: 3 })).pagamento,
    ).toBe("feito");
  });

  it("termos e karts, nessa ordem; só então iniciar", () => {
    expect(proximo(bateria({ pilotos: 3, comTermo: 2 }))).toBe("termos");
    expect(proximo(bateria({ pilotos: 3, comTermo: 3, comKart: 1 }))).toBe(
      "karts",
    );
    const pronto = bateria({ pilotos: 3, comTermo: 3, comKart: 3 });
    expect(proximo(pronto)).toBe("iniciar");
    expect(situacoes(pronto)).toMatchObject({
      pilotos: "feito",
      termos: "feito",
      karts: "feito",
      iniciar: "agora",
    });
  });

  it("classificação ao vivo e depois criar a corrida", () => {
    const aoVivo = bateria({
      estado: "em_andamento",
      pilotos: 2,
      comTermo: 2,
      comKart: 2,
    });
    expect(proximo(aoVivo)).toBe("ao-vivo");
    const fim = bateria({
      estado: "finalizada",
      pilotos: 2,
      comTermo: 2,
      comKart: 2,
    });
    expect(proximo(fim)).toBe("criar-corrida");
    expect(passosDoFluxo(fim).proximo?.acao).toBe("Criar a corrida");

    // corrida criada: o próximo é a corrida; no fim, os relatórios
    const comCorrida = bateria({
      estado: "finalizada",
      pilotos: 2,
      comTermo: 2,
      comKart: 2,
      corrida: { id: "c2", estado: "preparada" },
    });
    expect(proximo(comCorrida)).toBe("corrida");
    expect(passosDoFluxo(comCorrida).proximo?.href).toBe(
      "/admin/cronometragem/corridas/c2",
    );
    const tudo = bateria({
      estado: "finalizada",
      pilotos: 2,
      comTermo: 2,
      comKart: 2,
      corrida: { id: "c2", estado: "finalizada" },
    });
    expect(proximo(tudo)).toBe("relatorios");
  });

  it("na corrida o grid já vem da classificação; no fim, relatórios", () => {
    const corrida = bateria({
      fase: "corrida",
      pilotos: 2,
      comTermo: 2,
      comKart: 2,
    });
    expect(situacoes(corrida).grid).toBe("feito");
    expect(proximo(corrida)).toBe("iniciar");
    expect(proximo({ ...corrida, estado: "em_andamento" })).toBe("ao-vivo");
    expect(proximo({ ...corrida, estado: "finalizada" })).toBe("relatorios");
  });

  it("corrida única (sem classificação): termina nos relatórios", () => {
    const unica = bateria({
      fase: "unica",
      estado: "finalizada",
      pilotos: 2,
      comTermo: 2,
      comKart: 2,
    });
    expect(proximo(unica)).toBe("relatorios");
    expect(
      passosDoFluxo(unica).passos.some((p) => p.chave === "criar-corrida"),
    ).toBe(false);
  });
});

describe.skipIf(!temBancoDeTeste)("qual bateria acompanhar", () => {
  let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
  const ator = { usuarioId: "balcao-1" };

  beforeAll(async () => {
    banco = await criarEsquemaDeTeste();
    await migrar();
  });
  afterAll(async () => {
    await banco.remover();
  });

  it("em andamento > em preparação (a mais nova) > classificação sem corrida > última finalizada", async () => {
    expect(await bateriaEmFoco()).toBeNull();

    const a = await criarCorrida({ nome: "Bateria A" }, ator);
    expect(await bateriaEmFoco()).toBe(a);
    const b = await criarCorrida({ nome: "Bateria B" }, ator);
    expect(await bateriaEmFoco()).toBe(b);

    await iniciarCorrida(a, ator);
    expect(await bateriaEmFoco()).toBe(a);
    await finalizarCorrida(a, ator);
    expect(await bateriaEmFoco()).toBe(b);

    await cancelarCorrida(b, "teste", ator);
    expect(await bateriaEmFoco()).toBe(a);

    const q = await criarCorrida(
      { nome: "Quali", fase: "classificacao" },
      ator,
    );
    await iniciarCorrida(q, ator);
    await finalizarCorrida(q, ator);
    expect(await bateriaEmFoco()).toBe(q);
  });
});
