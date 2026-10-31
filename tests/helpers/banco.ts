import { randomBytes } from "node:crypto";
import pg from "pg";
import { encerrarConexoes } from "@/lib/db/conexao";

// Os testes de banco precisam de um Postgres de teste:
//   TEST_DATABASE_URL=postgres://usuario:senha@host:porta/banco npm test
// Cada arquivo de teste cria um esquema próprio (isolado) e o apaga no fim —
// nunca toca em tabelas de outro esquema.
export const temBancoDeTeste = Boolean(process.env.TEST_DATABASE_URL);

export async function criarEsquemaDeTeste() {
  const base = process.env.TEST_DATABASE_URL as string;
  const esquema = `t_${randomBytes(5).toString("hex")}`;

  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create schema ${esquema}`);
  await admin.end();

  const url = new URL(base);
  url.searchParams.set("options", `-c search_path=${esquema}`);
  process.env.DATABASE_URL = url.toString();

  return {
    esquema,
    async remover() {
      await encerrarConexoes();
      const limpeza = new pg.Client({ connectionString: base });
      await limpeza.connect();
      await limpeza.query(`drop schema ${esquema} cascade`);
      await limpeza.end();
    },
  };
}
