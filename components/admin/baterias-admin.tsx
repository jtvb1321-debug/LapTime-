"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { StatusPill } from "@/components/ui/status-pill";
import {
  criarBateriasDaEtapaAction,
  excluirBateriaDoCampeonatoAction,
  sincronizarPilotosDaBateriaAction,
} from "@/lib/baterias-campeonato-actions";
import type { BateriaDoCampeonato } from "@/lib/baterias-campeonato-store";
import type { EstadoCorrida } from "@/lib/cronometragem/corridas-store";
import { formatDataEHora } from "@/lib/etapa-formato";
import type { AcaoState } from "@/lib/operacao-actions";

export interface EtapaDasBaterias {
  id: string;
  nome: string;
  data: string;
  hora: string;
  status: string;
  confirmados: number;
}

const ESTADO: Record<
  EstadoCorrida,
  { rotulo: string; tom: "neutral" | "warning" | "success" | "info" | "danger" }
> = {
  preparada: { rotulo: "preparando", tom: "neutral" },
  pronta: { rotulo: "pronta", tom: "info" },
  em_andamento: { rotulo: "rolando agora", tom: "success" },
  encerrando: { rotulo: "encerrando", tom: "warning" },
  finalizada: { rotulo: "finalizada", tom: "neutral" },
  cancelada: { rotulo: "cancelada", tom: "danger" },
};

function Estado({ e }: { e: EstadoCorrida }) {
  const x = ESTADO[e];
  return <StatusPill tone={x.tom}>{x.rotulo}</StatusPill>;
}

// Baterias do campeonato por etapa: cada categoria vira uma bateria real da cronometragem
// (classificação e depois corrida), com os pilotos inscritos e confirmados.
export function BateriasAdmin({
  etapas,
  baterias,
  categorias,
  podeOperar,
}: {
  etapas: EtapaDasBaterias[];
  baterias: BateriaDoCampeonato[];
  categorias: { id: string; nome: string }[];
  podeOperar: boolean;
}) {
  const [resultado, setResultado] = useState<{
    chave: string;
    estado: AcaoState;
  } | null>(null);
  const [pendente, iniciar] = useTransition();

  function executar(chave: string, fn: () => Promise<AcaoState>) {
    iniciar(async () => setResultado({ chave, estado: await fn() }));
  }

  if (etapas.length === 0) {
    return (
      <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
        O campeonato ainda não tem etapas. Cadastre em Etapas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {etapas.map((e) => {
        const dela = baterias.filter((b) => b.etapaId === e.id);
        const aberta = e.status !== "encerrada" && e.status !== "cancelada";
        const msg = resultado?.chave === e.id ? resultado.estado : null;
        return (
          <section
            key={e.id}
            aria-labelledby={`etapa-${e.id}`}
            className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  id={`etapa-${e.id}`}
                  className="font-display text-ink text-lg font-bold"
                >
                  {e.nome}
                </h2>
                <p className="text-orange-ink text-sm font-medium">
                  {formatDataEHora({ data: e.data, hora: e.hora })}
                </p>
                <p className="text-ink-3 text-xs">
                  {e.confirmados} inscrição(ões) confirmada(s)
                </p>
              </div>
              {podeOperar && aberta ? (
                <Button
                  variant="secondary"
                  disabled={pendente}
                  carregando={pendente}
                  onClick={() =>
                    executar(e.id, () => criarBateriasDaEtapaAction(e.id))
                  }
                >
                  Criar baterias das categorias
                </Button>
              ) : null}
            </div>

            {dela.length === 0 ? (
              <p className="text-ink-2 text-sm">
                Nenhuma bateria ainda. Confirme as inscrições (em Inscrições e
                Pagamentos) e crie as baterias: uma por categoria.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {dela.map((b) => {
                  const categoria = categorias.find(
                    (c) => c.id === b.categoriaId,
                  );
                  const naoComecou =
                    ["preparada", "pronta"].includes(b.estadoClassificacao) &&
                    !b.corridaId;
                  const chave = `${e.id}:${b.id}`;
                  const msgB =
                    resultado?.chave === chave ? resultado.estado : null;
                  return (
                    <li
                      key={b.id}
                      className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">
                          <NomeCategoria
                            categoriaId={b.categoriaId}
                            className="inline-block rounded bg-[#0c1630] px-2 py-0.5"
                          >
                            {categoria?.nome ?? b.categoriaId}
                          </NomeCategoria>{" "}
                          <span className="text-ink-3 font-normal">
                            · {b.pilotos} piloto(s)
                          </span>
                        </span>
                        <span className="text-ink-2 flex flex-wrap items-center gap-2 text-xs">
                          Classificação <Estado e={b.estadoClassificacao} />
                          {b.estadoCorrida ? (
                            <>
                              · Corrida <Estado e={b.estadoCorrida} />
                            </>
                          ) : (
                            <span className="text-ink-3">
                              · corrida criada ao fim da classificação
                            </span>
                          )}
                        </span>
                        {msgB?.erro ? (
                          <span role="alert" className="text-danger text-xs">
                            {msgB.erro}
                          </span>
                        ) : null}
                        {msgB?.ok ? (
                          <span role="status" className="text-success text-xs">
                            {msgB.ok}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/cronometragem/corridas/${b.corridaId ?? b.classificacaoId}`}
                          className="text-orange-ink min-h-11 content-center text-sm font-medium hover:underline md:min-h-0"
                        >
                          Abrir na cronometragem →
                        </Link>
                        {podeOperar &&
                        !b.corridaId &&
                        ["preparada", "pronta"].includes(
                          b.estadoClassificacao,
                        ) ? (
                          <button
                            type="button"
                            disabled={pendente}
                            onClick={() =>
                              executar(chave, () =>
                                sincronizarPilotosDaBateriaAction(b.id),
                              )
                            }
                            className="text-ink-2 min-h-11 text-xs font-medium hover:underline md:min-h-0"
                          >
                            Atualizar pilotos
                          </button>
                        ) : null}
                        {podeOperar && naoComecou ? (
                          <button
                            type="button"
                            disabled={pendente}
                            onClick={() => {
                              if (!window.confirm("Excluir esta bateria?"))
                                return;
                              executar(chave, () =>
                                excluirBateriaDoCampeonatoAction(b.id),
                              );
                            }}
                            className="text-danger min-h-11 text-xs font-medium hover:underline md:min-h-0"
                          >
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {msg?.erro ? (
              <p role="alert" className="text-danger text-sm">
                {msg.erro}
              </p>
            ) : null}
            {msg?.ok ? (
              <p role="status" className="text-success text-sm">
                {msg.ok}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
