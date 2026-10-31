import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import {
  cancelarReserva,
  criarReserva,
  gerarGrade,
  lerAgendaDoDia,
  lerHorariosPublicos,
  lerReserva,
} from "@/lib/operacao/agenda-store";
import {
  abrirCaixa,
  caixaAberto,
  estornarPagamento,
  fecharCaixa,
  lerMovimentos,
  registrarPagamento,
  registrarSuprimentoOuSangria,
  resumoDoCaixa,
} from "@/lib/operacao/caixa-store";
import { buscarClientes, criarCliente } from "@/lib/operacao/clientes-store";
import { ErroNegocio } from "@/lib/operacao/erros";
import {
  ehDiaValido,
  hojeEmSaoPaulo,
  limitesDoDia,
  reaisParaCentavos,
  somarDias,
} from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

const ator = { usuarioId: "recepcao-1" };
// Amanhã: a bateria ainda não terminou, então aceita reservas.
const DIA = somarDias(hojeEmSaoPaulo(), 1);

async function erroDe(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroNegocio);
    return (erro as Error).message;
  }
  throw new Error("era esperado um ErroNegocio, mas nada foi lançado");
}

describe("datas e valores", () => {
  it("valida dias e calcula os limites do dia em horário de Brasília", () => {
    expect(ehDiaValido("2026-10-21")).toBe(true);
    expect(ehDiaValido("2026-02-30")).toBe(false);
    expect(ehDiaValido("21/10/2026")).toBe(false);
    const { inicio, fim } = limitesDoDia("2026-10-21");
    expect(inicio.toISOString()).toBe("2026-10-21T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-10-22T03:00:00.000Z");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("converte reais digitados em centavos", () => {
    expect(reaisParaCentavos("12,50")).toBe(1250);
    expect(reaisParaCentavos("12.5")).toBe(1250);
    expect(reaisParaCentavos("1.234,50")).toBe(123450);
    expect(reaisParaCentavos("80")).toBe(8000);
    expect(reaisParaCentavos("abc")).toBeNull();
    expect(reaisParaCentavos("")).toBeNull();
    expect(reaisParaCentavos("1,234")).toBeNull();
  });
});

describe("permissões do balcão", () => {
  it("recepção opera agenda e caixa, mas não estorna nem administra", () => {
    expect(pode("recepcao", "painel.acessar")).toBe(true);
    expect(pode("recepcao", "agenda.gerenciar")).toBe(true);
    expect(pode("recepcao", "cliente.gerenciar")).toBe(true);
    expect(pode("recepcao", "caixa.operar")).toBe(true);
    expect(pode("recepcao", "caixa.estornar")).toBe(false);
    expect(pode("recepcao", "usuario.administrar")).toBe(false);
    expect(pode("recepcao", "resultado.corrigir")).toBe(false);
  });
  it("só o admin estorna; piloto e operador não tocam no caixa", () => {
    expect(pode("admin", "caixa.estornar")).toBe(true);
    expect(pode("fiscal", "caixa.estornar")).toBe(false);
    expect(pode("operador", "caixa.operar")).toBe(false);
    expect(pode("piloto", "agenda.gerenciar")).toBe(false);
  });
});

describe.skipIf(!temBancoDeTeste)("agenda, reservas e caixa", () => {
  let remover: () => Promise<void>;
  let cliente1: string;
  let cliente2: string;
  const slots: string[] = [];

  beforeAll(async () => {
    ({ remover } = await criarEsquemaDeTeste());
    await migrar();
    cliente1 = (
      await criarCliente(
        { nome: "Maria Souza", telefone: "(11) 91234-5678" },
        ator,
      )
    ).id;
    cliente2 = (
      await criarCliente({ nome: "João Lima", telefone: "11 98888-7777" }, ator)
    ).id;
  });
  afterAll(async () => {
    await remover();
  });

  it("cadastra e busca clientes por nome ou telefone", async () => {
    expect((await buscarClientes("maria")).map((c) => c.id)).toEqual([
      cliente1,
    ]);
    expect((await buscarClientes("98888")).map((c) => c.id)).toEqual([
      cliente2,
    ]);
    expect(await buscarClientes("   ")).toEqual([]);
    expect(
      await erroDe(criarCliente({ nome: "X", telefone: "123" }, ator)),
    ).toMatch(/nome/i);
    expect(
      await erroDe(criarCliente({ nome: "Fulano", telefone: "123" }, ator)),
    ).toMatch(/telefone/i);
  });

  it("gera a grade do dia e não duplica ao gerar de novo", async () => {
    const grade = {
      dia: DIA,
      primeiraHora: "10:00",
      ultimaHora: "11:00",
      intervaloMin: 20,
      duracaoMin: 15,
      capacidade: 4,
      precoCentavos: 8000,
    };
    expect(await gerarGrade(grade, ator)).toBe(4);
    expect(await gerarGrade(grade, ator)).toBe(0);
    const agenda = await lerAgendaDoDia(DIA);
    expect(agenda).toHaveLength(4);
    expect(agenda[0].inicio.toISOString()).toBe(
      new Date(`${DIA}T10:00:00-03:00`).toISOString(),
    );
    slots.push(...agenda.map((s) => s.id));

    expect(
      await erroDe(gerarGrade({ ...grade, ultimaHora: "09:00" }, ator)),
    ).toMatch(/antes da primeira/);
    expect(await erroDe(gerarGrade({ ...grade, capacidade: 0 }, ator))).toMatch(
      /karts/,
    );
  });

  it("calcula o valor, aplica desconto e controla as vagas", async () => {
    const id = await criarReserva(
      {
        slotId: slots[0],
        clienteId: cliente1,
        pilotos: 3,
        descontoCentavos: 1000,
      },
      ator,
    );
    const r = await lerReserva(id);
    expect(r?.valorCentavos).toBe(3 * 8000 - 1000);
    expect(r?.pagoCentavos).toBe(0);

    expect(
      await erroDe(
        criarReserva(
          { slotId: slots[0], clienteId: cliente2, pilotos: 2 },
          ator,
        ),
      ),
    ).toMatch(/resta 1 vaga/);
    await criarReserva(
      { slotId: slots[0], clienteId: cliente2, pilotos: 1 },
      ator,
    );
    expect(
      await erroDe(
        criarReserva(
          { slotId: slots[0], clienteId: cliente2, pilotos: 1 },
          ator,
        ),
      ),
    ).toMatch(/lotada/);

    expect(
      await erroDe(
        criarReserva(
          {
            slotId: slots[1],
            clienteId: cliente1,
            pilotos: 1,
            descontoCentavos: 9000,
          },
          ator,
        ),
      ),
    ).toMatch(/desconto/i);
  });

  it("reservas simultâneas nunca passam da capacidade", async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        criarReserva(
          { slotId: slots[2], clienteId: cliente1, pilotos: 1 },
          ator,
        ),
      ),
    );
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    const agenda = await lerAgendaDoDia(DIA);
    expect(agenda.find((s) => s.id === slots[2])?.ocupadas).toBe(4);
  });

  it("o público vê horários e vagas, sem dado nenhum de cliente", async () => {
    const publico = await lerHorariosPublicos(DIA);
    expect(publico).toHaveLength(4);
    expect(publico.map((h) => h.vagas)).toEqual([0, 4, 0, 4]);
    expect(Object.keys(publico[0]).sort()).toEqual([
      "duracaoMin",
      "inicio",
      "precoCentavos",
      "vagas",
    ]);
  });

  it("sem caixa aberto não recebe pagamento", async () => {
    const agenda = await lerAgendaDoDia(DIA);
    const reserva = agenda[0].reservas[0];
    expect(
      await erroDe(
        registrarPagamento(
          { reservaId: reserva.id, forma: "dinheiro", valorCentavos: 1000 },
          ator,
        ),
      ),
    ).toMatch(/Abra o caixa/);
  });

  it("abre um único caixa por vez", async () => {
    expect(await caixaAberto()).toBeNull();
    await abrirCaixa(10000, ator);
    expect((await caixaAberto())?.fundoCentavos).toBe(10000);
    expect(await erroDe(abrirCaixa(5000, ator))).toMatch(
      /já existe um caixa aberto/i,
    );
  });

  it("pagamento parcial e total; não aceita mais que o saldo", async () => {
    const reserva = (await lerAgendaDoDia(DIA))[0].reservas[0]; // 23.000
    expect(reserva.valorCentavos).toBe(23000);

    await registrarPagamento(
      { reservaId: reserva.id, forma: "dinheiro", valorCentavos: 5000 },
      ator,
    );
    await registrarPagamento(
      { reservaId: reserva.id, forma: "pix", valorCentavos: 3000 },
      ator,
    );
    expect((await lerReserva(reserva.id))?.pagoCentavos).toBe(8000);

    expect(
      await erroDe(
        registrarPagamento(
          { reservaId: reserva.id, forma: "cartao", valorCentavos: 15001 },
          ator,
        ),
      ),
    ).toMatch(/maior que o saldo/);
    expect(
      await erroDe(
        registrarPagamento(
          { reservaId: reserva.id, forma: "cartao", valorCentavos: 0 },
          ator,
        ),
      ),
    ).toMatch(/maior que zero/);

    await registrarPagamento(
      { reservaId: reserva.id, forma: "cartao", valorCentavos: 15000 },
      ator,
    );
    expect((await lerReserva(reserva.id))?.pagoCentavos).toBe(23000);
    expect(
      await erroDe(
        registrarPagamento(
          { reservaId: reserva.id, forma: "dinheiro", valorCentavos: 100 },
          ator,
        ),
      ),
    ).toMatch(/já está paga/);
  });

  it("reserva paga não cancela; estorno libera o cancelamento e só vale uma vez", async () => {
    const reserva = (await lerAgendaDoDia(DIA))[0].reservas[0];
    expect(await erroDe(cancelarReserva(reserva.id, "desistiu", ator))).toMatch(
      /Estorne/,
    );

    const pagamento = (await lerMovimentos((await caixaAberto())!.id)).find(
      (m) => m.tipo === "pagamento" && m.forma === "dinheiro",
    )!;
    expect(
      await erroDe(
        estornarPagamento({ movimentoId: pagamento.id, motivo: "" }, ator),
      ),
    ).toMatch(/motivo/);
    await estornarPagamento(
      { movimentoId: pagamento.id, motivo: "cliente pagou errado" },
      ator,
    );
    expect(
      await erroDe(
        estornarPagamento(
          { movimentoId: pagamento.id, motivo: "de novo" },
          ator,
        ),
      ),
    ).toMatch(/já foi estornado/);
    expect((await lerReserva(reserva.id))?.pagoCentavos).toBe(23000 - 5000);
  });

  it("reserva sem pagamento cancela com motivo e devolve a vaga", async () => {
    const id = await criarReserva(
      { slotId: slots[1], clienteId: cliente2, pilotos: 2 },
      ator,
    );
    expect(await erroDe(cancelarReserva(id, " ", ator))).toMatch(/motivo/);
    await cancelarReserva(id, "cliente desistiu", ator);
    expect(await erroDe(cancelarReserva(id, "outra vez", ator))).toMatch(
      /já está cancelada/,
    );
    expect(
      await erroDe(
        registrarPagamento(
          { reservaId: id, forma: "pix", valorCentavos: 100 },
          ator,
        ),
      ),
    ).toMatch(/cancelada/);
    const agenda = await lerAgendaDoDia(DIA);
    expect(agenda.find((s) => s.id === slots[1])?.ocupadas).toBe(0);
  });

  it("o resumo do caixa bate: fundo + dinheiro líquido + suprimentos − sangrias", async () => {
    await registrarSuprimentoOuSangria(
      { tipo: "suprimento", valorCentavos: 1000, descricao: "mais troco" },
      ator,
    );
    await registrarSuprimentoOuSangria(
      { tipo: "sangria", valorCentavos: 2000, descricao: "levou ao cofre" },
      ator,
    );
    expect(
      await erroDe(
        registrarSuprimentoOuSangria(
          { tipo: "sangria", valorCentavos: 999999, descricao: "absurdo" },
          ator,
        ),
      ),
    ).toMatch(/maior que o dinheiro/);

    const resumo = await resumoDoCaixa((await caixaAberto())!);
    // dinheiro: 5000 recebido − 5000 estornado = 0; pix 3000; cartão 15000
    expect(resumo.recebido).toEqual({ dinheiro: 0, pix: 3000, cartao: 15000 });
    expect(resumo.totalRecebido).toBe(18000);
    expect(resumo.esperadoDinheiro).toBe(10000 + 0 + 1000 - 2000);
  });

  it("fechar exige o dinheiro contado e explica qualquer diferença", async () => {
    const caixa = (await caixaAberto())!;
    expect(
      await erroDe(
        fecharCaixa({ caixaId: caixa.id, contadoCentavos: 8000 }, ator),
      ),
    ).toMatch(/Explique a diferença/);

    const fechado = await fecharCaixa(
      {
        caixaId: caixa.id,
        contadoCentavos: 8000,
        observacao: "faltou troco de R$ 10",
      },
      ator,
    );
    expect(fechado.caixa.esperadoDinheiroCentavos).toBe(9000);
    expect(fechado.caixa.diferencaCentavos).toBe(-1000);
    expect(fechado.caixa.fechadoEm).not.toBeNull();
    expect(await caixaAberto()).toBeNull();

    expect(
      await erroDe(
        fecharCaixa({ caixaId: caixa.id, contadoCentavos: 9000 }, ator),
      ),
    ).toMatch(/já foi fechado/);
    expect(
      await erroDe(
        registrarSuprimentoOuSangria(
          {
            tipo: "suprimento",
            valorCentavos: 100,
            descricao: "depois de fechar",
          },
          ator,
        ),
      ),
    ).toMatch(/Abra o caixa/);
  });

  it("movimentos de caixa não podem ser alterados nem apagados", async () => {
    await expect(
      consultar("update caixa_movimento set valor_centavos = 1"),
    ).rejects.toThrow(/somente de inclusão/);
    await expect(consultar("delete from caixa_movimento")).rejects.toThrow(
      /somente de inclusão/,
    );
  });

  it("toda operação de dinheiro deixa rastro na auditoria", async () => {
    const acoes = await consultar<{ acao: string; n: number }>(
      `select acao, count(*)::int as n from audit_log
        where acao like 'caixa.%' or acao like 'reserva.%' group by acao`,
    );
    const mapa = Object.fromEntries(acoes.map((a) => [a.acao, a.n]));
    expect(mapa["caixa.abrir"]).toBe(1);
    expect(mapa["caixa.fechar"]).toBe(1);
    expect(mapa["caixa.pagamento"]).toBe(3);
    expect(mapa["caixa.estorno"]).toBe(1);
    expect(mapa["caixa.sangria"]).toBe(1);
    expect(mapa["reserva.cancelar"]).toBe(1);
  });
});
