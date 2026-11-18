// Motor de cronometragem: funções PURAS (sem banco, sem relógio). Recebe a
// configuração da corrida, os participantes, as passagens brutas e as
// correções administrativas, e devolve (1) o que aconteceu com CADA passagem
// — contada ou não, e por quê — e (2) as voltas e a classificação.
//
// Decisões:
//  - Voltas e resultados são sempre derivados das passagens originais; assim
//    passagem fora de ordem, reenvio e correção se resolvem sozinhos, e o
//    registro original nunca é alterado.
//  - Tempos em milissegundos INTEIROS (cada instante é arredondado a ms antes
//    de qualquer subtração), sem acumular ponto flutuante.
//  - Nenhuma regra esportiva é presumida: largada, intervalo mínimo e
//    encerramento vêm da configuração da corrida.
export type RegraLargada = "primeira_passagem" | "largada_da_corrida";
export type ModoEncerramento = "manual" | "proxima_passagem" | "corte_imediato";

export interface ConfigMotor {
  tempoMinimoMs: number;
  regraLargada: RegraLargada;
  modoEncerramento: ModoEncerramento;
  iniciadaEmMs: number | null;
  // Instante da bandeira (fim do tempo ou encerramento antecipado).
  encerrandoEmMs: number | null;
  // Instante em que a corrida foi finalizada (ou cancelada).
  finalizadaEmMs: number | null;
}

export interface ParticipanteMotor {
  id: string;
  nome: string;
  transponder: string | null;
  // Outros sensores que identificam o mesmo piloto nesta bateria (ex.: o sensor
  // do kart foi trocado no meio dela). As passagens de todos contam juntas.
  transponders?: string[];
  kartNumero?: string | null;
  // Ocorrências do operador. DSQ sai da classificação (vai para o fim, sem
  // posição); DNS idem, antes dos DSQ; DNF mantém as voltas feitas mas fica
  // atrás de quem terminou. A penalidade (ms) soma ao tempo total e ao critério
  // de desempate, sem alterar as voltas.
  situacaoManual?: "dns" | "dnf" | "dsq" | null;
  penalidadeMs?: number;
}

export interface PassagemMotor {
  // Identificador estável (id da passagem, ou "manual-…" para inserções).
  id: string;
  transponder: string;
  instanteMs: number;
  origem: "decoder" | "manual";
}

export interface InvalidacaoMotor {
  passagemId: string;
  motivo: string;
}

export type StatusPassagem =
  | "largada"
  | "volta"
  | "volta_final"
  | "duplicada"
  | "antes_da_largada"
  | "depois_do_fim"
  | "apos_bandeira"
  | "invalidada"
  | "sem_participante";

export interface PassagemAvaliada {
  passagem: PassagemMotor;
  participanteId: string | null;
  status: StatusPassagem;
  motivo: string;
  // true = entrou na contagem (largada, volta ou volta final).
  contada: boolean;
  numeroVolta?: number;
  tempoVoltaMs?: number;
}

export interface Volta {
  numero: number;
  inicioMs: number;
  fimMs: number;
  tempoMs: number;
  final: boolean;
}

export type Situacao =
  | "sem_sensor"
  | "aguardando_largada"
  | "em_pista"
  | "finalizou"
  | "sem_volta"
  | "nao_largou"
  // Decididos pelo operador (com motivo, auditados):
  | "dns" // não largou
  | "dnf" // não terminou
  | "dsq"; // desclassificado

export type Diferenca =
  | { tipo: "lider" }
  | { tipo: "tempo"; ms: number }
  | { tipo: "voltas"; voltas: number };

export interface LinhaClassificacao {
  participanteId: string;
  nome: string;
  kartNumero: string | null;
  transponder: string | null;
  posicao: number | null;
  situacao: Situacao;
  voltas: number;
  ultimaVoltaMs: number | null;
  melhorVoltaMs: number | null;
  melhorVoltaNumero: number | null;
  // Do primeiro cruzamento contado (ou da largada da corrida, conforme a
  // regra) até o fim da última volta. NÃO é tempo de volta nem tempo da corrida.
  tempoTotalMs: number | null;
  ultimaPassagemMs: number | null;
  fimUltimaMs: number | null;
  leituras: number;
  naoContadas: number;
  // Penalidade em tempo já aplicada (ms) a esta linha.
  penalidadeMs: number;
  diferenca: Diferenca | null;
  voltasLista: Volta[];
}

export interface ResultadoMotor {
  passagens: PassagemAvaliada[];
  classificacao: LinhaClassificacao[];
}

