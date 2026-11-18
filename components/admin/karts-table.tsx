"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { toneParaStatus } from "@/components/ui/status-pill";
import type { Kart, StatusKart } from "@/lib/types";

const OPCOES: { value: StatusKart; label: string }[] = [
  { value: "disponivel", label: "Disponível" },
  { value: "em_uso", label: "Em uso" },
  { value: "manutencao", label: "Manutenção" },
];

const TONE_SELECT_CLASSES: Record<string, string> = {
  ink: "bg-ink text-white",
  "orange-soft": "bg-warning-bg text-warning",
  orange: "bg-orange/10 text-orange-ink",
  neutral: "bg-ink/5 text-ink-2",
};

export function KartsTable({ kartsIniciais }: { kartsIniciais: Kart[] }) {
  const [status, setStatus] = useState<Record<string, StatusKart>>(() =>
    Object.fromEntries(kartsIniciais.map((k) => [k.id, k.status])),
  );

  const colunas: Coluna<Kart>[] = [
    { header: "Nº", cell: (k) => k.numero, numerica: true },
    { header: "Placa", cell: (k) => k.placa },
    {
      header: "Status",
      cell: (k) => {
        const atual = status[k.id];
        return (
          <select
            aria-label={`Status do kart ${k.numero}`}
            value={atual}
            onChange={(e) =>
              setStatus((prev) => ({
                ...prev,
                [k.id]: e.target.value as StatusKart,
              }))
            }
            className={clsx(
              "cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none",
              TONE_SELECT_CLASSES[toneParaStatus(atual)],
            )}
          >
            {OPCOES.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        );
      },
    },
  ];

  return (
    <DataTable colunas={colunas} linhas={kartsIniciais} chave={(k) => k.id} />
  );
}
