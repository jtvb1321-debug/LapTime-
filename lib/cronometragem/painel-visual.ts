import type { Diferenca, LinhaClassificacao } from "@/lib/cronometragem/motor";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";

// Cálculos só de APRESENTAÇÃO do painel de cronometragem: a partir da
// classificação que o motor já entrega, derivam diferença para o anterior,
// segunda melhor volta e a faixa de distância para o líder. Nada aqui grava
// nem altera resultado.

export type Faixa = "mesma" | "ate2" | "ate5" | "mais5";

export interface LinhaDoPainel {
  linha: LinhaClassificacao;
  // Posição mostrada (na classificação por melhor volta, é a ordem das melhores).
  pos: number | null;
  segundaMelhor: { numero: number; ms: number } | null;
  // Diferença para o líder e para o piloto da frente, já em texto.
  paraLider: string;
  paraAnterior: string;
  faixa: Faixa | null;
  // Não completou a prova (DNS, DNF, DSQ, não largou, sem volta, sem sensor).
  naoCompletou: boolean;
  temMelhorGeral: boolean;
}

export interface PainelMontado {
  linhas: LinhaDoPainel[];
  melhor: {
    linha: LinhaClassificacao;
    ms: number;
    numero: number | null;
  } | null;
}

const SEM_RESULTADO = new Set([
  "dns",
  "dnf",
  "dsq",
  "nao_largou",
  "sem_volta",
  "sem_sensor",
]);

function mais(ms: number): string {
  return `+${formatarTempoVolta(ms)}`;
}

function plural(n: number): string {
  return `+${n} ${n === 1 ? "volta" : "voltas"}`;
}

export function segundaMelhorVolta(
  l: LinhaClassificacao,
): { numero: number; ms: number } | null {
  const ordenadas = [...l.voltasLista].sort((a, b) => a.tempoMs - b.tempoMs);
  const segunda = ordenadas[1];
  return segunda ? { numero: segunda.numero, ms: segunda.tempoMs } : null;
}

export function faixaDe(d: Diferenca | null): Faixa | null {
  if (!d) return null;
  if (d.tipo === "lider" || d.tipo === "tempo") return "mesma";
  if (d.voltas <= 2) return "ate2";
  if (d.voltas <= 5) return "ate5";
  return "mais5";
}

// Diferença para quem está logo à frente, na corrida: usa as mesmas medidas
// que a diferença para o líder (tempo na mesma volta, ou voltas de atraso).
export function paraOAnterior(
  atual: Diferenca | null,
  frente: Diferenca | null,
): string {
  if (!atual || atual.tipo === "lider") return "—";
  const lidera = !frente || frente.tipo === "lider";
  if (atual.tipo === "tempo") {
    if (lidera) return mais(atual.ms);
    if (frente.tipo === "tempo") return mais(Math.max(0, atual.ms - frente.ms));
    return "—";
  }
  const voltasFrente = !frente || frente.tipo !== "voltas" ? 0 : frente.voltas;
  const dif = atual.voltas - voltasFrente;
  return dif > 0 ? plural(dif) : "mesma volta";
}

export function montarPainel(
  classificacao: LinhaClassificacao[],
  porMelhorVolta: boolean,
): PainelMontado {
  const comMelhor = classificacao.filter((l) => l.melhorVoltaMs !== null);
  const melhorLinha = [...comMelhor].sort(
    (a, b) => (a.melhorVoltaMs ?? 0) - (b.melhorVoltaMs ?? 0),
  )[0];
  const melhor = melhorLinha
    ? {
        linha: melhorLinha,
        ms: melhorLinha.melhorVoltaMs ?? 0,
        numero: melhorLinha.melhorVoltaNumero,
      }
    : null;

  const ordenadas = [...classificacao].sort((a, b) => {
    if (porMelhorVolta) {
      const x = a.melhorVoltaMs ?? Number.POSITIVE_INFINITY;
      const y = b.melhorVoltaMs ?? Number.POSITIVE_INFINITY;
      return x - y;
    }
    const x = a.posicao ?? Number.POSITIVE_INFINITY;
    const y = b.posicao ?? Number.POSITIVE_INFINITY;
    return x - y;
  });

  const linhas = ordenadas.map((linha, i): LinhaDoPainel => {
    const frente = i > 0 ? ordenadas[i - 1] : undefined;
    const lider = ordenadas[0];
    let paraLider = "—";
    let paraAnterior = "—";
    let faixa: Faixa | null = null;
    if (porMelhorVolta) {
      if (linha.melhorVoltaMs !== null && lider?.melhorVoltaMs != null) {
        if (i > 0) {
          paraLider = mais(linha.melhorVoltaMs - lider.melhorVoltaMs);
          if (frente?.melhorVoltaMs != null) {
            paraAnterior = mais(linha.melhorVoltaMs - frente.melhorVoltaMs);
          }
        }
      }
    } else {
      paraLider =
        !linha.diferenca || linha.diferenca.tipo === "lider"
          ? "—"
          : linha.diferenca.tipo === "tempo"
            ? mais(linha.diferenca.ms)
            : plural(linha.diferenca.voltas);
      paraAnterior = paraOAnterior(linha.diferenca, frente?.diferenca ?? null);
      faixa = faixaDe(linha.diferenca);
    }
    const posicaoVisivel = porMelhorVolta
      ? linha.melhorVoltaMs !== null
        ? i + 1
        : null
      : linha.posicao;
    return {
      linha,
      pos: posicaoVisivel,
      segundaMelhor: segundaMelhorVolta(linha),
      paraLider,
      paraAnterior,
      faixa,
      naoCompletou: SEM_RESULTADO.has(linha.situacao),
      temMelhorGeral: melhor?.linha.participanteId === linha.participanteId,
    };
  });

  return { linhas, melhor };
}
