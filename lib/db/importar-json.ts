import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import { transacao } from "@/lib/db/conexao";
import type { Patrocinador, Perfil, Piloto } from "@/lib/types";

// Importa, UMA vez, os arquivos JSON que guardavam os dados antes do banco
// (.data/perfis.json, pilotos.json, patrocinadores.json). Os arquivos NÃO são
// apagados nem alterados (ficam de backup) e a importação é registrada na
// tabela importacao_json, então rodar de novo não duplica nada.
//
// Pilotos de demonstração (ids "pil-...") nunca são importados: existem só
// na simulação, em memória.
function lerJson<T>(arquivo: string, pasta: string): T[] | null {
  const caminho = path.join(pasta, arquivo);
  if (!fs.existsSync(caminho)) return null;
  const lista = JSON.parse(fs.readFileSync(caminho, "utf-8"));
  return Array.isArray(lista) ? (lista as T[]) : null;
}

async function importarArquivo<T>(
  arquivo: string,
  pasta: string,
  inserir: (cliente: PoolClient, itens: T[]) => Promise<number>,
): Promise<{ arquivo: string; linhas: number } | null> {
  const itens = lerJson<T>(arquivo, pasta);
  if (!itens) return null;

  return transacao(async (cliente) => {
    const ja = await cliente.query(
      "select 1 from importacao_json where arquivo = $1 for update",
      [arquivo],
    );
    if (ja.rowCount) return null;
    const linhas = await inserir(cliente, itens);
    await cliente.query(
      "insert into importacao_json (arquivo, linhas) values ($1, $2)",
      [arquivo, linhas],
    );
    return { arquivo, linhas };
  });
}

export async function importarJsonLegado(
  pasta = path.join(process.cwd(), ".data"),
): Promise<{ arquivo: string; linhas: number }[]> {
  const feitas: { arquivo: string; linhas: number }[] = [];

  const perfis = await importarArquivo<Perfil>(
    "perfis.json",
    pasta,
    async (cliente, itens) => {
      let n = 0;
      for (const p of itens) {
        const r = await cliente.query(
          `insert into perfil (id, user_id, nome, email, papel, piloto_id, avatar_url, senha_hash)
           values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict do nothing`,
          [
            p.id,
            p.userId,
            p.nome,
            p.email,
            p.papel,
            p.pilotoId ?? null,
            p.avatarUrl ?? null,
            p.senhaHash ?? null,
          ],
        );
        n += r.rowCount ?? 0;
      }
      return n;
    },
  );
  if (perfis) feitas.push(perfis);

  const pilotos = await importarArquivo<Piloto>(
    "pilotos.json",
    pasta,
    async (cliente, itens) => {
      let n = 0;
      for (const p of itens) {
        if (p.id.startsWith("pil-")) continue;
        const r = await cliente.query(
          `insert into piloto (id, nome, apelido, slug, numero, categoria_id, cidade, uf,
                               avatar_url, idade, peso_kg, cor_numero, cor_assinatura,
                               vitorias, podios, pontos, posicao_campeonato)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           on conflict do nothing`,
          [
            p.id,
            p.nome,
            p.apelido ?? null,
            p.slug,
            p.numero,
            p.categoriaId,
            p.cidade ?? null,
            p.uf ?? null,
            p.avatarUrl ?? null,
            p.idade ?? null,
            p.pesoKg ?? null,
            p.corNumero ?? null,
            p.corAssinatura ?? null,
            p.vitorias ?? 0,
            p.podios ?? 0,
            p.pontos ?? 0,
            p.posicaoCampeonato ?? 0,
          ],
        );
        n += r.rowCount ?? 0;
      }
      return n;
    },
  );
  if (pilotos) feitas.push(pilotos);

  const patrocinadores = await importarArquivo<Patrocinador>(
    "patrocinadores.json",
    pasta,
    async (cliente, itens) => {
      let n = 0;
      for (const [indice, p] of itens.entries()) {
        const r = await cliente.query(
          `insert into patrocinador (id, nome, logo_url, ativo, ordem)
           values ($1, $2, $3, $4, $5) on conflict do nothing`,
          [p.id, p.nome, p.logoUrl ?? null, p.ativo ?? true, indice],
        );
        n += r.rowCount ?? 0;
      }
      return n;
    },
  );
  if (patrocinadores) feitas.push(patrocinadores);

  return feitas;
}
