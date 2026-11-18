import { FormAcao } from "@/components/operacao/form-acao";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { nomearParticipanteAction } from "@/lib/corrida-actions";
import { StatusPill } from "@/components/ui/status-pill";
import type { LinhaClassificacao } from "@/lib/cronometragem/motor";
import {
  SITUACAO,
  nomeDoSensor,
  textoDiferenca,
} from "@/lib/cronometragem/rotulos";
import {
  formatarHoraComMs,
  formatarTempoVolta,
} from "@/lib/cronometragem/voltas";

// Classificação (corrida por tempo): mais voltas válidas primeiro; com as
// mesmas voltas, quem cruzou a linha antes. A tabela mostra só o essencial;
// o resto (kart, sensor, tempo total, voltas) abre em "detalhes".
export function TabelaClassificacao({
  linhas,
  rotulosDosSensores,
  mostrarSensor,
  nomeacao,
}: {
  linhas: LinhaClassificacao[];
  rotulosDosSensores?: Map<string, string | undefined>;
  mostrarSensor: boolean;
  // Karts que entraram sozinhos e ainda esperam o nome do piloto.
  nomeacao?: {
    naoNomeados: Set<string>;
    pendentes: { id: string; nome: string }[];
  };
}) {
  const colunas: Coluna<LinhaClassificacao>[] = [
    {
      header: "Pos",
      cell: (l) => (
        <span className="text-lg font-semibold">
          {l.posicao !== null ? `${l.posicao}º` : "—"}
        </span>
      ),
    },
    {
      header: "Piloto",
      cell: (l) => (
        <div>
          <p className="text-ink font-medium">{l.nome}</p>
          {nomeacao?.naoNomeados.has(l.participanteId) ? (
            <FormAcao
              action={nomearParticipanteAction}
              rotulo="Dar nome"
              variante="secondary"
              className="mt-2 w-56"
            >
              <input
                type="hidden"
                name="participanteId"
                value={l.participanteId}
              />
              <input
                name="nome"
                id={`nome-${l.participanteId}`}
                aria-label={`Nome do piloto do ${l.nome}`}
                placeholder="Nome do piloto"
                maxLength={80}
                className="border-border-strong bg-surface text-ink focus:border-orange w-full rounded-md border px-3 py-2 text-sm outline-none"
              />
              {nomeacao.pendentes.length > 0 ? (
                <select
                  name="pendenteId"
                  id={`pendente-${l.participanteId}`}
                  aria-label="Ou escolha um piloto da lista"
                  defaultValue=""
                  className="border-border-strong bg-surface text-ink focus:border-orange w-full rounded-md border px-3 py-2 text-sm outline-none"
                >
                  <option value="">ou escolha da lista…</option>
                  {nomeacao.pendentes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              ) : null}
            </FormAcao>
          ) : null}
          <p className="mt-0.5">
            <StatusPill tone={l.situacao === "finalizou" ? "ink" : "neutral"}>
              {SITUACAO[l.situacao]}
            </StatusPill>
          </p>
          <details className="mt-1">
            <summary className="text-ink-3 cursor-pointer text-xs">
              detalhes
            </summary>
            <dl className="text-ink-2 mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              <dt>Kart</dt>
              <dd>{l.kartNumero ?? "—"}</dd>
              {mostrarSensor ? (
                <>
                  <dt>Sensor</dt>
                  <dd className="font-display">
                    {l.transponder
                      ? nomeDoSensor(
                          l.transponder,
                          rotulosDosSensores?.get(l.transponder),
                        )
                      : "sem sensor"}
                  </dd>
                </>
              ) : null}
              <dt>Tempo total</dt>
              <dd className="font-display">
                {l.tempoTotalMs !== null
                  ? formatarTempoVolta(l.tempoTotalMs)
                  : "—"}
              </dd>
              <dt>Última passagem</dt>
              <dd className="font-display">
                {l.ultimaPassagemMs !== null
                  ? formatarHoraComMs(l.ultimaPassagemMs)
                  : "—"}
              </dd>
              {l.voltasLista.length > 0 ? (
                <>
                  <dt>Voltas</dt>
                  <dd>
                    <ol className="font-display">
                      {l.voltasLista.map((v) => (
                        <li
                          key={v.numero}
                          className={
                            v.tempoMs === l.melhorVoltaMs
                              ? "text-orange-ink font-semibold"
                              : undefined
                          }
                        >
                          V{v.numero} · {formatarTempoVolta(v.tempoMs)}
                          {v.final ? " · final" : ""}
                        </li>
                      ))}
                    </ol>
                  </dd>
                </>
              ) : null}
            </dl>
          </details>
        </div>
      ),
    },
    { header: "Voltas", cell: (l) => l.voltas, numerica: true },
    {
      header: "Última",
      cell: (l) =>
        l.ultimaVoltaMs !== null ? formatarTempoVolta(l.ultimaVoltaMs) : "—",
      numerica: true,
    },
    {
      header: "Melhor",
      cell: (l) =>
        l.melhorVoltaMs !== null ? formatarTempoVolta(l.melhorVoltaMs) : "—",
      numerica: true,
    },
    {
      header: "Diferença",
      cell: (l) => textoDiferenca(l.diferenca),
      numerica: true,
    },
  ];

  return (
    <DataTable
      colunas={colunas}
      linhas={linhas}
      chave={(l) => l.participanteId}
      vazio="Nenhum piloto no grid."
      linhaClassName={(l) => (l.posicao === 1 ? "bg-orange/5" : undefined)}
    />
  );
}
