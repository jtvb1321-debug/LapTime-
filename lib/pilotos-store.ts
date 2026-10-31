import type { PoolClient } from "pg";
import { consultar } from "@/lib/db/conexao";
import { pilotos as pilotosSimulados } from "@/lib/mock/data";
import type { Piloto } from "@/lib/types";

// Pilotos reais (cadastrados em /cadastro) moram no Postgres, visíveis pra
// qualquer um que acessar o site ou o overlay de transmissão. Os pilotos
// fictícios (ids "pil-...") existem apenas em memória, quando a simulação
// está ligada (lib/simulacao.ts) — nunca são gravados no banco.
interface LinhaPiloto {
  id: string;
  nome: string;
  apelido: string | null;
  slug: string;
  numero: number;
  categoria_id: string;
  cidade: string | null;
  uf: string | null;
  avatar_url: string | null;
  idade: number | null;
  peso_kg: string | null;
  cor_numero: string | null;
  cor_assinatura: string | null;
  vitorias: number;
  podios: number;
  pontos: number;
  posicao_campeonato: number;
}

function pilotoDeLinha(l: LinhaPiloto): Piloto {
  return {
    id: l.id,
    nome: l.nome,
    apelido: l.apelido ?? undefined,
    slug: l.slug,
    numero: l.numero,
    categoriaId: l.categoria_id,
    cidade: l.cidade ?? undefined,
    uf: l.uf ?? undefined,
    avatarUrl: l.avatar_url ?? undefined,
    idade: l.idade ?? undefined,
    pesoKg: l.peso_kg === null ? undefined : Number(l.peso_kg),
    corNumero: l.cor_numero ?? undefined,
    corAssinatura: l.cor_assinatura ?? undefined,
    vitorias: l.vitorias,
    podios: l.podios,
    pontos: l.pontos,
    posicaoCampeonato: l.posicao_campeonato,
  };
}

export async function lerPilotosReais(): Promise<Piloto[]> {
  const linhas = await consultar<LinhaPiloto>(
    `select id, nome, apelido, slug, numero, categoria_id, cidade, uf, avatar_url,
            idade, peso_kg, cor_numero, cor_assinatura, vitorias, podios, pontos,
            posicao_campeonato
       from piloto order by criado_em, id`,
  );
  return linhas.map(pilotoDeLinha);
}

// Pilotos simulados (se a simulação estiver ligada) primeiro, depois os
// reais — que entram na classificação logo após os simulados.
export async function lerPilotos(): Promise<Piloto[]> {
  const reais = await lerPilotosReais();
  const simulados = [...pilotosSimulados];
  return [
    ...simulados,
    ...reais.map((p, indice) => ({
      ...p,
      posicaoCampeonato: simulados.length + indice + 1,
    })),
  ];
}

// Dentro de uma transação (ver lib/cadastro-store.ts).
export async function inserirPiloto(
  cliente: PoolClient,
  piloto: Piloto,
): Promise<void> {
  await cliente.query(
    `insert into piloto (id, nome, apelido, slug, numero, categoria_id, cidade, uf,
                         avatar_url, idade, peso_kg, cor_numero, cor_assinatura,
                         vitorias, podios, pontos, posicao_campeonato)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      piloto.id,
      piloto.nome,
      piloto.apelido ?? null,
      piloto.slug,
      piloto.numero,
      piloto.categoriaId,
      piloto.cidade ?? null,
      piloto.uf ?? null,
      piloto.avatarUrl ?? null,
      piloto.idade ?? null,
      piloto.pesoKg ?? null,
      piloto.corNumero ?? null,
      piloto.corAssinatura ?? null,
      piloto.vitorias,
      piloto.podios,
      piloto.pontos,
      piloto.posicaoCampeonato,
    ],
  );
}

export async function encontrarPilotoPorSlug(
  slug: string,
): Promise<Piloto | undefined> {
  const pilotos = await lerPilotos();
  return pilotos.find((p) => p.slug === slug);
}

export async function encontrarPilotoPorId(
  id: string,
): Promise<Piloto | undefined> {
  const pilotos = await lerPilotos();
  return pilotos.find((p) => p.id === id);
}
