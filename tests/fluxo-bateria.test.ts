import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { salvarKart } from "@/lib/cronometragem/cadastros-store";
import {
  cadastrarPilotoNaBateria,
  criarCorrida,
  finalizarCorrida,
  iniciarCorrida,
  lerCorrida,
  lerPainel,
  corridaDaClassificacao,
  definirDuracoes,
  prepararCorrida,
  sortearKarts,
} from "@/lib/cronometragem/corridas-store";
import {
  criarDecoder,
  registrarPassagens,
} from "@/lib/cronometragem/decoders-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import {
  criarReserva,
  gerarGrade,
  lerAgendaDoDia,
} from "@/lib/operacao/agenda-store";
import { abrirCaixa, registrarPagamento } from "@/lib/operacao/caixa-store";
import { criarCliente } from "@/lib/operacao/clientes-store";
import {
  pagamentoDosPilotos,
  parteDaReserva,
} from "@/lib/operacao/pagamento-pilotos";
import {
  cadastrarPilotoDaReserva,
  listarPilotosDasReservas,
  removerPilotoDaReserva,
} from "@/lib/operacao/reserva-pilotos-store";
import {
  assinarPorConvite,
  garantirConvite,
  termoAtual,
} from "@/lib/operacao/termo-store";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

const SEG = 1000;
const MIN = 60 * SEG;

describe("pagamento por piloto (cálculo)", () => {
  it("divide o valor igualmente, com os centavos que sobram para os primeiros", () => {
    expect([0, 1, 2].map((i) => parteDaReserva(10001, 3, i))).toEqual([
      3334, 3334, 3333,
    ]);
    expect(parteDaReserva(15000, 3, 2)).toBe(5000);
  });

  it("o que foi atribuído cobre o piloto; o da reserva cobre os demais na ordem", () => {
    const pilotos = [
      { id: "a", ordem: 1 },
      { id: "b", ordem: 2 },
      { id: "c", ordem: 3 },
    ];
    const r = pagamentoDosPilotos(
      { valorCentavos: 15000, pilotos: 3 },
      pilotos,
      [
        {
          id: 1,
          tipo: "pagamento",
          forma: "pix",
          valorCentavos: 5000,
          pilotoId: "b",
          estornoDe: null,
        },
        {
          id: 2,
          tipo: "pagamento",
          forma: "dinheiro",
          valorCentavos: 7000,
          pilotoId: null,
          estornoDe: null,
        },
      ],
    );
    // 7000 da reserva: cobre "a" (5000) e deixa "c" parcial (2000); "b" pagou no pix
    expect(r.get("a")).toMatchObject({
      situacao: "pago",
      formas: ["dinheiro"],
    });
    expect(r.get("b")).toMatchObject({ situacao: "pago", formas: ["pix"] });
    expect(r.get("c")).toMatchObject({
      situacao: "parcial",
      pagoCentavos: 2000,
      formas: ["dinheiro"],
    });
  });

  it("estorno desfaz o pagamento do piloto; sem pagamento fica a pagar", () => {
    const pilotos = [
      { id: "a", ordem: 1 },
      { id: "b", ordem: 2 },
    ];
    const r = pagamentoDosPilotos(
      { valorCentavos: 10000, pilotos: 2 },
      pilotos,
      [
        {
          id: 1,
          tipo: "pagamento",
          forma: "cartao",
          valorCentavos: 5000,
          pilotoId: "a",
          estornoDe: null,
        },
        {
          id: 2,
          tipo: "estorno",
          forma: "cartao",
          valorCentavos: 5000,
          pilotoId: "a",
          estornoDe: 1,
        },
      ],
    );
    expect(r.get("a")).toMatchObject({
      situacao: "a_pagar",
      pagoCentavos: 0,
      formas: [],
    });
    expect(r.get("b")?.situacao).toBe("a_pagar");
  });
});

