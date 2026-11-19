import { randomUUID } from "node:crypto";
import { consultar, transacao } from "@/lib/db/conexao";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import type { ResultadoPublicado } from "@/lib/cronometragem/corridas-store";
import { ErroNegocio } from "@/lib/operacao/erros";
import {
  PONTUACAO_PADRAO,
  classificarCampeonato,
  erroDaPontuacao,
  pontuarBateria,
  type BateriaPontuada,
  type ClassificacaoDoPiloto,
  type ConfigDePontuacao,
  type LinhaDeResultado,
  type PunicaoDoCampeonato,
  type TipoDePunicao,
} from "@/lib/pontuacao-campeonato";

// Pontuação, resultados, punições e recursos do campeonato. Os resultados vêm das corridas
// FINALIZADAS na cronometragem (resultado oficial publicado); nada é digitado à mão.

// ---- Tabela de pontos ---------------------------------------------------------------------

export async function lerPontuacao(
  campeonatoId: string,
): Promise<ConfigDePontuacao> {
  try {
    const [l] = await consultar<{
      por_posicao: number[];
      pole: number;
      volta_rapida: number;
      participacao: number;
    }>(
      `select por_posicao, pole, volta_rapida, participacao
         from pontuacao_campeonato where campeonato_id = $1`,
      [campeonatoId],
    );
    if (!l) return PONTUACAO_PADRAO;
    return {
      porPosicao: l.por_posicao,
      pole: l.pole,
      voltaRapida: l.volta_rapida,
      participacao: l.participacao,
    };
  } catch {
    return PONTUACAO_PADRAO;
  }
}

export async function salvarPontuacao(
  campeonatoId: string,
  cfg: ConfigDePontuacao,
  usuarioId: string,
): Promise<void> {
  const erro = erroDaPontuacao(cfg);
  if (erro) throw new ErroNegocio(erro);
  await consultar(
    `insert into pontuacao_campeonato
       (campeonato_id, por_posicao, pole, volta_rapida, participacao, atualizado_por, atualizado_em)
     values ($1, $2::jsonb, $3, $4, $5, $6, clock_timestamp())
     on conflict (campeonato_id) do update
       set por_posicao = excluded.por_posicao, pole = excluded.pole,
           volta_rapida = excluded.volta_rapida, participacao = excluded.participacao,
           atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em`,
    [
      campeonatoId,
      JSON.stringify(cfg.porPosicao),
      cfg.pole,
      cfg.voltaRapida,
      cfg.participacao,
      usuarioId,
    ],
  );
  tempoDaAtualizacao = 0;
}

// ---- Punições -----------------------------------------------------------------------------

export interface PunicaoCompleta extends PunicaoDoCampeonato {
  pilotoNome: string;
  pilotoNumero: number;
  etapaNome: string | null;
  motivo: string;
  criadaEm: string;
}

export async function lerPunicoes(
  campeonatoId: string,
): Promise<PunicaoCompleta[]> {
  try {
    const linhas = await consultar<{
      id: string;
      etapa_id: string | null;
      piloto_id: string;
      tipo: TipoDePunicao;
      pontos: number;
      anulada_em: Date | null;
      piloto_nome: string;
      piloto_numero: number;
      etapa_nome: string | null;
      motivo: string;
      criada_em: Date;
    }>(
      `select u.id, u.etapa_id, u.piloto_id, u.tipo, u.pontos, u.anulada_em,
              coalesce(nullif(trim(p.apelido), ''), p.nome) as piloto_nome,
              p.numero as piloto_numero, e.nome as etapa_nome, u.motivo, u.criada_em
         from punicao_campeonato u
         join piloto p on p.id = u.piloto_id
         left join etapa e on e.id = u.etapa_id
        where u.campeonato_id = $1 order by u.criada_em desc`,
      [campeonatoId],
    );
    return linhas.map((l) => ({
      id: l.id,
      etapaId: l.etapa_id,
      pilotoId: l.piloto_id,
      tipo: l.tipo,
      pontos: l.pontos,
      anulada: l.anulada_em !== null,
      pilotoNome: l.piloto_nome,
      pilotoNumero: l.piloto_numero,
      etapaNome: l.etapa_nome,
      motivo: l.motivo,
      criadaEm: l.criada_em.toISOString(),
    }));
  } catch {
    return [];
  }
}

