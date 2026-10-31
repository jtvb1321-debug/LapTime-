import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { criarReserva, gerarGrade } from "@/lib/operacao/agenda-store";
import {
  abrirCaixa,
  estornarPagamento,
  fecharCaixa,
  lerMovimentos,
  caixaAberto,
  registrarPagamento,
  registrarSuprimentoOuSangria,
} from "@/lib/operacao/caixa-store";
import {
  aniversariantesDoMes,
  atualizarCliente,
  clientesSumidos,
  criarCliente,
  lerClienteComResumo,
  lerVisitasDoCliente,
  listarClientesComResumo,
} from "@/lib/operacao/clientes-store";
import { ErroNegocio } from "@/lib/operacao/erros";
import {
  cancelarConta,
  criarConta,
  fluxoDoMes,
  listarContas,
  pagarConta,
} from "@/lib/operacao/financeiro-store";
import {
  lerPagamentosDaReserva,
  relatorioDoDia,
} from "@/lib/operacao/relatorios-store";
import {
  clientesComTermoValido,
  publicarTermo,
  registrarAceite,
  situacaoDoTermo,
  termoAtual,
} from "@/lib/operacao/termo-store";
import {
  hojeEmSaoPaulo,
  idadeEm,
  mesAtual,
  somarDias,
  somarMeses,
  somarMesesAoDia,
} from "@/lib/operacao/tempo";
import { linkWhatsApp } from "@/lib/operacao/whatsapp";
import { pode } from "@/lib/permissoes";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

const ator = { usuarioId: "admin-1" };
const HOJE = hojeEmSaoPaulo();
const AMANHA = somarDias(HOJE, 1);

async function erroDe(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroNegocio);
    return (erro as Error).message;
  }
  throw new Error("era esperado um ErroNegocio");
}

