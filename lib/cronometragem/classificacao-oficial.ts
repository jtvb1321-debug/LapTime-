import {
  classificarPorMelhorVolta,
  type LinhaPorMelhorVolta,
  type ResultadoPorMelhorVolta,
} from "@/lib/cronometragem/classificacao-melhor-volta";
import type { FaseCorrida } from "@/lib/cronometragem/corridas-store";
import type { LinhaClassificacao } from "@/lib/cronometragem/motor";
import {
  montarPainel,
  segundaMelhorVolta,
  type LinhaDoPainel,
} from "@/lib/cronometragem/painel-visual";
import { montarQualy, type LinhaQualy } from "@/lib/cronometragem/relatorios";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";
import {
  correcaoDsqAtiva,
  lerCorrecaoDsqDesde,
} from "@/lib/cronometragem/grid-vigente";

// CAMADA COMPARTILHADA da classificação oficial: uma fonte de verdade por tipo de sessão, usada por
// todos os consumidores (cronometragem ao vivo, resultados da classificação, relatórios e painel),
// para que nenhum componente tenha uma regra própria.
//
//   Classificação: critério da sessão (hoje sempre o ATUAL; a melhor volta só com ativação explícita)
//   Corrida:       ordem oficial do motor, sempre
//   Grid:          resultado publicado da classificação + elegibilidade + decisões autorizadas
//                  (ver lib/cronometragem/previa-do-grid.ts; publicação pela nova regra NÃO habilitada)
//
// ATIVAÇÃO (desabilitada por padrão): variável de ambiente GRIDLAP_CLASSIFICACAO_MELHOR_VOLTA_DESDE
// com uma data/hora ISO. Só sessões de classificação CRIADAS a partir desse instante usam a melhor
// volta; as já existentes (inclusive em andamento) e os resultados publicados não mudam. Sem a
// variável, tudo funciona exatamente como antes.

export type CriterioDaSessao =
  // Regra vigente (a de antes desta etapa): motor e montarQualy/painel como sempre.
  | "atual"
  // Regra vigente com a CORREÇÃO de DSQ/DNS (ativação explícita): na qualificação e no painel, DSQ e
  // DNS não recebem posição pela melhor volta e vão para o fim, sem posição. Torre: motor (igual).
  | "atual_corrigido_dsq"
  // Classificação por melhor volta (classificarPorMelhorVolta), após ativação explícita.
  | "melhor_volta_v1";

export interface ConfigDeClassificacao {
  melhorVoltaAtivaDesde: Date | null;
  // Correção de DSQ/DNS na regra vigente (GRIDLAP_CORRECAO_DSQ_DESDE). Opcional: ausente = desligada.
  correcaoDsqDesde?: Date | null;
}

export const VARIAVEL_DE_ATIVACAO = "GRIDLAP_CLASSIFICACAO_MELHOR_VOLTA_DESDE";

export function lerConfigDeClassificacao(
  env: Record<string, string | undefined> = process.env,
): ConfigDeClassificacao {
  const correcaoDsqDesde = lerCorrecaoDsqDesde(env);
  const bruto = env[VARIAVEL_DE_ATIVACAO]?.trim();
  if (!bruto) return { melhorVoltaAtivaDesde: null, correcaoDsqDesde };
  const data = new Date(bruto);
  return {
    melhorVoltaAtivaDesde: Number.isNaN(data.getTime()) ? null : data,
    correcaoDsqDesde,
  };
}

export function criterioDaSessao(
  corrida: { fase: FaseCorrida; criadoEm: Date },
  config: ConfigDeClassificacao,
): CriterioDaSessao {
  if (corrida.fase !== "classificacao") return "atual";
  const desde = config.melhorVoltaAtivaDesde;
  if (desde && corrida.criadoEm.getTime() >= desde.getTime()) {
    return "melhor_volta_v1";
  }
  if (correcaoDsqAtiva(corrida, config.correcaoDsqDesde ?? null)) {
    return "atual_corrigido_dsq";
  }
  return "atual";
}

export const ROTULO_DO_CRITERIO: Record<CriterioDaSessao, string> = {
  atual: "Ordem oficial do motor de cronometragem",
  atual_corrigido_dsq: "Ordem oficial do motor de cronometragem",
  melhor_volta_v1: "Ordem oficial: melhor volta válida (critério ativado)",
};

// DSQ e DNS não recebem posição classificatória (regra aprovada; usada pela correção e pela melhor volta).
const SEM_POSICAO = new Set(["dsq", "dns"]);

// ---- Ordem para a cronometragem ao vivo ----------------------------------------------------

export interface OrdemDaSessao {
  criterio: CriterioDaSessao;
  // Linhas do motor na ordem a exibir.
  linhas: LinhaClassificacao[];
  // Posição a exibir por participante.
  posicao: Map<string, number | null>;
  // Presente só no critério de melhor volta.
  melhorVolta: ResultadoPorMelhorVolta | null;
}

export function ordemDaSessao(
  classificacao: LinhaClassificacao[],
  criterio: CriterioDaSessao,
): OrdemDaSessao {
  if (criterio !== "melhor_volta_v1") {
    return {
      criterio,
      linhas: classificacao,
      posicao: new Map(classificacao.map((l) => [l.participanteId, l.posicao])),
      melhorVolta: null,
    };
  }
  const r = classificarPorMelhorVolta(classificacao);
  const porId = new Map(classificacao.map((l) => [l.participanteId, l]));
  return {
    criterio,
    linhas: r.linhas.map((l) => porId.get(l.participanteId)!),
    posicao: new Map(r.linhas.map((l) => [l.participanteId, l.posicao])),
    melhorVolta: r,
  };
}

