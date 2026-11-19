"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDataEHora } from "@/lib/etapa-formato";
import {
  cancelarMinhaInscricaoAction,
  inscreverMeAction,
} from "@/lib/inscricoes-actions";
import type { InscricaoCompleta } from "@/lib/inscricoes-store";
import { formatMoeda } from "@/lib/mock/data";
import type { AcaoState } from "@/lib/operacao-actions";
import type { Etapa } from "@/lib/types";

const ROTULO = {
  pendente: "Aguardando pagamento",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
} as const;
const TOM = {
  pendente: "warning",
  confirmada: "success",
  cancelada: "neutral",
} as const;

// Etapas abertas do campeonato ativo: o piloto se inscreve (ou cancela) por aqui. O pagamento é
// combinado com a organização, que o confirma no painel.
export function InscreverNaEtapa({
  etapas,
  minhas,
}: {
  etapas: Etapa[];
  minhas: InscricaoCompleta[];
}) {
  const [resultado, setResultado] = useState<{
    etapaId: string;
    estado: AcaoState;
  } | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <ul className="flex flex-col gap-3">
      {etapas.map((e) => {
        const minha = minhas.find(
          (m) => m.etapaId === e.id && m.status !== "cancelada",
        );
        const valor = e.valorInscricaoCentavos ?? 0;
        const msg = resultado?.etapaId === e.id ? resultado.estado : null;
        return (
          <li
            key={e.id}
            className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-ink text-lg font-bold">
                  {e.nome}
                </p>
                <p className="text-orange-ink text-sm font-medium">
                  {formatDataEHora(e)}
                </p>
                <p className="text-ink-2 text-xs">
                  {e.kartodromo}, {e.cidade} ·{" "}
                  {valor > 0
                    ? `Inscrição ${formatMoeda(valor)}`
                    : "Inscrição gratuita"}
                </p>
              </div>
              {minha ? (
                <StatusPill tone={TOM[minha.status]}>
                  {ROTULO[minha.status]}
                </StatusPill>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {!minha ? (
                <Button
                  disabled={pendente}
                  carregando={pendente}
                  onClick={() =>
                    iniciar(async () =>
                      setResultado({
                        etapaId: e.id,
                        estado: await inscreverMeAction(e.id),
                      }),
                    )
                  }
                >
                  Inscrever-me
                </Button>
              ) : minha.status === "pendente" ? (
                <Button
                  variant="secondary"
                  disabled={pendente}
                  onClick={() => {
                    if (!window.confirm("Cancelar sua inscrição nesta etapa?"))
                      return;
                    iniciar(async () =>
                      setResultado({
                        etapaId: e.id,
                        estado: await cancelarMinhaInscricaoAction(minha.id),
                      }),
                    );
                  }}
                >
                  Cancelar inscrição
                </Button>
              ) : (
                <p className="text-ink-2 text-sm">
                  Você está inscrito. Para cancelar, fale com a organização.
                </p>
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}
