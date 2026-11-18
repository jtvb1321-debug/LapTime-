"use client";

import Link from "next/link";
import { useState } from "react";
import { clsx } from "clsx";
import { StatusPill } from "@/components/ui/status-pill";
import {
  escolherProximaEtapa,
  rotuloDoStatus,
  TOM_DO_STATUS,
} from "@/lib/etapa-destaque";
import { formatData } from "@/lib/mock/data";
import type { Etapa } from "@/lib/types";
import { useMockStore } from "@/lib/use-mock-store";

const DIAS = [
  { curto: "D", cheio: "domingo" },
  { curto: "S", cheio: "segunda" },
  { curto: "T", cheio: "terça" },
  { curto: "Q", cheio: "quarta" },
  { curto: "Q", cheio: "quinta" },
  { curto: "S", cheio: "sexta" },
  { curto: "S", cheio: "sábado" },
];

function partes(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return { ano, mes: mes - 1, dia };
}

function nomeDoMes(ano: number, mes: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes, 1)));
}

// Calendário visual das etapas cadastradas. Abre no mês da próxima etapa, que fica em destaque.
// Usa a mesma fonte do calendário completo (etapas do painel) e não cria data nenhuma: o que não
// está cadastrado (como o horário) simplesmente não aparece.
export function CalendarioEtapas({
  etapasIniciais,
}: {
  etapasIniciais: Etapa[];
}) {
  const [etapas] = useMockStore("gridlap:etapas", etapasIniciais);
  const proxima = escolherProximaEtapa(etapas);
  const base = proxima ? partes(proxima.data) : null;
  const hoje = new Date();
  const [visivel, setVisivel] = useState<{ ano: number; mes: number } | null>(
    null,
  );
  const [escolhida, setEscolhida] = useState<string | null>(null);

  if (etapas.length === 0) {
    return (
      <div className="rounded-2xl border border-white/12 bg-black/20 p-8 text-center">
        <p className="text-ink text-base font-semibold">
          Nenhuma etapa cadastrada ainda
        </p>
        <p className="text-ink-2 mt-1 text-sm">
          Quando o calendário for divulgado, a próxima etapa aparece aqui em
          destaque.
        </p>
      </div>
    );
  }

  const { ano, mes } = visivel ?? {
    ano: base?.ano ?? hoje.getFullYear(),
    mes: base?.mes ?? hoje.getMonth(),
  };
  const primeiroDia = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const doMes = etapas.filter((e) => {
    const p = partes(e.data);
    return p.ano === ano && p.mes === mes;
  });
  const porDia = new Map<number, Etapa[]>();
  for (const e of doMes) {
    const d = partes(e.data).dia;
    porDia.set(d, [...(porDia.get(d) ?? []), e]);
  }

  const selecionada =
    etapas.find((e) => e.id === escolhida) ?? proxima ?? undefined;
  const mover = (delta: number) => {
    const d = new Date(Date.UTC(ano, mes + delta, 1));
    setVisivel({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() });
  };
  const ehHoje = (dia: number) =>
    hoje.getFullYear() === ano &&
    hoje.getMonth() === mes &&
    hoje.getDate() === dia;

  const celulas: (number | null)[] = [
    ...Array.from({ length: primeiroDia }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="rounded-2xl border border-white/12 bg-black/20 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Mês anterior"
            className="text-ink inline-flex size-11 items-center justify-center rounded-full border border-white/15 hover:bg-white/10"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <p
            aria-live="polite"
            className="font-display text-ink text-xl font-semibold first-letter:uppercase"
          >
            {nomeDoMes(ano, mes)}
          </p>
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Próximo mês"
            className="text-ink inline-flex size-11 items-center justify-center rounded-full border border-white/15 hover:bg-white/10"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <ol
          className="grid grid-cols-7 gap-1 sm:gap-1.5"
          aria-label={`Dias de ${nomeDoMes(ano, mes)}`}
        >
          {DIAS.map((d) => (
            <li
              key={d.cheio}
              className="text-ink-3 py-1 text-center text-[11px] font-semibold tracking-wider uppercase"
            >
              <abbr title={d.cheio} className="no-underline">
                {d.curto}
              </abbr>
            </li>
          ))}
          {celulas.map((dia, i) => {
            if (dia === null) return <li key={`v-${i}`} aria-hidden="true" />;
            const doDia = porDia.get(dia);
            const ehProxima = doDia?.some((e) => e.id === proxima?.id);
            const marcado = doDia?.some((e) => e.id === selecionada?.id);
            if (!doDia) {
              return (
                <li
                  key={dia}
                  className={clsx(
                    "font-display text-ink-2 flex aspect-square items-center justify-center rounded-lg text-sm sm:text-base",
                    ehHoje(dia) && "ring-1 ring-white/40",
                  )}
                >
                  {dia}
                </li>
              );
            }
            return (
              <li key={dia}>
                <button
                  type="button"
                  onClick={() => setEscolhida(doDia[0].id)}
                  aria-pressed={marcado}
                  aria-label={`${dia} de ${nomeDoMes(ano, mes)}: ${doDia
                    .map((e) => e.nome)
                    .join(", ")}${ehProxima ? " (próxima etapa)" : ""}`}
                  className={clsx(
                    "font-display flex aspect-square w-full items-center justify-center rounded-lg text-sm font-bold transition-colors sm:text-base",
                    ehProxima
                      ? "bg-orange text-on-orange shadow-[0_0_24px_rgba(76,201,255,0.55)]"
                      : "text-ink border border-white/30 hover:bg-white/10",
                    marcado && "ring-2 ring-white",
                  )}
                >
                  {dia}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="text-ink-3 mt-3 text-xs">
          <span
            aria-hidden="true"
            className="bg-orange mr-1.5 inline-block size-2 rounded-full align-middle"
          />
          Próxima etapa em laranja. Toque numa data marcada para ver os
          detalhes.
        </p>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/12 bg-black/25 p-5 sm:p-6">
        {selecionada ? (
          <>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink-3 text-xs font-semibold tracking-[0.18em] uppercase">
                  {selecionada.id === proxima?.id
                    ? "Próxima etapa"
                    : `Etapa ${selecionada.numero}`}
                </p>
                <StatusPill tone={TOM_DO_STATUS[selecionada.status]}>
                  {rotuloDoStatus(selecionada.status)}
                </StatusPill>
              </div>
              <p className="font-display text-ink mt-3 text-3xl leading-tight font-bold">
                {selecionada.nome}
              </p>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-ink-3 text-xs tracking-wide uppercase">
                    Data
                  </dt>
                  <dd className="font-display text-orange-ink text-xl font-semibold">
                    {formatData(selecionada.data)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-3 text-xs tracking-wide uppercase">
                    Local
                  </dt>
                  <dd className="text-ink">
                    {selecionada.kartodromo} · {selecionada.cidade}
                  </dd>
                </div>
              </dl>
            </div>
            <Link
              href="/campeonato/calendario"
              className="bg-orange text-on-orange hover:bg-orange-strong inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-medium"
            >
              Ver detalhes no calendário
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
