import { consultar, transacao } from "@/lib/db/conexao";
import { MIGRACOES } from "@/lib/db/migracoes";

// Trava de aviso do Postgres pra duas instâncias subindo juntas não
// aplicarem a mesma migração ao mesmo tempo.
const CHAVE_TRAVA = 7351001;

// Aplica as migrações pendentes, em ordem. Idempotente.
export async function migrar(): Promise<string[]> {
  return transacao(async (cliente) => {
    await cliente.query("select pg_advisory_xact_lock($1)", [CHAVE_TRAVA]);
    await cliente.query(`
      create table if not exists schema_migrations (
        id text primary key,
        aplicada_em timestamptz not null default now()
      )
    `);
    const aplicadas = new Set(
      (await cliente.query("select id from schema_migrations")).rows.map(
        (linha) => linha.id as string,
      ),
    );

    const novas: string[] = [];
    for (const migracao of MIGRACOES) {
      if (aplicadas.has(migracao.id)) continue;
      await cliente.query(migracao.sql);
      await cliente.query("insert into schema_migrations (id) values ($1)", [
        migracao.id,
      ]);
      novas.push(migracao.id);
    }
    return novas;
  });
}

export async function migracoesAplicadas(): Promise<string[]> {
  const linhas = await consultar<{ id: string }>(
    "select id from schema_migrations order by id",
  );
  return linhas.map((linha) => linha.id);
}
