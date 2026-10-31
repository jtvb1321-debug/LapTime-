import type { LinhaClassificacao } from "@/lib/cronometragem/motor";
import { montarQualy, montarVoltaAVolta } from "@/lib/cronometragem/relatorios";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";

function tempo(ms: number | null): string {
  return ms === null ? "—" : formatarTempoVolta(ms);
}

// Volta a volta: uma coluna por piloto e uma linha por volta, como no LapTime.
// Em laranja a melhor volta de cada piloto; com fundo, a melhor da bateria.
// A volta mais recente fica no topo, para acompanhar ao vivo.
export function TabelaVoltaAVolta({
  linhas,
}: {
  linhas: LinhaClassificacao[];
}) {
  const m = montarVoltaAVolta(linhas);
  if (m.participantes.length === 0) {
    return (
      <div className="border-border bg-surface text-ink-2 rounded-lg border px-5 py-8 text-center text-sm">
        Os tempos de cada volta aparecem aqui assim que os karts completarem a
        primeira volta.
      </div>
    );
  }
  return (
    <div className="border-border bg-surface overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-border text-ink-3 border-b text-xs tracking-wide uppercase">
            <th className="bg-surface sticky left-0 px-3 py-3 text-center font-medium">
              Volta
            </th>
            {m.participantes.map((p) => (
              <th key={p.id} className="px-3 py-3 text-right font-medium">
                <span className="text-ink block normal-case">{p.nome}</span>
                {p.kartNumero ? (
                  <span className="block normal-case">kart {p.kartNumero}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono">
          {[...m.linhas].reverse().map((l) => (
            <tr key={l.numero} className="border-border border-b last:border-0">
              <td className="bg-surface text-ink sticky left-0 px-3 py-2 text-center font-semibold">
                {l.numero}
              </td>
              {l.tempos.map((valor, i) => (
                <td
                  key={m.participantes[i].id}
                  className={
                    valor === null
                      ? "text-ink-3 px-3 py-2 text-right"
                      : valor === m.melhorGeral
                        ? "bg-orange/15 text-orange-ink px-3 py-2 text-right font-semibold"
                        : valor === m.melhores[i]
                          ? "text-orange-ink px-3 py-2 text-right font-semibold"
                          : "text-ink px-3 py-2 text-right"
                  }
                >
                  {tempo(valor)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-border border-t-2">
            <td className="bg-surface text-ink-3 sticky left-0 px-3 py-2 text-center font-sans text-xs">
              Melhor
            </td>
            {m.melhores.map((valor, i) => (
              <td
                key={m.participantes[i].id}
                className="text-ink px-3 py-2 text-right font-semibold"
              >
                {tempo(valor)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Qualificação: ordenada pela melhor volta de cada piloto.
export function TabelaQualificacao({
  linhas,
}: {
  linhas: LinhaClassificacao[];
}) {
  const q = montarQualy(linhas);
  return (
    <div className="border-border bg-surface overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-border text-ink-3 border-b text-xs tracking-wide uppercase">
            <th className="px-4 py-3 font-medium">Pos</th>
            <th className="px-4 py-3 font-medium">Piloto</th>
            <th className="px-4 py-3 text-right font-medium">Melhor volta</th>
            <th className="px-4 py-3 text-right font-medium">Volta nº</th>
            <th className="px-4 py-3 text-right font-medium">Diferença</th>
            <th className="px-4 py-3 text-right font-medium">Média</th>
          </tr>
        </thead>
        <tbody>
          {q.map((l, i) => (
            <tr
              key={`${l.nome}-${i}`}
              className="border-border border-b last:border-0"
            >
              <td className="text-ink px-4 py-3 font-semibold">
                {l.posicao !== null ? `${l.posicao}º` : "—"}
              </td>
              <td className="text-ink px-4 py-3">
                {l.nome}
                {l.kartNumero ? (
                  <span className="text-ink-3 text-xs">
                    {" "}
                    · kart {l.kartNumero}
                  </span>
                ) : null}
              </td>
              <td className="text-ink px-4 py-3 text-right font-mono">
                {tempo(l.melhorVoltaMs)}
              </td>
              <td className="text-ink-2 px-4 py-3 text-right font-mono">
                {l.melhorVoltaNumero ?? "—"}
              </td>
              <td className="text-ink-2 px-4 py-3 text-right font-mono">
                {l.diferencaMs !== null
                  ? `+${formatarTempoVolta(l.diferencaMs)}`
                  : "—"}
              </td>
              <td className="text-ink-2 px-4 py-3 text-right font-mono">
                {tempo(l.mediaMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
