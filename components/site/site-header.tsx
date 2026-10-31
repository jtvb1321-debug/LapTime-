"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { pode } from "@/lib/permissoes";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/campeonato", label: "Campeonato" },
  { href: "/pilotos", label: "Pilotos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/horarios", label: "Horários" },
  { href: "/regulamento", label: "Regulamento" },
  { href: "/inscricao", label: "Inscrição" },
];

export function SiteHeader({ session }: { session: SessionUser | null }) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const ehAdminOuFiscal = session
    ? pode(session.papel, "painel.acessar")
    : false;
  const destinoConta = ehAdminOuFiscal ? "/admin" : "/area-do-piloto";

  return (
    <header className="bg-graphite border-orange border-b-2 text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          onClick={() => setMenuAberto(false)}
          className="block w-32 shrink-0 rounded bg-white p-0.5"
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
                    ? "bg-orange text-on-orange"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
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
            className="hover:border-orange hover:text-orange flex min-h-11 items-center rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white md:min-h-9"
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
            className="-mr-1 flex size-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white md:hidden"
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
        <nav className="flex flex-col gap-1 border-t border-white/15 px-4 py-3 md:hidden">
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
                    ? "bg-orange text-on-orange"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
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
