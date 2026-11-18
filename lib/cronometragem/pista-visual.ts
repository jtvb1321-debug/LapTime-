import type { Decoder } from "@/lib/cronometragem/decoders-store";
import type { Alerta, EstadoCorrida } from "@/lib/cronometragem/corridas-store";
import type { LinhaClassificacao } from "@/lib/cronometragem/motor";
import {
  faixaDe,
  paraOAnterior,
  type Faixa,
} from "@/lib/cronometragem/painel-visual";
import { textoDiferenca } from "@/lib/cronometragem/rotulos";
import {
  painelDaSessao,
  type CriterioDaSessao,
} from "@/lib/cronometragem/classificacao-oficial";

// Funções PURAS só de APRESENTAÇÃO da tela de cronometragem ao vivo (Pit Wall).
// Leem o que o motor e o coletor já entregam (classificação, alertas, estado dos
// decoders) e o descrevem em palavras e cores. Não calculam voltas, posições,
// diferenças nem resultado, não criam consultas e não decidem nada: nenhuma ação
// depende delas.

// ---- Bandeira (estado da sessão) -------------------------------------------

export type TomDaBandeira = "verde" | "ambar" | "quadriculada" | "neutra";

// Só traduz os estados que a corrida JÁ tem. Não existe pausa nem bandeira
// amarela/vermelha no sistema, então nenhuma é exibida.
export function bandeiraDaSessao(estado: EstadoCorrida): {
  rotulo: string;
  tom: TomDaBandeira;
} {
  switch (estado) {
    case "em_andamento":
      return { rotulo: "Em andamento", tom: "verde" };
    case "encerrando":
      return { rotulo: "Tempo esgotado", tom: "ambar" };
    case "finalizada":
      return { rotulo: "Finalizada", tom: "quadriculada" };
    case "cancelada":
      return { rotulo: "Cancelada", tom: "neutra" };
    case "pronta":
      return { rotulo: "Pronta para iniciar", tom: "neutra" };
    default:
      return { rotulo: "Em preparação", tom: "neutra" };
  }
}

// ---- Sinal de cada kart (última passagem conhecida) -------------------------

export type EstadoDoSinal =
  "sem-sensor" | "sem-passagem" | "recente" | "antiga";

// Só apresentação: até esse tempo a passagem aparece como "recente" (verde). Depois
// disso aparece como "antiga", em tom neutro. Ausência de passagem NÃO é falha de
// sensor: um kart parado no box, na fila ou fora da pista também não passa.
export const LIMITE_PASSAGEM_RECENTE_MS = 60_000;

export interface SinalDoKart {
  estado: EstadoDoSinal;
  texto: string;
  // Idade da última passagem, quando houve.
  idadeMs: number | null;
}

