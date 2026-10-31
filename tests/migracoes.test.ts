import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { consultar } from "@/lib/db/conexao";
import { migracoesAplicadas, migrar } from "@/lib/db/migrar";
import { MIGRACOES } from "@/lib/db/migracoes";
import { registrarAuditoria } from "@/lib/audit";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

describe.skipIf(!temBancoDeTeste)("migrações e auditoria", () => {
  let remover: () => Promise<void>;
  beforeAll(async () => {
    ({ remover } = await criarEsquemaDeTeste());
  });
  afterAll(async () => {
    await remover();
  });

  it("aplica todas as migrações na primeira vez e nenhuma na segunda (idempotente)", async () => {
    const primeira = await migrar();
    expect(primeira).toEqual(MIGRACOES.map((m) => m.id));
    expect(await migrar()).toEqual([]);
    expect(await migracoesAplicadas()).toEqual(MIGRACOES.map((m) => m.id));
  });

  it("duas instâncias migrando ao mesmo tempo não conflitam", async () => {
    const resultados = await Promise.all([migrar(), migrar(), migrar()]);
    expect(resultados.flat()).toEqual([]);
  });

  it("audit_log recusa UPDATE e DELETE (somente inclusão)", async () => {
    await registrarAuditoria({
      usuarioId: "u1",
      acao: "teste.acao",
      entidade: "teste",
      entidadeId: "1",
      antes: { a: 1 },
      depois: { a: 2 },
      motivo: "verificação",
    });
    const [linha] = await consultar<{
      id: string;
      antes: unknown;
      depois: unknown;
    }>("select id, antes, depois from audit_log where acao = 'teste.acao'");
    expect(linha.antes).toEqual({ a: 1 });
    expect(linha.depois).toEqual({ a: 2 });

    await expect(
      consultar("update audit_log set motivo = 'adulterado' where id = $1", [
        linha.id,
      ]),
    ).rejects.toThrow(/append-only/);
    await expect(
      consultar("delete from audit_log where id = $1", [linha.id]),
    ).rejects.toThrow(/append-only/);
  });
});
