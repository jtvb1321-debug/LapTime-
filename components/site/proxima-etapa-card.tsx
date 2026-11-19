"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import {
  escolherProximaEtapa,
  rotuloDoStatus,
  TOM_DO_STATUS,
} from "@/lib/etapa-destaque";
import { formatDataEHora } from "@/lib/etapa-formato";
import type { Etapa } from "@/lib/types";

// Próxima etapa cadastrada, no destaque da página inicial. Lê da mesma fonte do calendário
// (etapas criadas no painel ficam no navegador); sem etapa, mostra um estado vazio.
export function ProximaEtapaCard({
  etapasIniciais,
}: {
  etapasIniciais: Etapa[];
}) {
  const etapas = etapasIniciais;
  const etapa = escolherProximaEtapa(etapas);

  return (
    <div className="rounded-2xl border border-white/12 bg-black/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink-3 text-xs font-semibold tracking-[0.18em] uppercase">
          Próxima etapa
        </p>
        {etapa ? (
          <StatusPill tone={TOM_DO_STATUS[etapa.status]}>
            {rotuloDoStatus(etapa.status)}
          </StatusPill>
        ) : null}
      </div>
      {etapa ? (
        <>
          <p className="font-display text-ink mt-3 text-3xl leading-tight font-bold">
            {etapa.nome} · {etapa.kartodromo}
          </p>
          <p className="text-ink-2 mt-1 text-sm">{etapa.cidade}</p>
          <p className="font-display text-orange-ink mt-3 text-xl font-semibold">
            {formatDataEHora(etapa)}
          </p>
          <Link
            href="/campeonato/calendario"
            className="text-orange-ink mt-4 inline-flex min-h-11 items-center text-sm font-medium hover:underline"
          >
            Ver calendário completo →
          </Link>
        </>
      ) : (
        <p className="text-ink-2 mt-3 text-sm">
          Nenhuma etapa cadastrada ainda. Volte em breve.
        </p>
      )}
    </div>
  );
}