export function formatarIdade(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h`;
}

export function sinalDoKart(
  linha: Pick<LinhaClassificacao, "transponder" | "ultimaPassagemMs">,
  agoraMs: number,
): SinalDoKart {
  if (!linha.transponder) {
    return { estado: "sem-sensor", texto: "Sem sensor", idadeMs: null };
  }
  if (linha.ultimaPassagemMs === null) {
    return { estado: "sem-passagem", texto: "Ainda não passou", idadeMs: null };
  }
  const idadeMs = Math.max(0, agoraMs - linha.ultimaPassagemMs);
  return {
    estado: idadeMs <= LIMITE_PASSAGEM_RECENTE_MS ? "recente" : "antiga",
    texto: `há ${formatarIdade(idadeMs)}`,
    idadeMs,
  };
}

// ---- Comunicação com o decoder ---------------------------------------------

export type EstadoDaComunicacao =
  "ok" | "falha-confirmada" | "simulado" | "sem-decoder";

export interface ComunicacaoDaPista {
  estado: EstadoDaComunicacao;
  titulo: string;
  detalhe: string;
  // Só vira verdadeiro com falha CONFIRMADA pelo coletor (coletor offline ou decoder
  // desconectado, em decoder real e ativo). Nunca é deduzido da falta de passagens.
  falhaConfirmada: boolean;
  // Mensagens específicas de cada falha confirmada.
  falhas: string[];
  // Último sinal do equipamento escolhido, quando existe.
  ultimoSinal: Date | null;
}

export function comunicacaoDaPista(decoders: Decoder[]): ComunicacaoDaPista {
  const ativos = decoders.filter((d) => d.ativo);
  if (ativos.length === 0) {
    return {
      estado: "sem-decoder",
      titulo: "Nenhum decoder cadastrado",
      detalhe: "Cadastre em Equipamentos para receber passagens.",
      falhaConfirmada: false,
      falhas: [],
      ultimoSinal: null,
    };
  }
  const reais = ativos.filter((d) => !d.simulado);
  const falhas: string[] = [];
  for (const d of reais) {
    if (d.estadoConexao === "coletor_offline") {
      falhas.push(`${d.nome}: o coletor está offline.`);
    } else if (d.estadoConexao === "decoder_desconectado") {
      falhas.push(
        `${d.nome}: o decoder está desconectado${d.ultimoErro ? ` (${d.ultimoErro})` : ""}.`,
      );
    }
  }
  if (reais.length === 0) {
    const d = ativos[0];
    return {
      estado: "simulado",
      titulo: "Decoder simulado",
      detalhe: `${d.nome}: não é o decoder real.`,
      falhaConfirmada: false,
      falhas: [],
      ultimoSinal: d.ultimoSinal,
    };
  }
  if (falhas.length > 0) {
    const d = reais.find((x) => x.estadoConexao !== "conectado") ?? reais[0];
    return {
      estado: "falha-confirmada",
      titulo:
        d.estadoConexao === "coletor_offline"
          ? "Coletor offline"
          : "Decoder desconectado",
      detalhe: d.nome,
      falhaConfirmada: true,
      falhas,
      ultimoSinal: d.ultimoSinal,
    };
  }
  const d = reais.find((x) => x.estadoConexao === "conectado") ?? reais[0];
  return {
    estado: "ok",
    titulo: "Decoder conectado",
    detalhe: d.nome,
    falhaConfirmada: false,
    falhas: [],
    ultimoSinal: d.ultimoSinal,
  };
}

// ---- Atenção e avisos ------------------------------------------------------

export interface AtencaoDaSessao {
  // Exige olhar agora: falha confirmada de comunicação e alertas de erro do motor.
  atencao: string[];
  // Informativos (simulador, sensores sem piloto, etc.): peso menor.
  avisos: string[];
}

export function atencaoDaSessao(
  alertas: Alerta[],
  comunicacao: ComunicacaoDaPista,
): AtencaoDaSessao {
  const atencao = [
    ...comunicacao.falhas,
    ...alertas.filter((a) => a.nivel === "erro").map((a) => a.texto),
  ];
  const avisos = alertas.filter((a) => a.nivel === "aviso").map((a) => a.texto);
  return { atencao, avisos };
}

// A tabela pode estar sem as últimas passagens: só com falha CONFIRMADA de
// comunicação e com a prova em curso.
export function dadosPodemEstarDefasados(
  estado: EstadoCorrida,
  comunicacao: ComunicacaoDaPista,
): boolean {
  return (
    (estado === "em_andamento" || estado === "encerrando") &&
    comunicacao.falhaConfirmada
  );
}

// ---- Últimas voltas (barras) -----------------------------------------------

export interface BarraDeVolta {
  numero: number;
  ms: number;
  // 0,25 a 1: tamanho relativo dentro das voltas mostradas (só para desenhar).
  altura: number;
  melhor: boolean;
}

export function ultimasVoltas(
  linha: Pick<LinhaClassificacao, "voltasLista" | "melhorVoltaMs">,
  quantas = 5,
): BarraDeVolta[] {
  const ultimas = linha.voltasLista.slice(-quantas);
  if (ultimas.length === 0) return [];
  const maior = Math.max(...ultimas.map((v) => v.tempoMs));
  const menor = Math.min(...ultimas.map((v) => v.tempoMs));
  const faixa = maior - menor;
  return ultimas.map((v) => ({
    numero: v.numero,
    ms: v.tempoMs,
    // Mais rápida = barra mais alta.
    altura: faixa === 0 ? 1 : 0.25 + 0.75 * ((maior - v.tempoMs) / faixa),
    melhor: linha.melhorVoltaMs !== null && v.tempoMs === linha.melhorVoltaMs,
  }));
}

// ---- Torre de classificação: a ordem é a do MOTOR -------------------------------

// Situações sem resultado (não completaram): só para esmaecer a linha.
const SEM_RESULTADO = new Set([
  "dns",
  "dnf",
  "dsq",
  "nao_largou",
  "sem_volta",
  "sem_sensor",
]);

export interface LinhaDaTorre {
  linha: LinhaClassificacao;
  // Posição OFICIAL que o motor atribuiu (nula para DSQ, DNS e quem não fechou volta).
  pos: number | null;
  // Diferenças em texto, calculadas pelo motor (`diferenca`) e só formatadas aqui.
  paraLider: string;
  paraAnterior: string;
  faixa: Faixa | null;
  naoCompletou: boolean;
  temMelhorGeral: boolean;
}

export function melhorDaProva(
  classificacao: LinhaClassificacao[],
): { linha: LinhaClassificacao; ms: number; numero: number | null } | null {
  let melhor: LinhaClassificacao | null = null;
  for (const l of classificacao) {
    if (l.melhorVoltaMs === null) continue;
    if (melhor === null || l.melhorVoltaMs < (melhor.melhorVoltaMs ?? 0)) {
      melhor = l;
    }
  }
  return melhor
    ? {
        linha: melhor,
        ms: melhor.melhorVoltaMs ?? 0,
        numero: melhor.melhorVoltaNumero,
      }
    : null;
}

// NÃO ordena. Devolve as linhas EXATAMENTE na ordem em que o motor as entregou
// (a mesma da tela anterior), com campos extras só de leitura. Penalidades,
// desclassificações, empates, pilotos sem voltas e karts sem piloto já vêm
// resolvidos pelo motor na ordem do vetor; a tela não reordena nada.
export function linhasNaOrdemDoMotor(
  classificacao: LinhaClassificacao[],
): LinhaDaTorre[] {
  const melhor = melhorDaProva(classificacao);
  return classificacao.map((linha, i) => {
    const frente = i > 0 ? classificacao[i - 1] : undefined;
    return {
      linha,
      pos: linha.posicao,
      paraLider: textoDiferenca(linha.diferenca),
      paraAnterior: paraOAnterior(linha.diferenca, frente?.diferenca ?? null),
      faixa: faixaDe(linha.diferenca),
      naoCompletou: SEM_RESULTADO.has(linha.situacao),
      temMelhorGeral: melhor?.linha.participanteId === linha.participanteId,
    };
  });
}

// Karts que entraram na prova sem o nome do piloto (o operador dá o nome depois).
export function kartsSemPiloto<T extends { nomeado: boolean }>(grid: T[]): T[] {
  return grid.filter((p) => !p.nomeado);
}

// Torre da sessão pelo critério oficial da camada compartilhada: no critério atual, exatamente a ordem
// do motor (como antes); com a melhor volta ativada para a sessão, a ordem e as posições da função
// oficial, sem nenhuma regra própria aqui.
export function linhasDaTorreDaSessao(
  classificacao: LinhaClassificacao[],
  criterio: CriterioDaSessao,
): LinhaDaTorre[] {
  if (criterio !== "melhor_volta_v1")
    return linhasNaOrdemDoMotor(classificacao);
  return painelDaSessao(classificacao, true, criterio).linhas.map((l) => ({
    linha: l.linha,
    pos: l.pos,
    paraLider: l.paraLider,
    paraAnterior: l.paraAnterior,
    faixa: null,
    naoCompletou: l.naoCompletou,
    temMelhorGeral: l.temMelhorGeral,
  }));
}
