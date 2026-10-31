import type { LinhaClassificacao } from "@/lib/cronometragem/motor";

// Visões da mesma bateria usadas nas telas e nos PDFs. Tudo derivado da
// classificação calculada pelo motor (nada é gravado à parte).

export interface LinhaQualy {
  posicao: number | null;
  nome: string;
  kartNumero: string | null;
  melhorVoltaMs: number | null;
  melhorVoltaNumero: number | null;
  // Diferença da melhor volta para a melhor volta do líder.
  diferencaMs: number | null;
  voltas: number;
  mediaMs: number | null;
}

// Qualificação: ordenada pela MELHOR volta (não pelo número de voltas).
// Empatando o tempo, vale quem fez a volta antes. Quem não completou volta
// vem depois, sem posição.
export function montarQualy(linhas: LinhaClassificacao[]): LinhaQualy[] {
  const fimDaMelhor = (l: LinhaClassificacao): number =>
    l.voltasLista
      .filter((v) => v.tempoMs === l.melhorVoltaMs)
      .reduce((menor, v) => Math.min(menor, v.fimMs), Number.POSITIVE_INFINITY);

  const comVolta = linhas
    .filter((l) => l.melhorVoltaMs !== null)
    .sort(
      (a, b) =>
        (a.melhorVoltaMs ?? 0) - (b.melhorVoltaMs ?? 0) ||
        fimDaMelhor(a) - fimDaMelhor(b),
    );
  const semVolta = linhas.filter((l) => l.melhorVoltaMs === null);
  const lider = comVolta[0]?.melhorVoltaMs ?? null;

  const montar = (
    l: LinhaClassificacao,
    posicao: number | null,
  ): LinhaQualy => ({
    posicao,
    nome: l.nome,
    kartNumero: l.kartNumero,
    melhorVoltaMs: l.melhorVoltaMs,
    melhorVoltaNumero: l.melhorVoltaNumero,
    diferencaMs:
      l.melhorVoltaMs !== null && lider !== null && posicao !== 1
        ? l.melhorVoltaMs - lider
        : null,
    voltas: l.voltas,
    mediaMs:
      l.voltasLista.length > 0
        ? Math.round(
            l.voltasLista.reduce((t, v) => t + v.tempoMs, 0) /
              l.voltasLista.length,
          )
        : null,
  });
  return [
    ...comVolta.map((l, i) => montar(l, i + 1)),
    ...semVolta.map((l) => montar(l, null)),
  ];
}

export interface MatrizVoltas {
  participantes: { id: string; nome: string; kartNumero: string | null }[];
  // Uma linha por volta; `tempos` na mesma ordem de `participantes`.
  linhas: { numero: number; tempos: (number | null)[] }[];
  melhores: (number | null)[];
  melhorGeral: number | null;
}

// Volta a volta: uma coluna por piloto (na ordem da classificação) e uma linha
// por volta. Só entram os que completaram ao menos uma volta.
export function montarVoltaAVolta(linhas: LinhaClassificacao[]): MatrizVoltas {
  const participantes = linhas.filter((l) => l.voltas > 0);
  const maximo = participantes.reduce((m, l) => Math.max(m, l.voltas), 0);
  const melhores = participantes.map((l) => l.melhorVoltaMs);
  const validos = melhores.filter((m): m is number => m !== null);
  return {
    participantes: participantes.map((l) => ({
      id: l.participanteId,
      nome: l.nome,
      kartNumero: l.kartNumero,
    })),
    linhas: Array.from({ length: maximo }, (_, i) => ({
      numero: i + 1,
      tempos: participantes.map((l) => l.voltasLista[i]?.tempoMs ?? null),
    })),
    melhores,
    melhorGeral: validos.length > 0 ? Math.min(...validos) : null,
  };
}
