"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/campeonato", label: "Campeonato" },
  { href: "/pilotos", label: "Pilotos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/regulamento", label: "Regulamento" },
  { href: "/inscricao", label: "Inscrição" },
];

export function SiteHeader({ session }: { session: SessionUser | null }) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const ehAdminOuFiscal =
    session?.papel === "admin" || session?.papel === "fiscal";
  const destinoConta = ehAdminOuFiscal ? "/admin" : "/area-do-piloto";

  return (
    <header className="border-border bg-surface border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          onClick={() => setMenuAberto(false)}
          className="block w-32 shrink-0"
        >
          <Image
            src="/logo-gridlap.webp"
            alt="Grid Lap"
            width={2000}
            height={667}
            priority
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const ativo =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-orange/10 text-orange"
                    : "text-ink-2 hover:bg-ink/5 hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={destinoConta}
            className="border-border-strong text-ink hover:border-orange/50 hover:text-orange rounded-md border px-3 py-2 text-sm font-medium"
          >
            {session
              ? ehAdminOuFiscal
                ? "Painel admin"
                : "Área do piloto"
              : "Entrar"}
          </Link>

          <button
            type="button"
            onClick={() => setMenuAberto((aberto) => !aberto)}
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            className="text-ink-2 hover:text-ink hover:bg-ink/5 -mr-1 rounded-md p-1.5 md:hidden"
          >
            {menuAberto ? (
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-5 w-5"
                aria-hidden
              >
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-5 w-5"
                aria-hidden
              >
                <path
                  d="M3 5h14M3 10h14M3 15h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuAberto ? (
        <nav className="border-border flex flex-col gap-1 border-t px-4 py-3 md:hidden">
          {LINKS.map((link) => {
            const ativo =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuAberto(false)}
                className={clsx(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-orange/10 text-orange"
                    : "text-ink-2 hover:bg-ink/5 hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
