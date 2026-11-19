import type { PoolClient } from "pg";
import { consultar, transacao } from "@/lib/db/conexao";
import { pilotos as pilotosSimulados } from "@/lib/mock/data";
import { idadeDe } from "@/lib/cadastro-validacao";
import { hojeEmSaoPaulo } from "@/lib/operacao/tempo";
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
  foto_embutida: boolean;
  foto_tam: number | null;
  idade: number | null;
  nascimento: string | null;
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
    // Foto enviada no cadastro fica no banco como data URI; a página recebe só o endereço (cacheável)
    // em vez de levar centenas de KB de base64 dentro do HTML.
    avatarUrl: l.foto_embutida
      ? `/api/pilotos/${l.id}/foto?v=${l.foto_tam ?? 0}`
      : (l.avatar_url ?? undefined),
    nascimento: l.nascimento ?? undefined,
    // A idade vem da data de nascimento; cadastros antigos (sem data) mantêm a idade gravada.
    idade: l.nascimento
      ? idadeDe(l.nascimento, hojeEmSaoPaulo())
      : (l.idade ?? undefined),
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
    `select id, nome, apelido, slug, numero, categoria_id, cidade, uf,
            case when avatar_url like 'data:%' then null else avatar_url end as avatar_url,
            coalesce(avatar_url like 'data:%', false) as foto_embutida,
            length(avatar_url) as foto_tam, idade,
            to_char(nascimento, 'YYYY-MM-DD') as nascimento, peso_kg, cor_numero, cor_assinatura, vitorias, podios, pontos,
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
      // Posição real (gravada pela classificação do campeonato); sem ela, a ordem de cadastro.
      posicaoCampeonato:
        p.posicaoCampeonato > 0
          ? p.posicaoCampeonato
          : simulados.length + indice + 1,
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
                         avatar_url, idade, nascimento, peso_kg, cor_numero, cor_assinatura,
                         vitorias, podios, pontos, posicao_campeonato)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
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
      piloto.nascimento ?? null,
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

export class ErroDePerfil extends Error {}

export interface DadosDoPerfil {
  nome: string;
  apelido: string;
  numero: number;
  nascimento: string;
  // undefined = mantém a foto atual; string vazia = remove.
  avatarUrl?: string;
}

// Piloto edita o próprio perfil. O número é único: a conferência prévia dá a mensagem amigável e o
// índice único do banco barra a corrida de dois pilotos escolhendo o mesmo número ao mesmo tempo.
export async function atualizarPerfilDoPiloto(
  pilotoId: string,
  dados: DadosDoPerfil,
  idade: number,
): Promise<void> {
  const [outro] = await consultar<{ id: string }>(
    "select id from piloto where numero = $1 and id <> $2 limit 1",
    [dados.numero, pilotoId],
  );
  if (outro) {
    throw new ErroDePerfil(
      `O número ${dados.numero} já está em uso por outro piloto.`,
    );
  }
  try {
    await transacao(async (cliente) => {
      const r = await cliente.query(
        `update piloto
            set nome = $2, apelido = $3, numero = $4, nascimento = $5, idade = $6,
                avatar_url = case when $7::boolean then $8 else avatar_url end
          where id = $1`,
        [
          pilotoId,
          dados.nome,
          dados.apelido,
          dados.numero,
          dados.nascimento,
          idade,
          dados.avatarUrl !== undefined,
          dados.avatarUrl ? dados.avatarUrl : null,
        ],
      );
      if (r.rowCount === 0) throw new ErroDePerfil("Piloto não encontrado.");
      await cliente.query(
        `update perfil
            set nome = $2,
                avatar_url = case when $3::boolean then $4 else avatar_url end
          where piloto_id = $1`,
        [
          pilotoId,
          dados.apelido,
          dados.avatarUrl !== undefined,
          dados.avatarUrl ? dados.avatarUrl : null,
        ],
      );
    });
  } catch (erro) {
    if (
      typeof erro === "object" &&
      erro !== null &&
      (erro as { code?: string }).code === "23505"
    ) {
      throw new ErroDePerfil(
        `O número ${dados.numero} já está em uso por outro piloto.`,
      );
    }
    throw erro;
  }
}
