import { randomUUID } from "node:crypto";
import { consultar } from "@/lib/db/conexao";
import {
  adicionarPiloto,
  criarCorrida,
  excluirCorrida,
  lerPainel,
  type EstadoCorrida,
} from "@/lib/cronometragem/corridas-store";
import { textoDiferenca } from "@/lib/cronometragem/rotulos";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import { categorias } from "@/lib/mock/data";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";

// Bateria do campeonato = uma categoria numa etapa = uma bateria REAL da cronometragem: primeiro a
// classificação (define o grid pela melhor volta) e, ao final dela, a corrida. Os pilotos são os
// inscritos (confirmados) da etapa na categoria; os tempos vêm do decoder, sem digitar nada.
export interface BateriaDoCampeonato {
  id: string;
  etapaId: string;
  categoriaId: string;
  // A classificação (corrida da cronometragem criada com a bateria).
  classificacaoId: string;
  estadoClassificacao: EstadoCorrida;
  // A corrida, quando já nasceu da classificação.
  corridaId: string | null;
  estadoCorrida: EstadoCorrida | null;
  pilotos: number;
}

interface LinhaBateria {
  id: string;
  etapa_id: string;
  categoria_id: string;
  classificacao_id: string;
  estado_classificacao: EstadoCorrida;
  corrida_id: string | null;
  estado_corrida: EstadoCorrida | null;
  pilotos: number;
}

const SELECT = `select b.id, b.etapa_id, b.categoria_id, b.corrida_id as classificacao_id,
       q.estado as estado_classificacao, f.id as corrida_id, f.estado as estado_corrida,
       (select count(*)::int from corrida_piloto p where p.corrida_id = q.id) as pilotos
  from bateria_campeonato b
  join corrida q on q.id = b.corrida_id
  join etapa e on e.id = b.etapa_id
  left join corrida f on f.classificacao_id = q.id`;

function deLinha(l: LinhaBateria): BateriaDoCampeonato {
  return {
    id: l.id,
    etapaId: l.etapa_id,
    categoriaId: l.categoria_id,
    classificacaoId: l.classificacao_id,
    estadoClassificacao: l.estado_classificacao,
    corridaId: l.corrida_id,
    estadoCorrida: l.estado_corrida,
    pilotos: l.pilotos,
  };
}

export async function lerBateriasDoCampeonato(
  campeonatoId: string,
): Promise<BateriaDoCampeonato[]> {
  try {
    const linhas = await consultar<LinhaBateria>(
      `${SELECT} where e.campeonato_id = $1 order by e.data, e.hora, b.categoria_id`,
      [campeonatoId],
    );
    return linhas.map(deLinha);
  } catch {
    return [];
  }
}

interface Inscrito {
  piloto_id: string;
  nome: string;
  categoria_id: string;
}

// Inscrições confirmadas da etapa, na ordem do número do piloto.
async function inscritosConfirmados(etapaId: string): Promise<Inscrito[]> {
  return consultar<Inscrito>(
    `select i.piloto_id, coalesce(nullif(trim(p.apelido), ''), p.nome) as nome, i.categoria_id
       from inscricao i join piloto p on p.id = i.piloto_id
      where i.etapa_id = $1 and i.status = 'confirmada'
      order by p.numero`,
    [etapaId],
  );
}

// Cria uma bateria para cada categoria que tem inscritos confirmados e ainda não tem bateria.
export async function criarBateriasDaEtapa(
  etapaId: string,
  ator: Ator,
): Promise<{ criadas: number; semInscritos: boolean }> {
  await aplicarAjustesDeCategoria();
  const [etapa] = await consultar<{
    id: string;
    nome: string;
    campeonato_id: string;
    status: string;
  }>("select id, nome, campeonato_id, status from etapa where id = $1", [
    etapaId,
  ]);
  if (!etapa) throw new ErroNegocio("Etapa não encontrada.");
  if (etapa.status === "encerrada" || etapa.status === "cancelada") {
    throw new ErroNegocio("Esta etapa já foi encerrada ou cancelada.");
  }
  const inscritos = await inscritosConfirmados(etapaId);
  if (inscritos.length === 0) return { criadas: 0, semInscritos: true };
  const existentes = new Set(
    (
      await consultar<{ categoria_id: string }>(
        "select categoria_id from bateria_campeonato where etapa_id = $1",
        [etapaId],
      )
    ).map((e) => e.categoria_id),
  );
  const porCategoria = new Map<string, Inscrito[]>();
  for (const i of inscritos) {
    porCategoria.set(i.categoria_id, [
      ...(porCategoria.get(i.categoria_id) ?? []),
      i,
    ]);
  }
  let criadas = 0;
  for (const [categoriaId, lista] of porCategoria) {
    if (existentes.has(categoriaId)) continue;
    const nomeCategoria =
      categorias.find((c) => c.id === categoriaId)?.nome ?? categoriaId;
    const corridaId = await criarCorrida(
      { nome: `${etapa.nome} · ${nomeCategoria}`, fase: "classificacao" },
      ator,
    );
    await consultar(
      `insert into bateria_campeonato (id, etapa_id, categoria_id, corrida_id)
       values ($1, $2, $3, $4)`,
      [`bat-${randomUUID().slice(0, 8)}`, etapaId, categoriaId, corridaId],
    );
    for (const i of lista) {
      await adicionarPiloto(corridaId, i.nome, ator, i.piloto_id);
    }
    criadas++;
  }
  return { criadas, semInscritos: false };
}