describe("datas, meses e WhatsApp", () => {
  it("soma meses sem estourar o fim do mês", () => {
    expect(somarMeses("2026-11", 2)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarMesesAoDia("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMesesAoDia("2024-01-31", 1)).toBe("2024-02-29");
    expect(somarMesesAoDia("2026-10-15", 3)).toBe("2027-01-15");
  });
  it("calcula a idade", () => {
    expect(idadeEm("2010-10-21", "2026-10-20")).toBe(15);
    expect(idadeEm("2010-10-20", "2026-10-20")).toBe(16);
  });
  it("monta o link do WhatsApp com DDI e mensagem codificada", () => {
    expect(linkWhatsApp("(11) 91234-5678", "Olá, João!")).toBe(
      "https://wa.me/5511912345678?text=Ol%C3%A1%2C%20Jo%C3%A3o!",
    );
    expect(linkWhatsApp("+55 11 91234-5678", "oi")).toContain(
      "wa.me/5511912345678",
    );
  });
  it("só o admin edita o termo e vê o financeiro", () => {
    expect(pode("admin", "termo.editar")).toBe(true);
    expect(pode("admin", "financeiro.gerenciar")).toBe(true);
    expect(pode("recepcao", "termo.editar")).toBe(false);
    expect(pode("recepcao", "financeiro.gerenciar")).toBe(false);
    expect(pode("fiscal", "financeiro.gerenciar")).toBe(false);
  });
});

describe.skipIf(!temBancoDeTeste)(
  "termo, histórico, relatórios e financeiro",
  () => {
    let remover: () => Promise<void>;
    let maria: string;
    let joao: string;
    let slotId: string;
    let reservaId: string;

    beforeAll(async () => {
      ({ remover } = await criarEsquemaDeTeste());
      await migrar();
      maria = (
        await criarCliente(
          {
            nome: "Maria Souza",
            telefone: "(11) 91234-5678",
            nascimento: "1990-10-25",
          },
          ator,
        )
      ).id;
      joao = (
        await criarCliente(
          { nome: "João Lima", telefone: "11 98888-7777" },
          ator,
        )
      ).id;
      await gerarGrade(
        {
          dia: AMANHA,
          primeiraHora: "10:00",
          ultimaHora: "10:00",
          intervaloMin: 20,
          duracaoMin: 15,
          capacidade: 6,
          precoCentavos: 8000,
        },
        ator,
      );
      [{ id: slotId }] = await consultar<{ id: string }>(
        "select id from bateria_slot",
      );
      reservaId = await criarReserva(
        { slotId, clienteId: maria, pilotos: 2 },
        ator,
      );
    });
    afterAll(async () => {
      await remover();
    });

    it("valida e atualiza os dados do cliente (com auditoria)", async () => {
      expect(
        await erroDe(
          criarCliente(
            {
              nome: "Fulano",
              telefone: "11 90000-0000",
              nascimento: "2999-01-01",
            },
            ator,
          ),
        ),
      ).toMatch(/nascimento/);
      await atualizarCliente(
        joao,
        {
          telefone: "11 98888-7777",
          email: "joao@exemplo.com",
          nascimento: "2012-03-09",
        },
        ator,
      );
      const c = await lerClienteComResumo(joao);
      expect(c?.email).toBe("joao@exemplo.com");
      expect(c?.nascimento).toBe("2012-03-09");
      expect(
        await erroDe(
          atualizarCliente(joao, { telefone: "1", email: "" }, ator),
        ),
      ).toMatch(/telefone/i);
      const [{ n }] = await consultar<{ n: number }>(
        "select count(*)::int as n from audit_log where acao = 'cliente.atualizar'",
      );
      expect(n).toBe(1);
    });

    it("termo: modelo inicial, aceite, não duplica, nova versão exige nova assinatura", async () => {
      const v1 = await termoAtual();
      expect(v1.versao).toBe(1);
      expect((await situacaoDoTermo(maria)).situacao).toBe("pendente");
      expect((await clientesComTermoValido([maria, joao])).size).toBe(0);

      expect(
        await erroDe(
          registrarAceite(
            { clienteId: maria, assinante: "A", porMenor: false },
            ator,
          ),
        ),
      ).toMatch(/nome completo/);
      await registrarAceite(
        { clienteId: maria, assinante: "Maria Souza", porMenor: false },
        ator,
      );
      const s = await situacaoDoTermo(maria);
      expect(s.situacao).toBe("valido");
      expect([...(await clientesComTermoValido([maria, joao]))]).toEqual([
        maria,
      ]);
      expect(
        await erroDe(
          registrarAceite(
            { clienteId: maria, assinante: "Maria Souza", porMenor: false },
            ator,
          ),
        ),
      ).toMatch(/já tem um termo válido/);

      // Menor de idade: o responsável assina.
      await registrarAceite(
        { clienteId: joao, assinante: "Pai do João", porMenor: true },
        ator,
      );
      const [aceite] = await consultar<{ por_menor: boolean }>(
        "select por_menor from termo_aceite where cliente_id = $1",
        [joao],
      );
      expect(aceite.por_menor).toBe(true);

      // Texto novo = versão 2 → todos precisam assinar de novo.
      expect(await erroDe(publicarTermo("curto", ator))).toMatch(
        /curto demais/,
      );
      const v2 = await publicarTermo("Novo termo. ".repeat(20), ator);
      expect(v2.versao).toBe(2);
      expect((await termoAtual()).id).toBe(v2.id);
      expect((await situacaoDoTermo(maria)).situacao).toBe("desatualizado");
      expect((await clientesComTermoValido([maria, joao])).size).toBe(0);
      await registrarAceite(
        { clienteId: maria, assinante: "Maria Souza", porMenor: false },
        ator,
      );
      expect((await situacaoDoTermo(maria)).situacao).toBe("valido");
    });

    it("termo vence depois de um ano", async () => {
      await consultar(
        "alter table termo_aceite disable trigger termo_aceite_sem_alteracao",
      );
      await consultar(
        "update termo_aceite set aceito_em = now() - interval '400 days' where cliente_id = $1",
        [maria],
      );
      await consultar(
        "alter table termo_aceite enable trigger termo_aceite_sem_alteracao",
      );
      expect((await situacaoDoTermo(maria)).situacao).toBe("vencido");
      await registrarAceite(
        { clienteId: maria, assinante: "Maria Souza", porMenor: false },
        ator,
      );
      expect((await situacaoDoTermo(maria)).situacao).toBe("valido");
    });

    it("termos e aceites não podem ser alterados nem apagados", async () => {
      await expect(
        consultar("update termo_versao set texto = 'x'"),
      ).rejects.toThrow(/somente de inclusão/);
      await expect(consultar("delete from termo_aceite")).rejects.toThrow(
        /somente de inclusão/,
      );
    });

    it("relatório do dia e recibo refletem pagamentos, estorno, sangria e operadores", async () => {
      await abrirCaixa(10000, { usuarioId: "recepcao-1" });
      await registrarPagamento(
        { reservaId, forma: "dinheiro", valorCentavos: 6000 },
        { usuarioId: "recepcao-1" },
      );
      await registrarPagamento(
        { reservaId, forma: "pix", valorCentavos: 10000 },
        { usuarioId: "recepcao-2" },
      );
      const mov = (await lerMovimentos((await caixaAberto())!.id)).find(
        (m) => m.forma === "pix",
      )!;
      await estornarPagamento(
        { movimentoId: mov.id, motivo: "pix devolvido" },
        ator,
      );
      await registrarSuprimentoOuSangria(
        { tipo: "sangria", valorCentavos: 3000, descricao: "cofre" },
        ator,
      );

      const r = await relatorioDoDia(HOJE);
      expect(r.recebido).toEqual({ dinheiro: 6000, pix: 0, cartao: 0 });
      expect(r.totalRecebido).toBe(6000);
      expect(r.pagamentos).toEqual({ quantidade: 2, centavos: 16000 });
      expect(r.estornos).toEqual({ quantidade: 1, centavos: 10000 });
      expect(r.sangriasCentavos).toBe(3000);
      expect(
        r.porOperador.map((o) => [o.operador, o.recebidoCentavos]),
      ).toEqual(
        [
          ["recepcao-1", 6000],
          ["admin-1", -10000],
          ["recepcao-2", 10000],
        ].sort((a, b) => (b[1] as number) - (a[1] as number)),
      );

      const amanha = await relatorioDoDia(AMANHA);
      expect(amanha.reservas).toEqual({
        ativas: 1,
        canceladas: 0,
        pilotos: 2,
        valorCentavos: 16000,
      });
      expect(amanha.baterias).toEqual({ total: 1, capacidade: 6 });

      const pagamentos = await lerPagamentosDaReserva(reservaId);
      expect(pagamentos.map((p) => p.tipo)).toEqual([
        "pagamento",
        "pagamento",
        "estorno",
      ]);

      const caixa = (await caixaAberto())!;
      await fecharCaixa(
        { caixaId: caixa.id, contadoCentavos: 13000 },
        { usuarioId: "recepcao-1" },
      );
      const depois = await relatorioDoDia(HOJE);
      expect(depois.caixasFechados).toHaveLength(1);
      expect(depois.caixasFechados[0].diferencaCentavos).toBe(0);
    });

    it("histórico: visitas, gasto líquido, listagem e busca", async () => {
      const m = await lerClienteComResumo(maria);
      // A bateria é amanhã: ainda não conta como visita.
      expect(m?.visitas).toBe(0);
      expect(m?.gastoCentavos).toBe(6000);
      const visitas = await lerVisitasDoCliente(maria);
      expect(visitas).toHaveLength(1);
      expect(visitas[0]).toMatchObject({
        pilotos: 2,
        valorCentavos: 16000,
        pagoCentavos: 6000,
      });
      expect((await listarClientesComResumo("souza")).map((c) => c.id)).toEqual(
        [maria],
      );
      expect(await listarClientesComResumo("")).toHaveLength(2);
    });

    it("relacionamento: aniversariantes do mês e clientes sumidos", async () => {
      expect((await aniversariantesDoMes(10)).map((c) => c.id)).toEqual([
        maria,
      ]);
      expect((await aniversariantesDoMes(3)).map((c) => c.id)).toEqual([joao]);
      expect(await aniversariantesDoMes(7)).toEqual([]);

      // Dá uma visita antiga ao João (bateria de 60 dias atrás).
      await consultar(
        `insert into bateria_slot (id, inicio, duracao_min, capacidade, preco_centavos)
       values ('bat-antiga', now() - interval '60 days', 15, 6, 8000)`,
      );
      await consultar(
        `insert into reserva (id, slot_id, cliente_id, pilotos, valor_centavos)
       values ('res-antiga', 'bat-antiga', $1, 1, 8000)`,
        [joao],
      );
      expect((await clientesSumidos(30)).map((c) => c.id)).toEqual([joao]);
      expect(await clientesSumidos(90)).toEqual([]);
    });

    it("contas a pagar: cria, repete por mês, paga, cancela e marca vencidas", async () => {
      const mes = mesAtual();
      expect(
        await erroDe(
          criarConta(
            {
              descricao: "ab",
              categoria: "Aluguel",
              valorCentavos: 100,
              vencimento: `${mes}-10`,
            },
            ator,
          ),
        ),
      ).toMatch(/Descreva/);
      expect(
        await erroDe(
          criarConta(
            {
              descricao: "Aluguel",
              categoria: "Inventada",
              valorCentavos: 100,
              vencimento: `${mes}-10`,
            },
            ator,
          ),
        ),
      ).toMatch(/categoria/);

      const criadas = await criarConta(
        {
          descricao: "Aluguel do galpão",
          categoria: "Aluguel",
          valorCentavos: 500000,
          vencimento: `${mes}-28`,
          repetirMeses: 3,
        },
        ator,
      );
      expect(criadas).toBe(3);
      const doMes = await listarContas(mes);
      const aluguel = doMes.find(
        (c) => c.descricao === "Aluguel do galpão (1/3)",
      )!;
      expect(
        aluguel.situacao === "aberta" || aluguel.situacao === "vencida",
      ).toBe(true);
      const proximo = await listarContas(somarMeses(mes, 1));
      expect(
        proximo.some((c) => c.descricao === "Aluguel do galpão (2/3)"),
      ).toBe(true);

      await pagarConta(aluguel.id, "pix", ator);
      expect(await erroDe(pagarConta(aluguel.id, "pix", ator))).toMatch(
        /já foi paga/,
      );
      expect(await erroDe(cancelarConta(aluguel.id, "engano", ator))).toMatch(
        /já paga/,
      );

      await criarConta(
        {
          descricao: "Energia",
          categoria: "Energia",
          valorCentavos: 120000,
          vencimento: somarDias(HOJE, -5),
        },
        ator,
      );
      const energia = (await listarContas(mes)).find(
        (c) => c.descricao === "Energia",
      )!;
      expect(energia.situacao).toBe("vencida");
      await cancelarConta(energia.id, "lançada em duplicidade", ator);
      expect(await erroDe(pagarConta(energia.id, "pix", ator))).toMatch(
        /cancelada/,
      );
      expect(await erroDe(cancelarConta(energia.id, "", ator))).toMatch(
        /motivo/,
      );
    });

    it("fluxo de caixa do mês: entradas, saídas pagas, resultado e pendências", async () => {
      const mes = mesAtual();
      await criarConta(
        {
          descricao: "Internet",
          categoria: "Internet e telefone",
          valorCentavos: 15000,
          vencimento: somarDias(HOJE, -2),
        },
        ator,
      );
      const fluxo = await fluxoDoMes(mes);
      expect(fluxo.entradas.dinheiro).toBe(6000);
      expect(fluxo.entradas.totalCentavos).toBe(6000);
      expect(fluxo.entradas.porDia).toEqual([{ dia: HOJE, centavos: 6000 }]);
      // Só o aluguel (R$ 5.000) foi pago.
      expect(fluxo.saidasPagas.totalCentavos).toBe(500000);
      expect(fluxo.saidasPagas.porCategoria).toEqual([
        { categoria: "Aluguel", centavos: 500000 },
      ]);
      expect(fluxo.resultadoCentavos).toBe(6000 - 500000);
      // Internet vencida (R$ 150) está em aberto e atrasada; o cancelado não conta.
      expect(fluxo.atrasadas).toEqual({ quantidade: 1, centavos: 15000 });
    });

    it("toda mudança de dinheiro, termo e contas fica na auditoria", async () => {
      const linhas = await consultar<{ acao: string }>(
        "select distinct acao from audit_log order by acao",
      );
      const acoes = linhas.map((l) => l.acao);
      for (const esperada of [
        "termo.aceite",
        "termo.publicar",
        "conta.criar",
        "conta.pagar",
        "conta.cancelar",
        "cliente.atualizar",
      ]) {
        expect(acoes).toContain(esperada);
      }
    });
  },
);
