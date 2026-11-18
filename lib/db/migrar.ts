import { consultar, transacao } from "@/lib/db/conexao";
import { MIGRACOES, type Migracao } from "@/lib/db/migracoes";
import {
  MigracaoBloqueada,
  avaliarMigracaoEstrutural,
} from "@/lib/db/protecao-migracao";

// Trava de aviso do Postgres pra duas instâncias subindo juntas não
// aplicarem a mesma migração ao mesmo tempo.
const CHAVE_TRAVA = 7351001;

export interface OpcoesDeMigracao {
  // Lista de migrações (padrão: as do sistema). Existe para teste.
  migracoes?: Migracao[];
  // Variáveis de ambiente usadas pela proteção (padrão: process.env).
  env?: Record<string, string | undefined>;
}

export interface ResultadoDaMigracao {
  aplicadas: string[];
  // Estruturais ainda não aplicadas porque a proteção não liberou.
  estruturaisPendentes: string[];
}

// Aplica as migrações pendentes, em ordem. Idempotente.
//
// Migrações comuns rodam sempre. Migrações `estrutural` só rodam em banco de
// desenvolvimento liberado pela proteção (lib/db/protecao-migracao.ts); fora
// dele ficam pendentes, sem erro, e o servidor sobe normalmente.
export async function migrarComRelatorio(
  opcoes: OpcoesDeMigracao = {},
): Promise<ResultadoDaMigracao> {
  const lista = opcoes.migracoes ?? MIGRACOES;
  const env = opcoes.env ?? process.env;
  const liberadas = avaliarMigracaoEstrutural(env).permitido;

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
    const pendentes: string[] = [];
    for (const migracao of lista) {
      if (aplicadas.has(migracao.id)) continue;
      if (migracao.estrutural && !liberadas) {
        pendentes.push(migracao.id);
        continue;
      }
      await cliente.query(migracao.sql);
      await cliente.query("insert into schema_migrations (id) values ($1)", [
        migracao.id,
      ]);
      novas.push(migracao.id);
    }
    return { aplicadas: novas, estruturaisPendentes: pendentes };
  });
}

export async function migrar(opcoes: OpcoesDeMigracao = {}): Promise<string[]> {
  return (await migrarComRelatorio(opcoes)).aplicadas;
}

// Uso explícito (ferramentas de desenvolvimento): aplica também as estruturais
// e falha com MigracaoBloqueada se o ambiente não for o de desenvolvimento.
export async function migrarEstruturais(
  opcoes: OpcoesDeMigracao = {},
): Promise<ResultadoDaMigracao> {
  const avaliacao = avaliarMigracaoEstrutural(opcoes.env ?? process.env);
  if (!avaliacao.permitido) throw new MigracaoBloqueada(avaliacao.motivos);
  return migrarComRelatorio(opcoes);
}

export async function migracoesAplicadas(): Promise<string[]> {
  const linhas = await consultar<{ id: string }>(
    "select id from schema_migrations order by id",
  );
  return linhas.map((linha) => linha.id);
}
