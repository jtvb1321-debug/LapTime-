import { Campo, FormAcao, Selecao } from "@/components/operacao/form-acao";
import { StatusPill } from "@/components/ui/status-pill";
import { registrarOcorrenciaAction } from "@/lib/corrida-actions";
import type { PilotoDaCorrida } from "@/lib/cronometragem/corridas-store";
import { SITUACAO } from "@/lib/cronometragem/rotulos";

// Ocorrências da prova: DNS, DNF, DSQ e penalidade em tempo, sempre com motivo
// (ficam na auditoria). Regras: DSQ e DNS saem da classificação; DNF fica atrás
// de quem terminou; a penalidade soma ao tempo total e ao desempate.
export function OcorrenciasDaBateria({ grid }: { grid: PilotoDaCorrida[] }) {
  const pilotos = grid.filter((p) => !p.vaga);
  if (pilotos.length === 0) return null;
  return (
    <details className="border-border bg-surface rounded-lg border">
      <summary className="text-ink cursor-pointer px-5 py-4 text-sm font-semibold">
        Ocorrências (DNS, DNF, DSQ e penalidades)
      </summary>
      <ul className="divide-border border-border divide-y border-t">
        {pilotos.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink text-sm font-medium">{p.nome}</p>
              <div className="flex gap-2">
                {p.situacaoManual ? (
                  <StatusPill tone="orange">
                    {SITUACAO[p.situacaoManual]}
                  </StatusPill>
                ) : null}
                {p.penalidadeMs > 0 ? (
                  <StatusPill tone="orange">
                    +{p.penalidadeMs / 1000} s
                  </StatusPill>
                ) : null}
              </div>
            </div>
            {p.ocorrenciaMotivo ? (
              <p className="text-ink-3 text-xs">Motivo: {p.ocorrenciaMotivo}</p>
            ) : null}
            <details>
              <summary className="text-orange-ink cursor-pointer text-sm font-medium">
                Registrar ocorrência
              </summary>
              <FormAcao
                action={registrarOcorrenciaAction}
                confirmar="Registrar esta ocorrência? Ela altera a classificação e fica na auditoria."
                rotulo="Registrar"
                limpar={false}
                className="mt-3 max-w-sm"
              >
                <input type="hidden" name="pilotoId" value={p.id} />
                <Selecao
                  id={`situacao-${p.id}`}
                  name="situacao"
                  rotulo="Situação"
                  defaultValue={p.situacaoManual ?? ""}
                >
                  <option value="">Normal (sem ocorrência)</option>
                  <option value="dns">DNS: não largou</option>
                  <option value="dnf">DNF: não terminou</option>
                  <option value="dsq">DSQ: desclassificado</option>
                </Selecao>
                <Campo
                  id={`penalidade-${p.id}`}
                  name="penalidade"
                  rotulo="Penalidade (segundos)"
                  type="number"
                  min={0}
                  max={3600}
                  defaultValue={p.penalidadeMs / 1000}
                />
                <Campo
                  id={`motivo-${p.id}`}
                  name="motivo"
                  rotulo="Motivo"
                  required
                  minLength={3}
                />
              </FormAcao>
            </details>
          </li>
        ))}
      </ul>
    </details>
  );
}
