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
  {
    href: `${BASE}/pista`,
    rotulo: "Pista",
    ativa: (c) => c.startsWith(`${BASE}/pista`),
  },
  {
    href: `${BASE}/termos`,
    rotulo: "Termos",
    ativa: (c) => c.startsWith(`${BASE}/termos`),
  },
  { href: BASE, rotulo: "Ao vivo", ativa: (c) => c === BASE },
  {
    href: `${BASE}/corridas`,
    rotulo: "Baterias",
    ativa: (c) => c.startsWith(`${BASE}/corridas`),
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

// Navegação do módulo: a Pista (decoder, sensores, abrir bateria) e as baterias.
export function AbasCronometragem() {
  return <Barra abas={ABAS} rotuloAcessivel="Cronometragem" />;
}
