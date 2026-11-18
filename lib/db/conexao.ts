import { Pool, type PoolClient, type QueryResultRow } from "pg";

// Pool único por processo (em globalThis porque o Next compila páginas,
// rotas de API e o instrumentation em pacotes separados — sem isso cada um
// abriria o seu próprio pool).
type Global = typeof globalThis & { __gridlapPool?: Pool };

function pool(): Pool {
  const g = globalThis as Global;
  if (!g.__gridlapPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada.");
    // DATABASE_SSL=1: conexão criptografada COM verificação do certificado,
    // para bancos na nuvem (Supabase). DATABASE_CA = certificado da autoridade
    // do provedor em PEM (o Supabase publica o dele no painel); quebras de
    // linha podem vir como "\n".
    const ca = process.env.DATABASE_CA?.replace(/\\n/g, "\n");
    const ssl =
      process.env.DATABASE_SSL === "1"
        ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
        : undefined;
    g.__gridlapPool = new Pool({ connectionString: url, max: 10, ssl });
  }
  return g.__gridlapPool;
}

export async function consultar<T extends QueryResultRow = QueryResultRow>(
  texto: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  const resultado = await pool().query<T>(texto, parametros as never[]);
  return resultado.rows;
}

// Executa `fn` numa transação: confirma se terminar sem erro, desfaz se lançar.
export async function transacao<T>(
  fn: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    const resultado = await fn(cliente);
    await cliente.query("commit");
    return resultado;
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}

export function bancoConfigurado() {
  return Boolean(process.env.DATABASE_URL);
}

export async function encerrarConexoes() {
  const g = globalThis as Global;
  if (g.__gridlapPool) {
    await g.__gridlapPool.end();
    g.__gridlapPool = undefined;
  }
}
