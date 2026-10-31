import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cadastrarPilotoNaBateria,
  cancelarCorrida,
  criarCorrida,
  lerPainel,
  registrarOcorrencia,
  registrarPresenca,
} from "@/lib/cronometragem/corridas-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

describe.skipIf(!temBancoDeTeste)("check-in e ocorrências da bateria", () => {
  let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
  const ator = { usuarioId: "operador-1" };
  let corridaId = "";
  let pilotoId = "";

  async function erroDe(promessa: Promise<unknown>): Promise<string> {
    try {
      await promessa;
    } catch (erro) {
      return (erro as Error).message;
    }
    return "";
  }

  async function piloto() {
    const painel = await lerPainel(corridaId);
    return painel!.grid.find((p) => p.id === pilotoId)!;
  }

  beforeAll(async () => {
    banco = await criarEsquemaDeTeste();
    await migrar();
    corridaId = await criarCorrida({ nome: "Bateria de teste" }, ator);
    await cadastrarPilotoNaBateria(
      corridaId,
      { nome: "Nina Teste", telefone: "11977770001" },
      ator,
    );
    const painel = await lerPainel(corridaId);
    pilotoId = painel!.grid[0].id;
  });
  afterAll(async () => {
    await banco.remover();
  });

  it("confirma e desfaz a presença, com auditoria", async () => {
    expect((await piloto()).presenteEm).toBeUndefined();
    await registrarPresenca(pilotoId, true, ator);
    expect((await piloto()).presenteEm).toBeInstanceOf(Date);
    await registrarPresenca(pilotoId, false, ator);
    expect((await piloto()).presenteEm).toBeUndefined();
    const acoes = await consultar<{ acao: string }>(
      "select acao from audit_log where entidade_id = $1 order by id",
      [pilotoId],
    );
    expect(acoes.map((a) => a.acao)).toEqual(
      expect.arrayContaining(["corrida.checkin", "corrida.checkin_desfazer"]),
    );
  });

  it("a ocorrência exige motivo e limita a penalidade", async () => {
    expect(
      await erroDe(
        registrarOcorrencia(
          pilotoId,
          { situacao: "dsq", penalidadeS: 0, motivo: " " },
          ator,
        ),
      ),
    ).toMatch(/motivo/i);
    for (const penalidadeS of [-1, 3601, 1.5]) {
      expect(
        await erroDe(
          registrarOcorrencia(
            pilotoId,
            { situacao: null, penalidadeS, motivo: "Corte de pista" },
            ator,
          ),
        ),
      ).toMatch(/Penalidade/);
    }
    expect(
      await erroDe(
        registrarOcorrencia(
          pilotoId,
          { situacao: "xx" as "dns", penalidadeS: 0, motivo: "Teste" },
          ator,
        ),
      ),
    ).toMatch(/inválida/);
    expect((await piloto()).situacaoManual).toBeUndefined();
  });

  it("grava a ocorrência, audita antes/depois e permite desfazer", async () => {
    await registrarOcorrencia(
      pilotoId,
      { situacao: "dnf", penalidadeS: 10, motivo: "Quebrou o kart" },
      ator,
    );
    expect(await piloto()).toMatchObject({
      situacaoManual: "dnf",
      penalidadeMs: 10_000,
      ocorrenciaMotivo: "Quebrou o kart",
    });
    const [log] = await consultar<{ motivo: string; antes: unknown }>(
      "select motivo, antes from audit_log where acao = 'corrida.ocorrencia' and entidade_id = $1 order by id desc limit 1",
      [pilotoId],
    );
    expect(log.motivo).toBe("Quebrou o kart");
    await registrarOcorrencia(
      pilotoId,
      { situacao: null, penalidadeS: 0, motivo: "Erro de lançamento" },
      ator,
    );
    expect(await piloto()).toMatchObject({ penalidadeMs: 0 });
    expect((await piloto()).situacaoManual).toBeUndefined();
  });

  it("depois de encerrada a ocorrência ainda vale (correção); a presença não", async () => {
    const id = await criarCorrida({ nome: "Bateria encerrada" }, ator);
    await cadastrarPilotoNaBateria(
      id,
      { nome: "Otto Teste", telefone: "11977770002" },
      ator,
    );
    const pid = (await lerPainel(id))!.grid[0].id;
    await consultar(
      `update corrida
          set estado = 'finalizada', iniciada_em = clock_timestamp(),
              encerrando_em = clock_timestamp(), encerrada_em = clock_timestamp()
        where id = $1`,
      [id],
    );
    await registrarOcorrencia(
      pid,
      { situacao: null, penalidadeS: 5, motivo: "Largada antecipada" },
      ator,
    );
    const [l] = await consultar<{ penalidade_ms: number }>(
      "select penalidade_ms from corrida_piloto where id = $1",
      [pid],
    );
    expect(l.penalidade_ms).toBe(5000);
    expect(await erroDe(registrarPresenca(pid, true, ator))).toMatch(
      /encerrada/,
    );
  });

  it("bateria cancelada ou encerrada: sem ocorrência / sem check-in", async () => {
    await cancelarCorrida(corridaId, "Teste de cancelamento", ator);
    expect(
      await erroDe(
        registrarOcorrencia(
          pilotoId,
          { situacao: "dns", penalidadeS: 0, motivo: "Não veio" },
          ator,
        ),
      ),
    ).toMatch(/cancelada/);
    expect(await erroDe(registrarPresenca(pilotoId, true, ator))).toMatch(
      /encerrada|terminou/,
    );
  });
});
