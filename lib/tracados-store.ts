import { randomUUID } from "node:crypto";
import { consultar } from "@/lib/db/conexao";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { PontoRota } from "@/lib/tracado3d/rota";
import type { Tracado } from "@/lib/types";

// Biblioteca de traçados (desenhados no editor 3D). Cada campeonato escolhe quais usa
// (lib/campeonatos-store.ts). Antes ficavam só no navegador de quem desenhou.
interface LinhaTracado {
  id: string;
  nome: string;
  descricao: string | null;
  pontos: PontoRota[];
  fechado: boolean;
  extensao_metros: number | null;
}

function deLinha(l: LinhaTracado): Tracado {
  return {
    id: l.id,
    nome: l.nome,
    descricao: l.descricao ?? undefined,
    pontos: l.pontos,
    fechado: l.fechado,
    extensaoMetros: l.extensao_metros ?? undefined,
  };
}

export async function lerTracados(): Promise<Tracado[]> {
  try {
    const linhas = await consultar<LinhaTracado>(
      `select id, nome, descricao, pontos, fechado, extensao_metros
         from tracado order by criado_em, id`,
    );
    return linhas.map(deLinha);
  } catch {
    // Banco sem a tabela (SQL ainda não aplicado): sem traçados.
    return [];
  }
}

function validarPontos(pontos: unknown): PontoRota[] {
  if (!Array.isArray(pontos) || pontos.length < 2 || pontos.length > 2000) {
    throw new ErroNegocio("O traçado precisa de pelo menos 2 pontos.");
  }
  for (const p of pontos) {
    if (
      !p ||
      typeof p !== "object" ||
      !Number.isFinite((p as PontoRota).x) ||
      !Number.isFinite((p as PontoRota).z)
    ) {
      throw new ErroNegocio("O traçado tem pontos inválidos.");
    }
  }
  return pontos as PontoRota[];
}

export interface DadosDoTracado {
  nome: string;
  descricao?: string;
  pontos: unknown;
  fechado: boolean;
  extensaoMetros?: number;
}

function limpar(d: DadosDoTracado) {
  const nome = d.nome.trim();
  if (nome.length < 2 || nome.length > 80) {
    throw new ErroNegocio("O nome do traçado deve ter de 2 a 80 caracteres.");
  }
  const descricao = d.descricao?.trim() || null;
  if (descricao && descricao.length > 300) {
    throw new ErroNegocio("A descrição pode ter até 300 caracteres.");
  }
  const pontos = validarPontos(d.pontos);
  const extensao =
    d.extensaoMetros !== undefined && Number.isFinite(d.extensaoMetros)
      ? Math.max(0, Math.round(d.extensaoMetros))
      : null;
  return { nome, descricao, pontos, fechado: Boolean(d.fechado), extensao };
}

export async function criarTracado(d: DadosDoTracado): Promise<string> {
  const v = limpar(d);
  const id = `tracado-${randomUUID().slice(0, 8)}`;
  await consultar(
    `insert into tracado (id, nome, descricao, pontos, fechado, extensao_metros)
     values ($1, $2, $3, $4::jsonb, $5, $6)`,
    [id, v.nome, v.descricao, JSON.stringify(v.pontos), v.fechado, v.extensao],
  );
  return id;
}

export async function atualizarTracado(
  id: string,
  d: DadosDoTracado,
): Promise<void> {
  const v = limpar(d);
  const linhas = await consultar(
    `update tracado set nome = $2, descricao = $3, pontos = $4::jsonb,
            fechado = $5, extensao_metros = $6 where id = $1 returning id`,
    [id, v.nome, v.descricao, JSON.stringify(v.pontos), v.fechado, v.extensao],
  );
  if (linhas.length === 0) throw new ErroNegocio("Traçado não encontrado.");
}

export async function excluirTracado(id: string): Promise<void> {
  const [uso] = await consultar<{ n: number }>(
    "select count(*)::int as n from campeonato_tracado where tracado_id = $1",
    [id],
  );
  if (uso && uso.n > 0) {
    throw new ErroNegocio(
      "Este traçado é usado por um campeonato. Tire-o do campeonato antes de excluir.",
    );
  }
  await consultar("delete from tracado where id = $1", [id]);
}