describe.skipIf(!temBancoDeTeste)(
  "fluxo da bateria: reserva, pagamento, sorteio e fases",
  () => {
    let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
    const ator = { usuarioId: "operador-1" };
    const DIA = "2031-05-10";
    let decoderId = "";
    let slotId = "";

    async function erroDe(promessa: Promise<unknown>): Promise<string> {
      try {
        await promessa;
      } catch (erro) {
        return (erro as Error).message;
      }
      return "";
    }

    async function agora(): Promise<number> {
      const [l] = await consultar<{ ms: number }>(
        "select (extract(epoch from clock_timestamp()) * 1000)::float8 as ms",
      );
      return l.ms;
    }

    async function passar(sensor: string, instanteMs: number) {
      return registrarPassagens(decoderId, [
        {
          transponder: sensor,
          instanteMs,
          relogio: "decoder",
          forca: null,
          bruto: null,
          eventoExterno: null,
        },
      ]);
    }

    async function assinar(clienteId: string) {
      const termo = await termoAtual();
      const c = await garantirConvite(clienteId, ator);
      await assinarPorConvite(
        c.token,
        {
          assinante: "Assinante Teste",
          porMenor: false,
          assinaturaPng: `data:image/png;base64,${Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            Buffer.alloc(400, 7),
          ]).toString("base64")}`,
          termoVersao: termo.versao,
        },
        {},
      );
    }

    async function recuarInicio(id: string, ms: number) {
      await consultar(
        "update corrida set iniciada_em = iniciada_em - make_interval(secs => $2::float8 / 1000.0) where id = $1",
        [id, ms],
      );
    }

    beforeAll(async () => {
      banco = await criarEsquemaDeTeste();
      await migrar();
      decoderId = (
        await criarDecoder({ nome: "Pista", driver: "linhas-tcp" }, ator)
      ).id;
      await gerarGrade(
        {
          dia: DIA,
          primeiraHora: "10:00",
          ultimaHora: "10:00",
          intervaloMin: 15,
          duracaoMin: 10,
          capacidade: 8,
          precoCentavos: 5000,
        },
        ator,
      );
      slotId = (await lerAgendaDoDia(DIA))[0].id;
      // 4 karts com sensor
      const t = await agora();
      for (const [n, s] of [
        ["1", "FS1"],
        ["2", "FS2"],
        ["3", "FS3"],
        ["4", "FS4"],
      ]) {
        await passar(s, t - 3600 * SEG);
        await salvarKart(
          null,
          { numero: n, status: "ativo", transponderFixo: s },
          ator,
        );
      }
    });
    afterAll(async () => {
      await banco.remover();
    });

    it("a reserva guarda os pilotos (cada um com cadastro) e o pagamento aparece piloto a piloto", async () => {
      const resp = await criarCliente(
        { nome: "Rita Alves", telefone: "11988880001" },
        ator,
      );
      const reservaId = await criarReserva(
        { slotId, clienteId: resp.id, pilotos: 3, descontoCentavos: 0 },
        ator,
      );
      let lista = (await listarPilotosDasReservas([reservaId])).get(reservaId)!;
      expect(lista.map((p) => p.nome)).toEqual(["Rita Alves"]);

      const novo = await cadastrarPilotoDaReserva(
        reservaId,
        { nome: "Saulo Prado", telefone: "(11) 98888-0002" },
        ator,
      );
      expect(novo.numero).toBeGreaterThan(resp.numero);
      expect(
        await erroDe(
          cadastrarPilotoDaReserva(
            reservaId,
            { clienteId: novo.clienteId },
            ator,
          ),
        ),
      ).toMatch(/já está nesta reserva/);
      await cadastrarPilotoDaReserva(
        reservaId,
        { nome: "Tania Rocha", telefone: "11988880003" },
        ator,
      );
      expect(
        await erroDe(
          cadastrarPilotoDaReserva(
            reservaId,
            { nome: "Excesso", telefone: "11988880004" },
            ator,
          ),
        ),
      ).toMatch(/3 pilotos desta reserva já foram cadastrados/);

      // pagamentos: Saulo paga a parte dele no Pix; o resto é lançado na reserva (dinheiro)
      await abrirCaixa(0, ator);
      lista = (await listarPilotosDasReservas([reservaId])).get(reservaId)!;
      const saulo = lista.find((p) => p.nome === "Saulo Prado")!;
      await registrarPagamento(
        {
          reservaId,
          forma: "pix",
          valorCentavos: 5000,
          reservaPilotoId: saulo.id,
        },
        ator,
      );
      expect(
        await erroDe(
          registrarPagamento(
            {
              reservaId,
              forma: "pix",
              valorCentavos: 100,
              reservaPilotoId: saulo.id,
            },
            ator,
          ),
        ),
      ).toMatch(/já está pago/);
      await registrarPagamento(
        { reservaId, forma: "dinheiro", valorCentavos: 5000 },
        ator,
      );

      lista = (await listarPilotosDasReservas([reservaId])).get(reservaId)!;
      expect(
        lista.map((p) => [
          p.nome,
          p.pagamento.situacao,
          p.pagamento.formas.join("+"),
        ]),
      ).toEqual([
        ["Rita Alves", "pago", "dinheiro"],
        ["Saulo Prado", "pago", "pix"],
        ["Tania Rocha", "a_pagar", ""],
      ]);

      // pagamento atribuído impede tirar o piloto
      expect(await erroDe(removerPilotoDaReserva(saulo.id, ator))).toMatch(
        /pagamento lançado/,
      );
      const tania = lista.find((p) => p.nome === "Tania Rocha")!;
      await removerPilotoDaReserva(tania.id, ator);
      expect(
        (await listarPilotosDasReservas([reservaId]))
          .get(reservaId)!
          .map((p) => p.nome),
      ).toEqual(["Rita Alves", "Saulo Prado"]);
    });

    it("a bateria da agenda traz os pilotos, o pagamento e a vaga; sorteio de karts e 'apto'", async () => {
      const id = await criarCorrida({ slotId, fase: "classificacao" }, ator);
      let painel = (await lerPainel(id))!;
      expect(painel.corrida).toMatchObject({
        fase: "classificacao",
        nome: "Bateria 10:00 — Classificação",
        duracaoMin: 5,
      });
      expect(
        painel.grid.map((g) => [
          g.nome,
          g.vaga,
          g.pagamento?.situacao,
          g.pagamento?.formas.join("+"),
        ]),
      ).toEqual([
        ["Rita Alves", false, "pago", "dinheiro"],
        ["Saulo Prado", false, "pago", "pix"],
        ["Vaga 3 de Rita Alves", true, undefined, undefined],
      ]);

      // o piloto da vaga é cadastrado na reserva depois: entra na bateria já aberta
      const reservaId = painel.grid[0].reservaId!;
      await cadastrarPilotoDaReserva(
        reservaId,
        { nome: "Ugo Lemos", telefone: "11988880005" },
        ator,
      );
      painel = (await lerPainel(id))!;
      expect(painel.grid.map((g) => [g.nome, g.vaga])).toEqual([
        ["Rita Alves", false],
        ["Saulo Prado", false],
        ["Ugo Lemos", false],
      ]);
      expect(
        painel.grid.find((g) => g.nome === "Ugo Lemos")?.pagamento?.situacao,
      ).toBe("a_pagar");

      // sorteio: cada piloto recebe um kart diferente, e o sensor vem do kart
      const sorteio = await sortearKarts(id, {}, ator);
      expect(sorteio).toHaveLength(3);
      painel = (await lerPainel(id))!;
      const karts = painel.grid.map((g) => g.kartNumero);
      expect(new Set(karts).size).toBe(3);
      expect(
        painel.grid.every(
          (g) => g.transponder && /^FS[1-4]$/.test(g.transponder),
        ),
      ).toBe(true);
      expect(await erroDe(sortearKarts(id, {}, ator))).toMatch(
        /Não há piloto sem kart/,
      );

      // apto = termo assinado + kart definido
      expect(painel.grid.every((g) => !g.apto)).toBe(true);
      await assinar(painel.grid[0].clienteId!);
      painel = (await lerPainel(id))!;
      expect(painel.grid.map((g) => g.apto)).toEqual([true, false, false]);

      // refazer o sorteio troca os karts (continuam distintos)
      const refeito = await sortearKarts(id, { refazer: true }, ator);
      expect(refeito).toHaveLength(3);
      expect(new Set(refeito.map((r) => r.kart)).size).toBe(3);

      // karts a menos que pilotos
      await cadastrarPilotoNaBateria(
        id,
        { nome: "Vera A", telefone: "11977770001" },
        ator,
      ).catch(() => undefined);
      await cadastrarPilotoNaBateria(
        id,
        { nome: "Zeca B", telefone: "11977770002" },
        ator,
      ).catch(() => undefined);
      expect(await erroDe(sortearKarts(id, {}, ator))).toMatch(
        /só \d+ kart\(s\) disponível/,
      );
    });

    it("classificação e corrida: a corrida nasce da classificação, com o grid pela melhor volta", async () => {
      const t = await agora();
      void t;
      const id = await criarCorrida(
        { nome: "Duas fases", fase: "classificacao" },
        ator,
      );
      const a = await cadastrarPilotoNaBateria(
        id,
        { nome: "Ana Fase", telefone: "11966660001" },
        ator,
      );
      const b = await cadastrarPilotoNaBateria(
        id,
        { nome: "Beto Fase", telefone: "11966660002" },
        ator,
      );
      await sortearKarts(id, {}, ator);
      let painel = (await lerPainel(id))!;
      const sensorDe = (nome: string) =>
        painel.grid.find((g) => g.nome === nome)!.transponder!;
      // nada de corrida antes da hora
      expect(await erroDe(prepararCorrida(id, {}, ator))).toMatch(
        /Finalize a classificação/,
      );
      // não inicia sem termo
      expect(await erroDe(iniciarCorrida(id, ator))).toMatch(/Termo pendente/);
      await assinar(a.clienteId);
      await assinar(b.clienteId);
      // o tempo da corrida (8 min) é combinado antes de a classificação acabar
      await definirDuracoes(id, { duracaoCorridaMin: 8 }, ator);
      await iniciarCorrida(id, ator);
      await recuarInicio(id, 2 * MIN);
      const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();

      // Beto faz a volta mais rápida (50 s contra 55 s)
      await passar(sensorDe("Ana Fase"), inicio + 20 * SEG);
      await passar(sensorDe("Beto Fase"), inicio + 25 * SEG);
      await passar(sensorDe("Ana Fase"), inicio + 75 * SEG);
      await passar(sensorDe("Beto Fase"), inicio + 75 * SEG);
      await finalizarCorrida(id, ator);

      // ao finalizar, a corrida já nasceu sozinha, com o tempo combinado
      const corridaId = (await corridaDaClassificacao(id))!;
      expect(corridaId).toBeTruthy();
      expect(await prepararCorrida(id, {}, ator)).toBe(corridaId);

      const corrida = (await lerPainel(corridaId))!;
      expect(corrida.corrida).toMatchObject({
        fase: "corrida",
        classificacaoId: id,
        nome: "Duas fases — Corrida",
        duracaoMin: 8,
        estado: "preparada",
      });
      // grid pela melhor volta: Beto (50 s) na frente da Ana (55 s)
      expect(
        corrida.grid.map((g) => [g.posicaoGrid, g.nome, g.kartNumero]),
      ).toEqual([
        [
          1,
          "Beto Fase",
          painel.grid.find((g) => g.nome === "Beto Fase")!.kartNumero,
        ],
        [
          2,
          "Ana Fase",
          painel.grid.find((g) => g.nome === "Ana Fase")!.kartNumero,
        ],
      ]);
      expect(corrida.fases?.classificacao?.id).toBe(id);
      expect(corrida.fases?.corrida?.id).toBe(corridaId);
      painel = (await lerPainel(id))!;
      expect(painel.fases?.corrida?.id).toBe(corridaId);

      // a corrida inicia (termos já assinados) e conta a partir da largada dela
      await iniciarCorrida(corridaId, ator);
      expect((await lerCorrida(corridaId))?.estado).toBe("em_andamento");
      await consultar(
        "update corrida set estado = 'cancelada', cancelada_em = now() where id = $1",
        [corridaId],
      );
    });
  },
);
