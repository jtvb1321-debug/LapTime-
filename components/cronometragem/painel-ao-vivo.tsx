import { clsx } from "clsx";
import { StatusPill } from "@/components/ui/status-pill";
import type { PassagemDoHistorico } from "@/lib/cronometragem/corridas-store";
import type { Faixa, LinhaDoPainel } from "@/lib/cronometragem/painel-visual";
import { SITUACAO } from "@/lib/cronometragem/rotulos";
import {
  formatarHoraComMs,
  formatarTempoVolta,
} from "@/lib/cronometragem/voltas";

// Peças do painel de cronometragem (corrida ao vivo, resultado e impressão).
// Só apresentação: tudo vem pronto da classificação e do histórico da bateria.

const COR_FAIXA: Record<Faixa, { cor: string; texto: string }> = {
  mesma: { cor: "bg-success", texto: "Na mesma volta do líder" },
  ate2: { cor: "bg-warning", texto: "Até 2 voltas atrás do líder" },
  ate5: { cor: "bg-danger", texto: "Até 5 voltas atrás do líder" },
  mais5: { cor: "bg-ink", texto: "Mais de 5 voltas atrás do líder" },
};

export function Legenda({ corrida }: { corrida: boolean }) {
  return (
    <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border px-4 py-3 text-xs">
      {corrida ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {(Object.keys(COR_FAIXA) as Faixa[]).map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={clsx("size-2.5 rounded-full", COR_FAIXA[f].cor)}
              />
              {COR_FAIXA[f].texto}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="text-ink-2 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="inline font-semibold">POS</dt> = posição
        </div>
        <div>
          <dt className="inline font-semibold">KART</dt> = número do kart
        </div>
        <div>
          <dt className="inline font-semibold">VOLTAS</dt> = total de voltas
        </div>
        <div>
          <dt className="inline font-semibold">M.V.</dt> = nº da melhor volta
        </div>
        <div>
          <dt className="inline font-semibold">MELHOR</dt> = tempo da melhor
          volta
        </div>
        <div>
          <dt className="inline font-semibold">D.L.</dt> = diferença para o
          líder
        </div>
        <div>
          <dt className="inline font-semibold">D.A.</dt> = diferença para o
          anterior
        </div>
        <div>
          <dt className="inline font-semibold">ÚLTIMA</dt> = tempo da última
          volta
        </div>
        <div>
          <dt className="inline font-semibold">2ª MELHOR</dt> = nº e tempo da
          segunda melhor volta
        </div>
        <div>
          <dt className="inline font-semibold">NC</dt> = não completou
        </div>
      </dl>
    </div>
  );
}

const TH = "px-2.5 py-2 font-medium whitespace-nowrap";
const TD = "px-2.5 py-2 whitespace-nowrap";

export function TabelaDoPainel({
  linhas,
  corrida,
}: {
  linhas: LinhaDoPainel[];
  corrida: boolean;
}) {
  if (linhas.length === 0) {
    return (
      <div className="border-border bg-surface text-ink-2 rounded-lg border px-5 py-10 text-center text-sm">
        Nenhum piloto no grid ainda. Os karts entram sozinhos quando passam pelo
        sensor depois da largada.
      </div>
    );
  }
  return (
    <div
      role="region"
      aria-label="Tabela de passagens"
      tabIndex={0}
      className="border-border bg-surface overflow-x-auto rounded-lg border"
    >
      <table className="w-full min-w-max text-left text-sm tabular-nums">
        <thead>
          <tr className="border-border text-ink-3 bg-surface border-b text-xs tracking-wide uppercase">
            <th className={clsx(TH, "text-right")}>Pos</th>
            <th className={clsx(TH, "text-right")}>Kart</th>
            <th className={TH}>Piloto</th>
            <th className={clsx(TH, "text-right")}>Voltas</th>
            <th className={clsx(TH, "text-right")}>M.V.</th>
            <th className={clsx(TH, "text-right")}>Melhor</th>
            <th className={clsx(TH, "text-right")}>D.L.</th>
            <th className={clsx(TH, "text-right")}>D.A.</th>
            <th className={clsx(TH, "text-right")}>Última</th>
            <th className={clsx(TH, "text-right")}>2ª melhor</th>
            <th className={TH}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={l.linha.participanteId}
              className={clsx(
                "border-border border-b last:border-0",
                l.pos === 1 && "bg-orange/5",
                l.naoCompletou && "text-ink-3",
              )}
            >
              <td className={clsx(TD, "text-right text-base font-semibold")}>
                <span className="inline-flex items-center justify-end gap-2">
                  {corrida && l.faixa ? (
                    <span
                      role="img"
                      aria-label={COR_FAIXA[l.faixa].texto}
                      title={COR_FAIXA[l.faixa].texto}
                      className={clsx(
                        "size-2.5 rounded-full",
                        COR_FAIXA[l.faixa].cor,
                      )}
                    />
                  ) : null}
                  {l.pos ?? "—"}
                </span>
              </td>
              <td className={clsx(TD, "font-display text-right")}>
                {l.linha.kartNumero ?? "—"}
              </td>
              <td className={clsx(TD, "text-ink font-medium")}>
                {l.linha.nome}
                {l.naoCompletou ? (
                  <span className="bg-ink/10 text-ink-2 ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                    NC
                  </span>
                ) : null}
              </td>
              <td className={clsx(TD, "text-right")}>{l.linha.voltas}</td>
              <td className={clsx(TD, "text-right")}>
                {l.linha.melhorVoltaNumero ?? "—"}
              </td>
              <td
                className={clsx(
                  TD,
                  "font-display text-right",
                  l.temMelhorGeral &&
                    "bg-success-bg text-success font-semibold",
                )}
              >
                {l.linha.melhorVoltaMs !== null
                  ? formatarTempoVolta(l.linha.melhorVoltaMs)
                  : "—"}
              </td>
              <td className={clsx(TD, "font-display text-right")}>
                {l.paraLider}
              </td>
              <td className={clsx(TD, "font-display text-right")}>
                {l.paraAnterior}
              </td>
              <td className={clsx(TD, "font-display text-right")}>
                {l.linha.ultimaVoltaMs !== null
                  ? formatarTempoVolta(l.linha.ultimaVoltaMs)
                  : "—"}
              </td>
              <td className={clsx(TD, "font-display text-right")}>
                {l.segundaMelhor
                  ? `V${l.segundaMelhor.numero} · ${formatarTempoVolta(l.segundaMelhor.ms)}`
                  : "—"}
              </td>
              <td className={TD}>
                <StatusPill
                  tone={l.linha.situacao === "finalizou" ? "ink" : "neutral"}
                >
                  {SITUACAO[l.linha.situacao]}
                </StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Grade de passagens: as últimas leituras, da mais recente para a mais antiga.
export function GradeDePassagens({
  passagens,
  limite = 120,
}: {
  passagens: PassagemDoHistorico[];
  limite?: number;
}) {
  const visiveis = passagens.slice(0, limite);
  return (
    <div className="border-border bg-surface flex max-h-[34rem] flex-col overflow-hidden rounded-lg border">
      <div className="border-border border-b px-3 py-2">
        <h2 className="text-ink text-sm font-semibold">Grade de passagens</h2>
        <p className="text-ink-3 text-xs">
          {passagens.length === 0
            ? "Nenhuma passagem ainda."
            : `Últimas ${visiveis.length} de ${passagens.length}, da mais recente para a mais antiga.`}
        </p>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-max text-left text-xs tabular-nums">
          <thead className="bg-surface text-ink-3 sticky top-0 tracking-wide uppercase">
            <tr className="border-border border-b">
              <th className="px-2.5 py-1.5 font-medium">Hora</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Kart</th>
              <th className="px-2.5 py-1.5 font-medium">Piloto</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Volta</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Tempo</th>
              <th className="px-2.5 py-1.5 font-medium">Sensor</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((p) => (
              <tr
                key={p.id}
                title={p.motivo}
                className={clsx(
                  "border-border border-b last:border-0",
                  !p.contada && "text-ink-3",
                )}
              >
                <td className="font-display px-2.5 py-1.5">
                  {formatarHoraComMs(p.instanteMs)}
                </td>
                <td className="font-display px-2.5 py-1.5 text-right">
                  {p.kartNumero ?? "—"}
                </td>
                <td className="px-2.5 py-1.5">
                  {p.participante ?? "sem piloto"}
                </td>
                <td className="px-2.5 py-1.5 text-right">
                  {p.numeroVolta ?? (p.contada ? "largada" : "—")}
                </td>
                <td className="font-display px-2.5 py-1.5 text-right">
                  {p.tempoVoltaMs !== undefined
                    ? formatarTempoVolta(p.tempoVoltaMs)
                    : p.contada
                      ? "—"
                      : "não contou"}
                </td>
                <td className="font-display px-2.5 py-1.5">
                  {p.transponder}
                  {p.simulado ? " · simulado" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