// Acrescenta à classificação os inscritos confirmados que ainda não estão nela.
export async function sincronizarPilotosDaBateria(
  bateriaId: string,
  ator: Ator,
): Promise<number> {
  const [b] = await consultar<{
    etapa_id: string;
    categoria_id: string;
    corrida_id: string;
  }>(
    "select etapa_id, categoria_id, corrida_id from bateria_campeonato where id = $1",
    [bateriaId],
  );
  if (!b) throw new ErroNegocio("Bateria não encontrada.");
  const ja = new Set(
    (
      await consultar<{ piloto_id: string | null }>(
        "select piloto_id from corrida_piloto where corrida_id = $1",
        [b.corrida_id],
      )
    )
      .map((l) => l.piloto_id)
      .filter((x): x is string => Boolean(x)),
  );
  const novos = (await inscritosConfirmados(b.etapa_id)).filter(
    (i) => i.categoria_id === b.categoria_id && !ja.has(i.piloto_id),
  );
  for (const i of novos) {
    await adicionarPiloto(b.corrida_id, i.nome, ator, i.piloto_id);
  }
  return novos.length;
}

export async function excluirBateriaDoCampeonato(
  bateriaId: string,
  ator: Ator,
): Promise<void> {
  const [b] = await consultar<{
    corrida_id: string;
    final_id: string | null;
  }>(
    `select b.corrida_id, f.id as final_id
       from bateria_campeonato b left join corrida f on f.classificacao_id = b.corrida_id
      where b.id = $1`,
    [bateriaId],
  );
  if (!b) throw new ErroNegocio("Bateria não encontrada.");
  if (b.final_id) {
    throw new ErroNegocio(
      "A corrida desta bateria já foi criada na cronometragem. Cancele por lá.",
    );
  }
  // Apaga a bateria da cronometragem (só se ainda não começou); o vínculo some junto.
  await excluirCorrida(b.corrida_id, ator);
}

// ---- Ao vivo ------------------------------------------------------------------------------

export interface LinhaAoVivo {
  posicao: number | null;
  nome: string;
  numero: number | null;
  kartNumero: string | null;
  voltas: number;
  ultimaVoltaMs: number | null;
  melhorVoltaMs: number | null;
  diferenca: string;
}

export interface AoVivoDoCampeonato {
  bateriaId: string;
  etapaNome: string;
  categoriaId: string;
  fase: "classificacao" | "corrida" | "unica";
  estado: EstadoCorrida;
  corridaId: string;
  linhas: LinhaAoVivo[];
}

// A bateria do campeonato que está rodando agora (classificação ou corrida), com a classificação
// atual vinda do decoder. Sem bateria rodando: null.
export async function lerAoVivoDoCampeonato(): Promise<AoVivoDoCampeonato | null> {
  interface LinhaViva {
    bateria_id: string;
    etapa_nome: string;
    categoria_id: string;
    corrida_id: string;
    fase: "classificacao" | "corrida" | "unica";
    estado: EstadoCorrida;
  }
  let l: LinhaViva | undefined;
  try {
    [l] = await consultar<LinhaViva>(
      `select b.id as bateria_id, e.nome as etapa_nome, b.categoria_id,
              c.id as corrida_id, c.fase, c.estado
         from corrida c
         join bateria_campeonato b on b.corrida_id = c.id or c.classificacao_id = b.corrida_id
         join etapa e on e.id = b.etapa_id
        where c.estado in ('em_andamento', 'encerrando')
        order by c.iniciada_em desc nulls last limit 1`,
    );
  } catch {
    return null;
  }
  if (!l) return null;
  const painel = await lerPainel(l.corrida_id);
  if (!painel) return null;
  const numeros = new Map(
    (
      await consultar<{ id: string; numero: number | null }>(
        `select cp.id, p.numero from corrida_piloto cp
           left join piloto p on p.id = cp.piloto_id where cp.corrida_id = $1`,
        [l.corrida_id],
      )
    ).map((n) => [n.id, n.numero]),
  );
  return {
    bateriaId: l.bateria_id,
    etapaNome: l.etapa_nome,
    categoriaId: l.categoria_id,
    fase: l.fase,
    estado: l.estado,
    corridaId: l.corrida_id,
    linhas: painel.classificacao.map((c) => ({
      posicao: c.posicao,
      nome: c.nome,
      numero: numeros.get(c.participanteId) ?? null,
      kartNumero: c.kartNumero,
      voltas: c.voltas,
      ultimaVoltaMs: c.ultimaVoltaMs,
      melhorVoltaMs: c.melhorVoltaMs,
      diferenca: textoDiferenca(c.diferenca),
    })),
  };
}
