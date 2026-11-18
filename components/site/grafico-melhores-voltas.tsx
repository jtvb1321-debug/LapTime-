import { clsx } from "clsx";
import { formatTempoVolta } from "@/lib/mock/data";

// Gráfico de barras simples (HTML/flex, sem lib de charts) comparando a
// melhor volta de cada etapa — eixo não começa em zero, senão diferenças de
// 1-2s entre voltas de ~52s ficariam imperceptíveis. A barra mais rápida
// (destaque) usa a cor de marca já usada no card "Voltas rápidas" acima.
export function GraficoMelhoresVoltas({
  pontos,
}: {
  pontos: { rotulo: string; tempoMs: number; destaque?: boolean }[];
}) {
  if (pontos.length === 0) return null;

  const tempos = pontos.map((p) => p.tempoMs);
  const min = Math.min(...tempos);
  const max = Math.max(...tempos);
  const folga = Math.max((max - min) * 0.3, 300);
  const domMax = max + folga;
  const alcance = Math.max(domMax - (min - folga * 0.3), 1);

  return (
    // items-stretch (padrão) pras colunas ocuparem a altura toda do gráfico —
    // sem isso, a barra (flex-1 dentro da coluna) nunca tem altura de
    // referência pra calcular a porcentagem e fica sempre em 0.
    <div className="flex h-44 gap-3">
      {pontos.map((ponto) => {
        // Volta mais rápida = barra mais alta (tempo menor fica perto do
        // topo do domínio) — mais intuitivo que o contrário numa comparação
        // de desempenho.
        const alturaPct = Math.max(
          ((domMax - ponto.tempoMs) / alcance) * 100,
          6,
        );
        return (
          <div
            key={ponto.rotulo}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={clsx(
                "font-display text-xs font-semibold whitespace-nowrap",
                ponto.destaque ? "text-orange-ink" : "text-ink-2",
              )}
            >
              {formatTempoVolta(ponto.tempoMs)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={clsx(
                  "w-full rounded-t-md",
                  ponto.destaque ? "bg-orange" : "bg-ink/15",
                )}
                style={{ height: `${alturaPct}%` }}
              />
            </div>
            <span className="text-ink-3 text-center text-[10px] tracking-wide uppercase">
              {ponto.rotulo}
            </span>
          </div>
        );
      })}
    </div>
  );
}
