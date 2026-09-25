"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const TABS = [
  { href: "/campeonato/classificacao", label: "Classificação" },
  { href: "/campeonato/calendario", label: "Calendário" },
  { href: "/campeonato/tracados", label: "Traçados" },
  { href: "/campeonato/resultados", label: "Resultados" },
  { href: "/campeonato/live-timing", label: "Live timing" },
];

export function CampeonatoTabs() {
  const pathname = usePathname();

  return (
    <div className="border-border flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const ativo = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              ativo
                ? "border-orange text-orange"
                : "text-ink-2 hover:text-ink border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
