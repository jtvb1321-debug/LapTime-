"use client";

import { clsx } from "clsx";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { TracadoMiniatura } from "@/components/tracado/tracado-miniatura";
import { formatData } from "@/lib/mock/data";
import { CHAVE_TRACADOS } from "@/lib/tracado3d/rota";
import { useMockStore } from "@/lib/use-mock-store";
import type { Etapa, Tracado } from "@/lib/types";

const TONE = {
  agendada: "neutral",
  em_andamento: "orange",
  encerrada: "ink",
  cancelada: "neutral",
} as const;

const BORDA = {
  agendada: "border-l-ink-3",
  em_andamento: "border-l-orange",
  encerrada: "border-l-ink",
  cancelada: "border-l-ink-3",
} as const;

// Client component porque etapas/traçados criados no admin ficam no
// localStorage (useMockStore) — uma página de servidor só veria o array
// vazio de lib/mock/data.ts e nunca mostraria o que acabou de ser cadastrado.
export function CalendarioLista({
  etapasIniciais,
  tracadosIniciais,
}: {
  etapasIniciais: Etapa[];
  tracadosIniciais: Tracado[];
}) {
  const [etapas] = useMockStore("gridlap:etapas", etapasIniciais);
  const [tracados] = useMockStore(CHAVE_TRACADOS, tracadosIniciais);

  if (etapas.length === 0) {
    return (
      <p className="text-ink-2 text-sm">Nenhuma etapa cadastrada ainda.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {etapas.map((etapa) => {
        const tracado = etapa.tracadoId
          ? tracados.find((t) => t.id === etapa.tracadoId)
          : undefined;
        return (
          <Card
            key={etapa.id}
            className={clsx("border-l-4", BORDA[etapa.status])}
          >
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {tracado ? (
                  <TracadoMiniatura
                    pontos={tracado.pontos}
                    fechado={tracado.fechado}
                    className="border-border h-12 w-16 shrink-0 rounded border"
                  />
                ) : null}
                <span className="text-ink-3 font-mono text-sm">
                  {formatData(etapa.data)}
                </span>
                <div>
                  <p className="text-ink font-medium">
                    Etapa {etapa.numero} —{" "}
                    {etapa.nome.replace(/^Etapa \d+( — )?/, "") ||
                      etapa.kartodromo}
                  </p>
                  <p className="text-ink-2 text-sm">
                    {etapa.kartodromo}, {etapa.cidade}
                    {tracado ? ` · ${tracado.nome}` : ""}
                  </p>
                </div>
              </div>
              <StatusPill tone={TONE[etapa.status]}>
                {etapa.status.replace("_", " ")}
              </StatusPill>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
