// Ordem do GRID da corrida pela REGRA VIGENTE, a partir do resultado publicado da classificação.
// Extraída de `criarCorridaDaClassificacao` (corridas-store.ts) para ser testável. Função pura.
//
// Sem correção (padrão, comportamento de sempre):
//   melhor volta do resultado publicado; empate, ordem de cadastro; sem tempo, atrás, por cadastro.
//   (Um DSQ ou DNS com tempo entra pela melhor volta e pode ficar na pole.)
//
// Com a CORREÇÃO DE DSQ/DNS (ativação explícita, desligada por padrão):
//   DSQ e DNS não são ordenados pela melhor volta; vão para o fim do grid, depois de quem não tem
//   tempo, na ordem de cadastro. Eles NÃO são retirados do grid: se largam ou não continua sendo uma
//   decisão regulamentar ainda não aprovada (docs/regras-regulamentares-proposta.md).

export interface ParticipanteDoGrid {
  id: string;
}

export interface LinhaDoResultadoPublicado {
  participanteId: string;
  melhorVoltaMs: number | null;
  situacao?: string;
}

const SEM_POSICAO_CLASSIFICATORIA = new Set(["dsq", "dns"]);

export function ordenarGridVigente<T extends ParticipanteDoGrid>(
  participantes: T[],
  classificacaoPublicada: LinhaDoResultadoPublicado[] | null | undefined,
  opcoes: { corrigirDsqDns: boolean } = { corrigirDsqDns: false },
): T[] {
  const porId = new Map(
    (classificacaoPublicada ?? []).map((l) => [l.participanteId, l]),
  );
  const grupo = (p: T): number => {
    if (!opcoes.corrigirDsqDns) return 0;
    const s = porId.get(p.id)?.situacao;
    return s && SEM_POSICAO_CLASSIFICATORIA.has(s) ? 1 : 0;
  };
  return participantes
    .map((p, i) => ({
      p,
      i,
      g: grupo(p),
      volta: porId.get(p.id)?.melhorVoltaMs ?? null,
    }))
    .sort((a, b) => {
      if (a.g !== b.g) return a.g - b.g;
      if (a.g === 1) return a.i - b.i; // DSQ/DNS: no fim, por cadastro
      if (a.volta === null && b.volta === null) return a.i - b.i;
      if (a.volta === null) return 1;
      if (b.volta === null) return -1;
      return a.volta - b.volta || a.i - b.i;
    })
    .map((x) => x.p);
}

// ATIVAÇÃO da correção de DSQ/DNS (desligada por padrão): variável GRIDLAP_CORRECAO_DSQ_DESDE com uma
// data/hora ISO. Vale só para sessões de CLASSIFICAÇÃO criadas a partir dessa data; sessões
// existentes e resultados publicados não mudam.
export const VARIAVEL_CORRECAO_DSQ = "GRIDLAP_CORRECAO_DSQ_DESDE";

export function lerCorrecaoDsqDesde(
  env: Record<string, string | undefined> = process.env,
): Date | null {
  const bruto = env[VARIAVEL_CORRECAO_DSQ]?.trim();
  if (!bruto) return null;
  const data = new Date(bruto);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function correcaoDsqAtiva(
  sessao: { fase: string; criadoEm: Date },
  desde: Date | null,
): boolean {
  return (
    sessao.fase === "classificacao" &&
    desde !== null &&
    sessao.criadoEm.getTime() >= desde.getTime()
  );
}