export const MOTIVOS: Record<StatusPassagem, string> = {
  largada: "Primeira leitura: passagem de largada (não fecha volta).",
  volta: "Volta válida.",
  volta_final: "Volta final, depois da bandeira.",
  duplicada: "Leitura repetida: intervalo menor que o mínimo da corrida.",
  antes_da_largada: "Antes da largada da corrida.",
  depois_do_fim: "Depois do fim da corrida.",
  apos_bandeira: "O piloto já tinha terminado (bandeira).",
  invalidada: "Invalidada por correção administrativa.",
  sem_participante: "Sensor sem piloto nesta corrida.",
};

const ms = (x: number) => Math.round(x);

function compararPassagens(a: PassagemMotor, b: PassagemMotor): number {
  const dt = ms(a.instanteMs) - ms(b.instanteMs);
  if (dt !== 0) return dt;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

export function avaliarCorrida(entrada: {
  config: ConfigMotor;
  participantes: ParticipanteMotor[];
  passagens: PassagemMotor[];
  invalidacoes?: InvalidacaoMotor[];
}): ResultadoMotor {
  const { config, participantes } = entrada;
  const invalidas = new Map(
    (entrada.invalidacoes ?? []).map((i) => [i.passagemId, i.motivo]),
  );
  const donoDoSensor = new Map<string, ParticipanteMotor>();
  for (const p of participantes) {
    for (const sensor of [p.transponder, ...(p.transponders ?? [])]) {
      if (sensor) donoDoSensor.set(sensor, p);
    }
  }

  interface Estado {
    ultimoValidoMs: number | null;
    primeiroValidoMs: number | null;
    terminou: boolean;
    voltas: Volta[];
    leituras: number;
    naoContadas: number;
    ultimaPassagemMs: number | null;
  }
  const estados = new Map<string, Estado>(
    participantes.map((p) => [
      p.id,
      {
        ultimoValidoMs: null,
        primeiroValidoMs: null,
        terminou: false,
        voltas: [],
        leituras: 0,
        naoContadas: 0,
        ultimaPassagemMs: null,
      },
    ]),
  );

  const iniciada =
    config.iniciadaEmMs === null ? null : ms(config.iniciadaEmMs);
  const bandeira =
    config.encerrandoEmMs === null ? null : ms(config.encerrandoEmMs);
  const finalizada =
    config.finalizadaEmMs === null ? null : ms(config.finalizadaEmMs);

  const avaliadas: PassagemAvaliada[] = [];
  const ordenadas = [...entrada.passagens].sort(compararPassagens);

  for (const passagem of ordenadas) {
    const t = ms(passagem.instanteMs);
    const dono = donoDoSensor.get(passagem.transponder) ?? null;
    const resultado = (
      status: StatusPassagem,
      extra: Partial<PassagemAvaliada> = {},
      motivo = MOTIVOS[status],
    ): PassagemAvaliada => ({
      passagem,
      participanteId: dono?.id ?? null,
      status,
      motivo,
      contada:
        status === "largada" || status === "volta" || status === "volta_final",
      ...extra,
    });

    const motivoInvalidacao = invalidas.get(passagem.id);
    if (motivoInvalidacao !== undefined) {
      avaliadas.push(
        resultado(
          "invalidada",
          {},
          `${MOTIVOS.invalidada} Motivo: ${motivoInvalidacao}`,
        ),
      );
      if (dono) estados.get(dono.id)!.naoContadas += 1;
      continue;
    }
    if (!dono) {
      avaliadas.push(resultado("sem_participante"));
      continue;
    }
    const estado = estados.get(dono.id)!;

    let rejeicao: PassagemAvaliada | null = null;
    if (iniciada === null || t < iniciada) {
      rejeicao = resultado("antes_da_largada");
    } else if (finalizada !== null && t > finalizada) {
      rejeicao = resultado("depois_do_fim");
    } else if (estado.terminou) {
      rejeicao = resultado("apos_bandeira");
    } else if (
      config.modoEncerramento === "corte_imediato" &&
      bandeira !== null &&
      t > bandeira
    ) {
      rejeicao = resultado(
        "depois_do_fim",
        {},
        "Depois do fim do tempo da corrida (corte imediato).",
      );
    } else if (
      estado.ultimoValidoMs !== null &&
      t - estado.ultimoValidoMs < config.tempoMinimoMs
    ) {
      rejeicao = resultado("duplicada");
    } else if (
      estado.ultimoValidoMs === null &&
      config.regraLargada === "largada_da_corrida" &&
      t - iniciada < config.tempoMinimoMs
    ) {
      rejeicao = resultado(
        "duplicada",
        {},
        "Leitura logo após a largada da corrida: menor que o tempo mínimo.",
      );
    }
    if (rejeicao) {
      estado.naoContadas += 1;
      avaliadas.push(rejeicao);
      continue;
    }

    // Leitura aceita.
    estado.leituras += 1;
    estado.ultimaPassagemMs = t;
    const inicioMs =
      estado.ultimoValidoMs ??
      (config.regraLargada === "largada_da_corrida" ? iniciada : null);
    if (estado.primeiroValidoMs === null) {
      estado.primeiroValidoMs =
        config.regraLargada === "largada_da_corrida" ? iniciada : t;
    }
    estado.ultimoValidoMs = t;

    if (inicioMs === null) {
      avaliadas.push(resultado("largada"));
      continue;
    }
    const numero = estado.voltas.length + 1;
    const tempoMs = t - inicioMs;
    const final =
      config.modoEncerramento === "proxima_passagem" &&
      bandeira !== null &&
      t >= bandeira;
    estado.voltas.push({ numero, inicioMs, fimMs: t, tempoMs, final });
    if (final) estado.terminou = true;
    avaliadas.push(
      resultado(final ? "volta_final" : "volta", {
        numeroVolta: numero,
        tempoVoltaMs: tempoMs,
      }),
    );
  }

  // Classificação.
  const linhas: LinhaClassificacao[] = participantes.map((p) => {
    const e = estados.get(p.id)!;
    const ultima = e.voltas.at(-1);
    const melhor = e.voltas.reduce<Volta | undefined>(
      (m, v) => (!m || v.tempoMs < m.tempoMs ? v : m),
      undefined,
    );
    let situacao: Situacao;
    if (p.situacaoManual) situacao = p.situacaoManual;
    else if (!p.transponder) situacao = "sem_sensor";
    else if (iniciada === null) situacao = "aguardando_largada";
    else if (e.terminou) situacao = "finalizou";
    else if (finalizada !== null) {
      situacao =
        e.voltas.length > 0
          ? "finalizou"
          : e.leituras > 0
            ? "sem_volta"
            : "nao_largou";
    } else situacao = e.leituras > 0 ? "em_pista" : "aguardando_largada";

    return {
      participanteId: p.id,
      nome: p.nome,
      kartNumero: p.kartNumero ?? null,
      transponder: p.transponder,
      posicao: null,
      situacao,
      voltas: e.voltas.length,
      ultimaVoltaMs: ultima?.tempoMs ?? null,
      melhorVoltaMs: melhor?.tempoMs ?? null,
      melhorVoltaNumero: melhor?.numero ?? null,
      tempoTotalMs:
        ultima && e.primeiroValidoMs !== null
          ? ultima.fimMs - e.primeiroValidoMs + (p.penalidadeMs ?? 0)
          : null,
      ultimaPassagemMs: e.ultimaPassagemMs,
      fimUltimaMs: ultima?.fimMs ?? null,
      leituras: e.leituras,
      naoContadas: e.naoContadas,
      penalidadeMs: p.penalidadeMs ?? 0,
      diferenca: null,
      voltasLista: e.voltas,
    };
  });

  // Corrida por tempo: mais voltas primeiro; com as mesmas voltas, quem
  // cruzou a linha primeiro (ordem de chegada). Quem ainda não fechou volta
  // vem depois, na ordem da primeira leitura; sem leitura e sem sensor por último.
  // Ordem: classificados (por voltas e chegada, com a penalidade somada ao
  // instante de chegada), depois os DNF, quem não fechou volta, DNS e, por
  // último, os DSQ. DNS e DSQ não têm posição.
  const grupo = (l: LinhaClassificacao) => {
    if (l.situacao === "dsq") return 9;
    if (l.situacao === "dns") return 8;
    if (l.situacao === "dnf") return l.voltas > 0 ? 4 : 5;
    return l.voltas > 0 ? 0 : l.leituras > 0 ? 1 : l.transponder ? 2 : 3;
  };
  const chegada = (l: LinhaClassificacao) =>
    (l.fimUltimaMs ?? 0) + l.penalidadeMs;
  linhas.sort((a, b) => {
    const g = grupo(a) - grupo(b);
    if (g !== 0) return g;
    if (a.voltas > 0 && b.voltas > 0) {
      if (a.voltas !== b.voltas) return b.voltas - a.voltas;
      return chegada(a) - chegada(b);
    }
    if (a.leituras > 0 && b.leituras > 0) {
      return (a.ultimaPassagemMs ?? 0) - (b.ultimaPassagemMs ?? 0);
    }
    return 0;
  });

  const lider = linhas.find((l) => l.voltas > 0 && grupo(l) === 0);
  let posicao = 0;
  for (const linha of linhas) {
    if (linha.voltas === 0 || !lider) continue;
    if (linha.situacao === "dsq" || linha.situacao === "dns") continue;
    linha.posicao = ++posicao;
    if (linha === lider) linha.diferenca = { tipo: "lider" };
    else if (linha.voltas === lider.voltas) {
      linha.diferenca = { tipo: "tempo", ms: chegada(linha) - chegada(lider) };
    } else {
      linha.diferenca = { tipo: "voltas", voltas: lider.voltas - linha.voltas };
    }
  }

  return { passagens: avaliadas, classificacao: linhas };
}
