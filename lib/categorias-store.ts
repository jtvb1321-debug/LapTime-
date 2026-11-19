import { consultar, transacao } from "@/lib/db/conexao";
import { categorias } from "@/lib/mock/data";

// As cinco categorias nascem no código (lib/mock/data.ts: id, nível e cor). O que o admin pode
// ajustar no painel — nome, descrição e peso mínimo — fica na tabela categoria_ajuste e é aplicado
// por cima delas. Se a tabela ainda não existir (SQL não aplicado), vale o padrão do código.
export interface AjusteDeCategoria {
  nome: string;
  descricao: string;
  pesoMinimoKg: number;
}

const PADRAO = new Map(
  categorias.map((c) => [
    c.id,
    { nome: c.nome, descricao: c.descricao, pesoMinimoKg: c.pesoMinimoKg },
  ]),
);

let aplicadoEm = 0;
const VALIDADE_MS = 10_000;

// Chame no começo das páginas que mostram categorias. Faz no máximo uma consulta a cada 10 s.
export async function aplicarAjustesDeCategoria(): Promise<void> {
  if (Date.now() - aplicadoEm < VALIDADE_MS) return;
  aplicadoEm = Date.now();
  let porId = new Map<
    string,
    { nome: string; descricao: string; peso_minimo_kg: number }
  >();
  try {
    const linhas = await consultar<{
      id: string;
      nome: string;
      descricao: string;
      peso_minimo_kg: number;
    }>("select id, nome, descricao, peso_minimo_kg from categoria_ajuste");
    porId = new Map(linhas.map((l) => [l.id, l]));
  } catch {
    // Sem banco ou sem a tabela: vale o padrão do código.
  }
  for (const c of categorias) {
    const ajuste = porId.get(c.id);
    const base = PADRAO.get(c.id);
    if (ajuste) {
      c.nome = ajuste.nome;
      c.descricao = ajuste.descricao;
      c.pesoMinimoKg = ajuste.peso_minimo_kg;
    } else if (base) {
      c.nome = base.nome;
      c.descricao = base.descricao;
      c.pesoMinimoKg = base.pesoMinimoKg;
    }
  }
}

export function categoriaExiste(id: string): boolean {
  return PADRAO.has(id);
}

export async function salvarAjusteDeCategoria(
  id: string,
  ajuste: AjusteDeCategoria,
  usuarioId: string,
): Promise<void> {
  await transacao(async (cliente) => {
    await cliente.query(
      `insert into categoria_ajuste (id, nome, descricao, peso_minimo_kg, atualizado_por, atualizado_em)
       values ($1, $2, $3, $4, $5, clock_timestamp())
       on conflict (id) do update
         set nome = excluded.nome, descricao = excluded.descricao,
             peso_minimo_kg = excluded.peso_minimo_kg,
             atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em`,
      [id, ajuste.nome, ajuste.descricao, ajuste.pesoMinimoKg, usuarioId],
    );
  });
  aplicadoEm = 0; // a próxima leitura já traz o valor novo
}