// ---- Resultados da classificação e relatórios (tabela "Qualificação") ------------------------

function media(l: LinhaClassificacao): number | null {
  return l.voltasLista.length > 0
    ? Math.round(
        l.voltasLista.reduce((t, v) => t + v.tempoMs, 0) / l.voltasLista.length,
      )
    : null;
}

export function qualyDaSessao(
  classificacao: LinhaClassificacao[],
  criterio: CriterioDaSessao,
): LinhaQualy[] {
  if (criterio === "atual") return montarQualy(classificacao);
  if (criterio === "atual_corrigido_dsq") {
    // Mesma regra vigente (montarQualy), só que DSQ e DNS ficam fora da ordenação e vão para o fim,
    // sem posição e sem diferença.
    const fora = classificacao.filter((l) => SEM_POSICAO.has(l.situacao));
    const dentro = classificacao.filter((l) => !SEM_POSICAO.has(l.situacao));
    return [
      ...montarQualy(dentro),
      ...montarQualy(fora).map((q) => ({
        ...q,
        posicao: null,
        diferencaMs: null,
      })),
    ];
  }
  const r = classificarPorMelhorVolta(classificacao);
  const porId = new Map(classificacao.map((l) => [l.participanteId, l]));
  const lider = r.linhas.find((l) => l.posicao === 1)?.melhorVoltaMs ?? null;
  return r.linhas.map((p: LinhaPorMelhorVolta): LinhaQualy => {
    const l = porId.get(p.participanteId)!;
    return {
      posicao: p.posicao,
      nome: p.nome,
      kartNumero: p.kartNumero,
      melhorVoltaMs: p.estado === "classificado" ? p.melhorVoltaMs : null,
      melhorVoltaNumero:
        p.estado === "classificado" ? l.melhorVoltaNumero : null,
      diferencaMs:
        p.posicao !== null &&
        p.posicao !== 1 &&
        lider !== null &&
        p.melhorVoltaMs !== null
          ? p.melhorVoltaMs - lider
          : null,
      voltas: l.voltas,
      mediaMs: media(l),
    };
  });
}

// ---- Painel de resultados ------------------------------------------------------------------

const SEM_RESULTADO = new Set([
  "dns",
  "dnf",
  "dsq",
  "nao_largou",
  "sem_volta",
  "sem_sensor",
]);
const mais = (ms: number) => `+${formatarTempoVolta(ms)}`;

export function painelDaSessao(
  classificacao: LinhaClassificacao[],
  ehClassificacao: boolean,
  criterio: CriterioDaSessao,
): {
  linhas: LinhaDoPainel[];
  melhor: ReturnType<typeof montarPainel>["melhor"];
} {
  if (criterio === "atual") return montarPainel(classificacao, ehClassificacao);
  if (criterio === "atual_corrigido_dsq") {
    // Regra vigente do painel (montarPainel); só na classificação (por melhor volta) DSQ e DNS saem da
    // ordenação e vão para o fim, sem posição. A melhor volta da prova continua a do painel completo.
    const completo = montarPainel(classificacao, ehClassificacao);
    if (!ehClassificacao) return completo;
    const dentro = montarPainel(
      classificacao.filter((l) => !SEM_POSICAO.has(l.situacao)),
      true,
    );
    const fora = montarPainel(
      classificacao.filter((l) => SEM_POSICAO.has(l.situacao)),
      true,
    ).linhas.map((l) => ({
      ...l,
      pos: null,
      paraLider: "—",
      paraAnterior: "—",
      naoCompletou: true,
      temMelhorGeral:
        completo.melhor?.linha.participanteId === l.linha.participanteId,
    }));
    return {
      linhas: [
        ...dentro.linhas.map((l) => ({
          ...l,
          temMelhorGeral:
            completo.melhor?.linha.participanteId === l.linha.participanteId,
        })),
        ...fora,
      ],
      melhor: completo.melhor,
    };
  }
  // Melhor volta: só a ORDEM e a POSIÇÃO vêm da função oficial; o resto é formatação do painel.
  const base = montarPainel(classificacao, ehClassificacao);
  const r = classificarPorMelhorVolta(classificacao);
  const porId = new Map(classificacao.map((l) => [l.participanteId, l]));
  const lider = r.linhas.find((l) => l.posicao === 1)?.melhorVoltaMs ?? null;
  let anterior: number | null = null;
  const linhas = r.linhas.map((p): LinhaDoPainel => {
    const l = porId.get(p.participanteId)!;
    const melhorValida = p.estado === "classificado" ? p.melhorVoltaMs : null;
    const linha: LinhaDoPainel = {
      linha: l,
      pos: p.posicao,
      segundaMelhor: segundaMelhorVolta(l),
      paraLider:
        p.posicao !== null &&
        p.posicao !== 1 &&
        lider !== null &&
        melhorValida !== null
          ? mais(melhorValida - lider)
          : "—",
      paraAnterior:
        p.posicao !== null &&
        anterior !== null &&
        melhorValida !== null &&
        p.posicao !== 1
          ? mais(Math.max(0, melhorValida - anterior))
          : "—",
      faixa: null,
      naoCompletou: SEM_RESULTADO.has(l.situacao) || p.posicao === null,
      temMelhorGeral: base.melhor?.linha.participanteId === l.participanteId,
    };
    if (melhorValida !== null && p.posicao !== null) anterior = melhorValida;
    return linha;
  });
  return { linhas, melhor: base.melhor };
}