export interface DadosDaPunicao {
  etapaId: string | null;
  pilotoId: string;
  tipo: string;
  pontos: number;
  motivo: string;
}

export async function criarPunicao(
  campeonatoId: string,
  d: DadosDaPunicao,
  usuarioId: string,
): Promise<void> {
  if (!["advertencia", "perda_pontos", "desclassificacao"].includes(d.tipo)) {
    throw new ErroNegocio("Tipo de punição inválido.");
  }
  const motivo = d.motivo.trim();
  if (motivo.length < 3 || motivo.length > 500) {
    throw new ErroNegocio("Explique o motivo (3 a 500 caracteres).");
  }
  if (d.tipo !== "advertencia" && !d.etapaId) {
    throw new ErroNegocio("Escolha a etapa em que a punição vale.");
  }
  const pontos = d.tipo === "perda_pontos" ? d.pontos : 0;
  if (
    d.tipo === "perda_pontos" &&
    (!Number.isInteger(pontos) || pontos < 1 || pontos > 1000)
  ) {
    throw new ErroNegocio("Informe quantos pontos o piloto perde (1 a 1000).");
  }
  const [piloto] = await consultar(
    `select 1 from campeonato_piloto where campeonato_id = $1 and piloto_id = $2`,
    [campeonatoId, d.pilotoId],
  );
  if (!piloto)
    throw new ErroNegocio("Este piloto não faz parte do campeonato.");
  if (d.etapaId) {
    const [etapa] = await consultar(
      "select 1 from etapa where id = $1 and campeonato_id = $2",
      [d.etapaId, campeonatoId],
    );
    if (!etapa) throw new ErroNegocio("Etapa não encontrada neste campeonato.");
  }
  await consultar(
    `insert into punicao_campeonato (id, campeonato_id, etapa_id, piloto_id, tipo, pontos, motivo, criado_por)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      `pun-${randomUUID().slice(0, 8)}`,
      campeonatoId,
      d.etapaId,
      d.pilotoId,
      d.tipo,
      pontos,
      motivo,
      usuarioId,
    ],
  );
  tempoDaAtualizacao = 0;
}

export async function anularPunicao(
  id: string,
  usuarioId: string,
): Promise<void> {
  const r = await consultar(
    `update punicao_campeonato set anulada_em = clock_timestamp(), anulada_por = $2
      where id = $1 and anulada_em is null returning id`,
    [id, usuarioId],
  );
  if (r.length === 0)
    throw new ErroNegocio("Punição não encontrada ou já anulada.");
  tempoDaAtualizacao = 0;
}

// ---- Recursos -----------------------------------------------------------------------------

export type StatusDoRecurso = "aberto" | "deferido" | "indeferido";

export interface RecursoCompleto {
  id: string;
  pilotoId: string;
  pilotoNome: string;
  pilotoNumero: number;
  etapaId: string | null;
  etapaNome: string | null;
  texto: string;
  status: StatusDoRecurso;
  parecer: string | null;
  criadoEm: string;
  decididoEm: string | null;
}

interface LinhaRecurso {
  id: string;
  piloto_id: string;
  piloto_nome: string;
  piloto_numero: number;
  etapa_id: string | null;
  etapa_nome: string | null;
  texto: string;
  status: StatusDoRecurso;
  parecer: string | null;
  criado_em: Date;
  decidido_em: Date | null;
}

export async function lerRecursos(
  campeonatoId: string,
  pilotoId?: string,
): Promise<RecursoCompleto[]> {
  try {
    const linhas = await consultar<LinhaRecurso>(
      `select r.id, r.piloto_id, coalesce(nullif(trim(p.apelido), ''), p.nome) as piloto_nome,
              p.numero as piloto_numero, r.etapa_id, e.nome as etapa_nome, r.texto,
              r.status, r.parecer, r.criado_em, r.decidido_em
         from recurso r
         join piloto p on p.id = r.piloto_id
         left join etapa e on e.id = r.etapa_id
        where r.campeonato_id = $1 and ($2::text is null or r.piloto_id = $2)
        order by (r.status = 'aberto') desc, r.criado_em desc`,
      [campeonatoId, pilotoId ?? null],
    );
    return linhas.map((l) => ({
      id: l.id,
      pilotoId: l.piloto_id,
      pilotoNome: l.piloto_nome,
      pilotoNumero: l.piloto_numero,
      etapaId: l.etapa_id,
      etapaNome: l.etapa_nome,
      texto: l.texto,
      status: l.status,
      parecer: l.parecer,
      criadoEm: l.criado_em.toISOString(),
      decididoEm: l.decidido_em?.toISOString() ?? null,
    }));
  } catch {
    return [];
  }
}

export async function criarRecurso(
  pilotoId: string,
  campeonatoId: string,
  etapaId: string | null,
  textoBruto: string,
): Promise<void> {
  const texto = textoBruto.trim();
  if (texto.length < 10 || texto.length > 1500) {
    throw new ErroNegocio("Explique o recurso com 10 a 1500 caracteres.");
  }
  const [doCampeonato] = await consultar(
    "select 1 from campeonato_piloto where campeonato_id = $1 and piloto_id = $2",
    [campeonatoId, pilotoId],
  );
  if (!doCampeonato)
    throw new ErroNegocio("Você não faz parte deste campeonato.");
  if (etapaId) {
    const [etapa] = await consultar(
      "select 1 from etapa where id = $1 and campeonato_id = $2",
      [etapaId, campeonatoId],
    );
    if (!etapa) throw new ErroNegocio("Etapa não encontrada.");
  }
  const [abertos] = await consultar<{ n: number }>(
    "select count(*)::int as n from recurso where piloto_id = $1 and campeonato_id = $2 and status = 'aberto'",
    [pilotoId, campeonatoId],
  );
  if ((abertos?.n ?? 0) >= 5) {
    throw new ErroNegocio("Você já tem 5 recursos aguardando resposta.");
  }
  await consultar(
    `insert into recurso (id, campeonato_id, etapa_id, piloto_id, texto)
     values ($1, $2, $3, $4, $5)`,
    [`rec-${randomUUID().slice(0, 8)}`, campeonatoId, etapaId, pilotoId, texto],
  );
}

export async function decidirRecurso(
  id: string,
  decisao: string,
  parecerBruto: string,
  usuarioId: string,
): Promise<void> {
  if (decisao !== "deferido" && decisao !== "indeferido") {
    throw new ErroNegocio("Escolha deferir ou indeferir.");
  }
  const parecer = parecerBruto.trim();
  if (parecer.length < 3 || parecer.length > 1500) {
    throw new ErroNegocio("Escreva o parecer (3 a 1500 caracteres).");
  }
  const r = await consultar(
    `update recurso set status = $2, parecer = $3, decidido_por = $4, decidido_em = clock_timestamp()
      where id = $1 and status = 'aberto' returning id`,
    [id, decisao, parecer, usuarioId],
  );
  if (r.length === 0)
    throw new ErroNegocio("Recurso não encontrado ou já decidido.");
}

// ---- Resultados e classificação -----------------------------------------------------------

export interface BateriaComResultado extends BateriaPontuada {
  corridaId: string;
  etapaNome: string;
  etapaData: string;
  etapaNumero: number;
}

export interface ResultadosDoCampeonato {
  config: ConfigDePontuacao;
  baterias: BateriaComResultado[];
  classificacao: ClassificacaoDoPiloto[];
  punicoes: PunicaoCompleta[];
}

export async function lerResultadosDoCampeonato(
  campeonatoId: string,
): Promise<ResultadosDoCampeonato> {
  const vazio = {
    config: PONTUACAO_PADRAO,
    baterias: [],
    classificacao: [],
    punicoes: [],
  } satisfies ResultadosDoCampeonato;
  try {
    const [config, punicoes, linhas, participantes] = await Promise.all([
      lerPontuacao(campeonatoId),
      lerPunicoes(campeonatoId),
      consultar<{
        bateria_id: string;
        etapa_id: string;
        etapa_nome: string;
        etapa_data: string;
        etapa_numero: number;
        categoria_id: string;
        corrida_id: string;
        resultado_final: ResultadoPublicado;
      }>(
        `select b.id as bateria_id, b.etapa_id, e.nome as etapa_nome,
                to_char(e.data, 'YYYY-MM-DD') as etapa_data, e.numero as etapa_numero,
                b.categoria_id, f.id as corrida_id, f.resultado_final
           from bateria_campeonato b
           join etapa e on e.id = b.etapa_id
           join corrida f on f.classificacao_id = b.corrida_id and f.estado = 'finalizada'
          where e.campeonato_id = $1 and f.resultado_final is not null
          order by e.data, e.hora, b.categoria_id`,
        [campeonatoId],
      ),
      consultar<{ piloto_id: string; categoria_id: string }>(
        `select cp.piloto_id, p.categoria_id from campeonato_piloto cp
           join piloto p on p.id = cp.piloto_id where cp.campeonato_id = $1`,
        [campeonatoId],
      ),
    ]);
    const corridas = linhas.map((l) => l.corrida_id);
    const cps =
      corridas.length === 0
        ? []
        : await consultar<{
            id: string;
            corrida_id: string;
            piloto_id: string | null;
            posicao_grid: number | null;
          }>(
            `select id, corrida_id, piloto_id, posicao_grid from corrida_piloto
              where corrida_id = any($1)`,
            [corridas],
          );
    const baterias: BateriaComResultado[] = linhas.map((l) => {
      const dela = new Map(
        cps.filter((c) => c.corrida_id === l.corrida_id).map((c) => [c.id, c]),
      );
      const resultado = (l.resultado_final.classificacao ?? []).map(
        (x): LinhaDeResultado => {
          const cp = dela.get(x.participanteId);
          return {
            pilotoId: cp?.piloto_id ?? null,
            nome: x.nome,
            posicao: x.posicao,
            situacao: x.situacao,
            voltas: x.voltas,
            melhorVoltaMs: x.melhorVoltaMs,
            posicaoGrid: cp?.posicao_grid ?? null,
          };
        },
      );
      const pontuada = pontuarBateria(
        {
          bateriaId: l.bateria_id,
          etapaId: l.etapa_id,
          categoriaId: l.categoria_id,
          linhas: resultado,
        },
        config,
        punicoes,
      );
      return {
        ...pontuada,
        corridaId: l.corrida_id,
        etapaNome: l.etapa_nome,
        etapaData: l.etapa_data,
        etapaNumero: l.etapa_numero,
      };
    });
    const classificacao = classificarCampeonato(
      baterias,
      participantes.map((p) => ({
        id: p.piloto_id,
        categoriaId: p.categoria_id,
      })),
    );
    return { config, baterias, classificacao, punicoes };
  } catch {
    return vazio;
  }
}

// Mantém pontos, vitórias, pódios e posição gravados em cada piloto (o que o perfil, as listas e a
// home já leem) iguais à classificação calculada. Roda no máximo a cada 15 s; só grava o que mudou.
let tempoDaAtualizacao = 0;
const VALIDADE_MS = 15_000;

export async function atualizarClassificacaoDosPilotos(): Promise<void> {
  if (Date.now() - tempoDaAtualizacao < VALIDADE_MS) return;
  tempoDaAtualizacao = Date.now();
  try {
    const ativo = await lerCampeonatoAtivo();
    if (!ativo) return;
    const { classificacao } = await lerResultadosDoCampeonato(ativo.id);
    await transacao(async (cliente) => {
      for (const c of classificacao) {
        await cliente.query(
          `update piloto set pontos = $2, vitorias = $3, podios = $4, posicao_campeonato = $5
            where id = $1 and (pontos, vitorias, podios, posicao_campeonato)
                  is distinct from ($2::int, $3::int, $4::int, $5::int)`,
          [c.pilotoId, c.pontos, c.vitorias, c.podios, c.posicao],
        );
      }
    });
  } catch {
    // Sem as tabelas novas ainda: segue com o que já estava gravado.
  }
}

export async function forcarAtualizacaoDaClassificacao(): Promise<void> {
  tempoDaAtualizacao = 0;
  await atualizarClassificacaoDosPilotos();
}
