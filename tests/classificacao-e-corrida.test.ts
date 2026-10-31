import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { salvarKart } from "@/lib/cronometragem/cadastros-store";
import {
  avancarCorrida,
  cadastrarPilotoNaBateria,
  corridaDaClassificacao,
  criarCorrida,
  definirDuracoes,
  finalizarCorrida,
  iniciarCorrida,
  lerCorrida,
  lerPainel,
  pularClassificacao,
  sortearKarts,
} from "@/lib/cronometragem/corridas-store";
import {
  criarDecoder,
  registrarPassagens,
} from "@/lib/cronometragem/decoders-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import {
  garantirConvite,
  assinarPorConvite,
  termoAtual,
} from "@/lib/operacao/termo-store";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

const SEG = 1000;
const MIN = 60 * SEG;

describe.skipIf(!temBancoDeTeste)(
  "classificação (5 min) → corrida (12 min), do começo ao fim",
  () => {
    let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
    const ator = { usuarioId: "balcao-1" };
    let decoderId = "";

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

    // bateria com dois pilotos já com termo e kart
    async function bateriaPronta(nome: string, tel: string) {
      const id = await criarCorrida({ nome, fase: "classificacao" }, ator);
      const a = await cadastrarPilotoNaBateria(
        id,
        { nome: `Ana ${nome}`, telefone: `119${tel}0001` },
        ator,
      );
      const b = await cadastrarPilotoNaBateria(
        id,
        { nome: `Beto ${nome}`, telefone: `119${tel}0002` },
        ator,
      );
      await sortearKarts(id, {}, ator);
      await assinar(a.clienteId);
      await assinar(b.clienteId);
      return { id, ana: `Ana ${nome}`, beto: `Beto ${nome}` };
    }

    beforeAll(async () => {
      banco = await criarEsquemaDeTeste();
      await migrar();
      decoderId = (
        await criarDecoder({ nome: "Pista", driver: "linhas-tcp" }, ator)
      ).id;
      const t = await agora();
      for (const [n, s] of [
        ["1", "QS1"],
        ["2", "QS2"],
        ["3", "QS3"],
        ["4", "QS4"],
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

    it("a classificação nasce com 5 min, termina sozinha no tempo e a corrida de 12 min já nasce", async () => {
      const { id, ana, beto } = await bateriaPronta("Auto", "1111");
      const c = (await lerCorrida(id))!;
      expect(c).toMatchObject({
        fase: "classificacao",
        duracaoMin: 5,
        duracaoCorridaMin: 12,
        modoEncerramento: "corte_imediato",
      });
      await iniciarCorrida(id, ator);
      const painel0 = (await lerPainel(id))!;
      const sensor = (nome: string) =>
        painel0.grid.find((g) => g.nome === nome)!.transponder!;

      // 3 min depois ainda corre; as voltas valem para o grid
      await recuarInicio(id, 3 * MIN);
      const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
      await passar(sensor(ana), inicio + 10 * SEG);
      await passar(sensor(beto), inicio + 12 * SEG);
      await passar(sensor(ana), inicio + 70 * SEG); // Ana 60 s
      await passar(sensor(beto), inicio + 62 * SEG); // Beto 50 s
      await avancarCorrida(id);
      expect((await lerCorrida(id))?.estado).toBe("em_andamento");
      expect(await corridaDaClassificacao(id)).toBeNull();

      // passou dos 5 min: encerra sozinha e já gera a corrida
      await recuarInicio(id, 3 * MIN);
      await avancarCorrida(id);
      expect((await lerCorrida(id))?.estado).toBe("finalizada");
      const corridaId = (await corridaDaClassificacao(id))!;
      expect(corridaId).toBeTruthy();
      const corrida = (await lerPainel(corridaId))!;
      expect(corrida.corrida).toMatchObject({
        fase: "corrida",
        estado: "preparada",
        duracaoMin: 12,
        classificacaoId: id,
      });
      // grid pela melhor volta: Beto (50 s) antes da Ana (60 s)
      expect(corrida.grid.map((g) => [g.posicaoGrid, g.nome])).toEqual([
        [1, beto],
        [2, ana],
      ]);
      // a corrida inicia normalmente (termos valem) e o tempo dela é editável
      await definirDuracoes(corridaId, { duracaoMin: 10 }, ator);
      expect((await lerCorrida(corridaId))?.duracaoMin).toBe(10);
      await iniciarCorrida(corridaId, ator);
      await consultar(
        "update corrida set estado = 'cancelada', cancelada_em = now() where id = $1",
        [corridaId],
      );
    });

    it("dá para encerrar a classificação antes do tempo: a corrida nasce na hora", async () => {
      const { id } = await bateriaPronta("Antes", "2222");
      await iniciarCorrida(id, ator);
      await finalizarCorrida(id, ator);
      const corridaId = await corridaDaClassificacao(id);
      expect(corridaId).toBeTruthy();
      expect((await lerCorrida(corridaId!))?.duracaoMin).toBe(12);
      await consultar(
        "update corrida set estado = 'cancelada', cancelada_em = now() where id = $1",
        [corridaId],
      );
    });

    it("pular a classificação vai direto para a corrida, sem tempos, na ordem de cadastro", async () => {
      const { id, ana, beto } = await bateriaPronta("Pula", "3333");
      expect(await corridaDaClassificacao(id)).toBeNull();
      const corridaId = (await pularClassificacao(id, ator))!;
      expect(corridaId).toBeTruthy();
      expect((await lerCorrida(id))?.estado).toBe("finalizada");
      const corrida = (await lerPainel(corridaId))!;
      expect(corrida.grid.map((g) => [g.posicaoGrid, g.nome])).toEqual([
        [1, ana],
        [2, beto],
      ]);
      // não pula de novo nem depois de iniciada
      expect(await erroDe(pularClassificacao(id, ator))).toMatch(/já começou/);
      await consultar(
        "update corrida set estado = 'cancelada', cancelada_em = now() where id = $1",
        [corridaId],
      );
    });

    it("sem participantes a classificação termina sem gerar corrida; corrida única não é afetada", async () => {
      const vazia = await criarCorrida(
        { nome: "Sem gente", fase: "classificacao" },
        ator,
      );
      await iniciarCorrida(vazia, ator);
      await finalizarCorrida(vazia, ator);
      expect(await corridaDaClassificacao(vazia)).toBeNull();

      const unica = await criarCorrida({ nome: "Unica" }, ator);
      await iniciarCorrida(unica, ator);
      await finalizarCorrida(unica, ator);
      expect(await corridaDaClassificacao(unica)).toBeNull();
      expect(await erroDe(pularClassificacao(unica, ator))).toMatch(
        /Só a classificação/,
      );
    });

    it("tempos editáveis: classificação, corrida planejada, e com a bateria rodando", async () => {
      const { id } = await bateriaPronta("Tempos", "4444");
      expect(
        await erroDe(definirDuracoes(id, { duracaoMin: 0 }, ator)),
      ).toMatch(/de 1 a 240/);
      await definirDuracoes(id, { duracaoMin: 3, duracaoCorridaMin: 20 }, ator);
      expect(await lerCorrida(id)).toMatchObject({
        duracaoMin: 3,
        duracaoCorridaMin: 20,
      });

      // em andamento: o novo tempo precisa ainda estar no futuro
      await iniciarCorrida(id, ator);
      await recuarInicio(id, 2 * MIN);
      expect(
        await erroDe(definirDuracoes(id, { duracaoMin: 1 }, ator)),
      ).toMatch(/já passou/);
      await definirDuracoes(id, { duracaoMin: 8 }, ator);
      expect((await lerCorrida(id))?.duracaoMin).toBe(8);
      // o tempo da corrida planejada não muda com a classificação rodando? muda
      await definirDuracoes(id, { duracaoCorridaMin: 15 }, ator);
      await finalizarCorrida(id, ator);
      const corridaId = (await corridaDaClassificacao(id))!;
      expect((await lerCorrida(corridaId))?.duracaoMin).toBe(15);
      // depois de criada, o tempo da corrida muda na própria corrida
      expect(
        await erroDe(definirDuracoes(id, { duracaoCorridaMin: 9 }, ator)),
      ).toMatch(/já terminou|já foi criada/);
      await definirDuracoes(corridaId, { duracaoMin: 9 }, ator);
      expect((await lerCorrida(corridaId))?.duracaoMin).toBe(9);
      await consultar(
        "update corrida set estado = 'cancelada', cancelada_em = now() where id = $1",
        [corridaId],
      );
    });
  },
);
