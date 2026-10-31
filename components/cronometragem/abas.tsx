"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Aba {
  href: string;
  rotulo: string;
  ativa: (caminho: string) => boolean;
}

const BASE = "/admin/cronometragem";

const ABAS: Aba[] = [
  { href: BASE, rotulo: "Ao vivo", ativa: (c) => c === BASE },
  {
    href: `${BASE}/corridas`,
    rotulo: "Baterias",
    ativa: (c) => c.startsWith(`${BASE}/corridas`),
  },
  {
    href: `${BASE}/equipamentos`,
    rotulo: "Equipamentos",
    ativa: (c) =>
      c.startsWith(`${BASE}/equipamentos`) ||
      c.startsWith(`${BASE}/transponders`) ||
      c.startsWith(`${BASE}/karts`),
  },
];

const SUB_ABAS: Aba[] = [
  {
    href: `${BASE}/equipamentos`,
    rotulo: "Decoders",
    ativa: (c) => c.startsWith(`${BASE}/equipamentos`),
  },
  {
    href: `${BASE}/transponders`,
    rotulo: "Transponders",
    ativa: (c) => c.startsWith(`${BASE}/transponders`),
  },
  {
    href: `${BASE}/karts`,
    rotulo: "Karts",
    ativa: (c) => c.startsWith(`${BASE}/karts`),
  },
];

function Barra({
  abas,
  rotuloAcessivel,
  discreta,
}: {
  abas: Aba[];
  rotuloAcessivel: string;
  discreta?: boolean;
}) {
  const caminho = usePathname();
  return (
    <nav
      aria-label={rotuloAcessivel}
      className={clsx(
        "flex gap-1 overflow-x-auto",
        discreta ? "" : "border-border border-b",
      )}
    >
      {abas.map((aba) => {
        const ativa = aba.ativa(caminho);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              discreta
                ? clsx(
                    "rounded-full",
                    ativa
                      ? "bg-ink text-white"
                      : "text-ink-2 hover:bg-ink/5 hover:text-ink",
                  )
                : clsx(
                    "-mb-px border-b-2",
                    ativa
                      ? "border-orange text-orange-ink"
                      : "text-ink-2 hover:text-ink border-transparent",
                  ),
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

// Navegação do módulo: só três abas (o resto fica dentro delas).
export function AbasCronometragem() {
  return <Barra abas={ABAS} rotuloAcessivel="Cronometragem" />;
}

// Dentro de "Equipamentos": decoders, transponders e karts.
export function SubAbasEquipamentos() {
  return <Barra abas={SUB_ABAS} rotuloAcessivel="Equipamentos" discreta />;
}
