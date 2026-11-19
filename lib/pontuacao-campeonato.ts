// Regra de pontuação do campeonato (função pura, sem banco): a partir dos resultados oficiais das
// corridas, da tabela de pontos e das punições, calcula os pontos de cada piloto e a classificação
// por categoria. Tudo que aparece como resultado/classificação no painel e no site vem daqui.

export interface ConfigDePontuacao {
  // Pontos por posição de chegada: índice 0 = 1º lugar.
  porPosicao: number[];
  // Bônus de pole (largar em 1º, definido pela classificação) e de volta mais rápida da corrida.
  pole: number;
  voltaRapida: number;
  // Pontos só por participar (largar), somados aos demais.
  participacao: number;
}

export const PONTUACAO_PADRAO: ConfigDePontuacao = {
  porPosicao: [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  pole: 1,
  voltaRapida: 1,
  participacao: 0,
};

export interface LinhaDeResultado {
  pilotoId: string | null;
  nome: string;
  posicao: number | null;
  // "finalizou", "dns", "dnf", "dsq"... (situação da cronometragem)
  situacao: string;
  voltas: number;
  melhorVoltaMs: number | null;
  // Posição de largada (1 = pole), vinda da classificação.
  posicaoGrid: number | null;
}

export interface ResultadoDaBateria {
  bateriaId: string;
  etapaId: string;
  categoriaId: string;
  linhas: LinhaDeResultado[];
}

export type TipoDePunicao = "advertencia" | "perda_pontos" | "desclassificacao";

export interface PunicaoDoCampeonato {
  id: string;
  etapaId: string | null;
  pilotoId: string;
  tipo: TipoDePunicao;
  // Só em "perda_pontos": quantos pontos saem da etapa.
  pontos: number;
  anulada: boolean;
}

export interface LinhaPontuada extends LinhaDeResultado {
  pontosPosicao: number;
  bonusPole: number;
  bonusVoltaRapida: number;
  participacao: number;
  penalidade: number;
  desclassificada: boolean;
  pole: boolean;
  voltaRapida: boolean;
  total: number;
}

export interface BateriaPontuada {
  bateriaId: string;
  etapaId: string;
  categoriaId: string;
  linhas: LinhaPontuada[];
}

export interface ClassificacaoDoPiloto {
  pilotoId: string;
  categoriaId: string;
  pontos: number;
  vitorias: number;
  podios: number;
  poles: number;
  voltasRapidas: number;
  // Posição na categoria (1 = líder).
  posicao: number;
  porEtapa: Record<string, number>;
}

const SEM_PONTOS = new Set(["dsq", "dns", "nao_largou", "sem_sensor"]);
const NAO_LARGOU = new Set(["dns", "nao_largou", "sem_sensor"]);

export function pontosDaPosicao(
  cfg: ConfigDePontuacao,
  posicao: number | null,
): number {
  if (posicao === null || posicao < 1) return 0;
  return cfg.porPosicao[posicao - 1] ?? 0;
}

// Valida a tabela editada no painel (devolve o erro em texto, ou null se estiver ok).
export function erroDaPontuacao(cfg: ConfigDePontuacao): string | null {
  if (cfg.porPosicao.length < 1 || cfg.porPosicao.length > 40) {
    return "A tabela precisa ter de 1 a 40 posições.";
  }
  const valores = [
    ...cfg.porPosicao,
    cfg.pole,
    cfg.voltaRapida,
    cfg.participacao,
  ];
  if (valores.some((v) => !Number.isInteger(v) || v < 0 || v > 1000)) {
    return "Os pontos devem ser números inteiros de 0 a 1000.";
  }
  return null;
}

export function pontuarBateria(
  b: ResultadoDaBateria,
  cfg: ConfigDePontuacao,
  punicoes: PunicaoDoCampeonato[],
): BateriaPontuada {
  const ativas = punicoes.filter((p) => !p.anulada && p.etapaId === b.etapaId);
  const elegiveis = b.linhas.filter(
    (l) => l.posicao !== null && !SEM_PONTOS.has(l.situacao),
  );
  const comVolta = elegiveis.filter(
    (l) => l.melhorVoltaMs !== null && l.melhorVoltaMs > 0,
  );
  const rapida = comVolta.reduce<LinhaDeResultado | null>(
    (melhor, l) =>
      !melhor ||
      (l.melhorVoltaMs ?? Infinity) < (melhor.melhorVoltaMs ?? Infinity)
        ? l
        : melhor,
    null,
  );

  const linhas = b.linhas.map((l): LinhaPontuada => {
    const dela = ativas.filter((p) => p.pilotoId === l.pilotoId);
    const desclassificada =
      l.situacao === "dsq" || dela.some((p) => p.tipo === "desclassificacao");
    const largou = !NAO_LARGOU.has(l.situacao);
    const elegivel = l.posicao !== null && !SEM_PONTOS.has(l.situacao);
    const ehPole = l.posicaoGrid === 1 && largou && l.situacao !== "dsq";
    const ehRapida = elegivel && l === rapida;
    const pontosPosicao = elegivel ? pontosDaPosicao(cfg, l.posicao) : 0;
    const bonusPole = ehPole ? cfg.pole : 0;
    const bonusVoltaRapida = ehRapida ? cfg.voltaRapida : 0;
    const participacao = largou && l.situacao !== "dsq" ? cfg.participacao : 0;
    const penalidade = dela
      .filter((p) => p.tipo === "perda_pontos")
      .reduce((t, p) => t + p.pontos, 0);
    const bruto = pontosPosicao + bonusPole + bonusVoltaRapida + participacao;
    return {
      ...l,
      pontosPosicao,
      bonusPole,
      bonusVoltaRapida,
      participacao,
      penalidade,
      desclassificada,
      pole: ehPole,
      voltaRapida: ehRapida,
      total: desclassificada ? 0 : Math.max(0, bruto - penalidade),
    };
  });
  return {
    bateriaId: b.bateriaId,
    etapaId: b.etapaId,
    categoriaId: b.categoriaId,
    linhas,
  };
}

// Soma as baterias por piloto e ordena a categoria: pontos, depois vitórias, pódios e poles.
export function classificarCampeonato(
  baterias: BateriaPontuada[],
  idsDoCampeonato: { id: string; categoriaId: string }[] = [],
): ClassificacaoDoPiloto[] {
  const porPiloto = new Map<string, ClassificacaoDoPiloto>();
  const garantir = (id: string, categoriaId: string) => {
    let c = porPiloto.get(id);
    if (!c) {
      c = {
        pilotoId: id,
        categoriaId,
        pontos: 0,
        vitorias: 0,
        podios: 0,
        poles: 0,
        voltasRapidas: 0,
        posicao: 0,
        porEtapa: {},
      };
      porPiloto.set(id, c);
    }
    return c;
  };
  for (const p of idsDoCampeonato) garantir(p.id, p.categoriaId);
  for (const b of baterias) {
    for (const l of b.linhas) {
      if (!l.pilotoId) continue;
      const c = garantir(l.pilotoId, b.categoriaId);
      c.pontos += l.total;
      c.porEtapa[b.etapaId] = (c.porEtapa[b.etapaId] ?? 0) + l.total;
      const valida =
        l.posicao !== null && !l.desclassificada && !SEM_PONTOS.has(l.situacao);
      if (valida && l.posicao === 1) c.vitorias++;
      if (valida && l.posicao !== null && l.posicao <= 3) c.podios++;
      if (l.pole && !l.desclassificada) c.poles++;
      if (l.voltaRapida && !l.desclassificada) c.voltasRapidas++;
    }
  }
  const lista = [...porPiloto.values()];
  const porCategoria = new Map<string, ClassificacaoDoPiloto[]>();
  for (const c of lista) {
    porCategoria.set(c.categoriaId, [
      ...(porCategoria.get(c.categoriaId) ?? []),
      c,
    ]);
  }
  for (const grupo of porCategoria.values()) {
    grupo.sort(
      (a, b) =>
        b.pontos - a.pontos ||
        b.vitorias - a.vitorias ||
        b.podios - a.podios ||
        b.poles - a.poles ||
        a.pilotoId.localeCompare(b.pilotoId),
    );
    grupo.forEach((c, i) => {
      c.posicao = i + 1;
    });
  }
  return lista;
}
