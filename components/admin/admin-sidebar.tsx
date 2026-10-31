"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import { menuParaPapel, type AdminNavItem } from "@/lib/admin-nav";
import type { PapelUsuario } from "@/lib/types";

// Dos itens do menu que casam com o endereço atual, só o mais específico fica
// aceso (ex.: em Cronometragem → Equipamentos, não acende "Cronometragem").
function hrefAtivo(pathname: string, hrefs: string[]): string | null {
  const casam = hrefs.filter((h) =>
    h === "/admin" ? pathname === "/admin" : pathname.startsWith(h),
  );
  return casam.sort((a, b) => b.length - a.length)[0] ?? null;
}

function Chevron({ aberto }: { aberto: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={clsx(
        "size-3.5 shrink-0 transition-transform",
        aberto && "rotate-90",
      )}
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Menu lateral compacto: atalhos diretos no topo e os demais grupos recolhidos
// (só o grupo da página atual abre sozinho; o resto abre com um clique).
export function AdminSidebar({
  papel,
  onNavigate,
}: {
  papel: PapelUsuario;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Grupos que a pessoa abriu ou fechou à mão (vale enquanto o menu estiver na tela).
  const [manual, setManual] = useState<Record<string, boolean>>({});

  const grupos = menuParaPapel(papel);
  const ativoHref = hrefAtivo(
    pathname,
    grupos.flatMap((g) => g.itens.map((i) => i.href)),
  );

  const classeDoItem = (ativo: boolean) =>
    clsx(
      "flex min-h-11 items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors lg:min-h-9",
      ativo
        ? "bg-orange text-on-orange"
        : "text-white/80 hover:bg-white/10 hover:text-white",
    );

  // Itens de um grupo, com subtítulos quando o grupo é dividido em seções.
  const listaDeItens = (itens: AdminNavItem[]) => {
    let secaoAtual: string | undefined;
    return itens.map((item) => {
      const novaSecao = item.secao !== secaoAtual ? item.secao : undefined;
      secaoAtual = item.secao;
      return (
        <div key={item.href} className="flex flex-col">
          {novaSecao ? (
            <p className="mt-2 mb-0.5 px-2.5 text-[11px] font-semibold tracking-wide text-white/50 uppercase">
              {novaSecao}
            </p>
          ) : null}
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={item.href === ativoHref ? "page" : undefined}
            className={classeDoItem(item.href === ativoHref)}
          >
            {item.label}
          </Link>
        </div>
      );
    });
  };

  return (
    <nav
      aria-label="Menu do admin"
      className="bg-graphite flex h-full w-64 shrink-0 flex-col gap-1 overflow-y-auto px-3 py-5 text-white"
    >
      <Link href="/admin/balcao" className="mb-4 flex items-center gap-2 px-1">
        <Image
          src="/logo-gridlap.webp"
          alt="Grid Lap"
          width={2000}
          height={667}
          className="h-8 w-auto rounded bg-white p-0.5"
          priority
        />
        <span className="text-sm text-white/60">painel</span>
      </Link>

      {grupos.map((grupo) => {
        const ativo = grupo.itens.some((i) => i.href === ativoHref);

        // Itens fixos (dia a dia) e grupos de um item só: links soltos.
        if (grupo.fixo || grupo.itens.length === 1) {
          return (
            <div key={grupo.titulo} className="flex flex-col gap-0.5">
              {listaDeItens(grupo.itens)}
            </div>
          );
        }

        const aberto = manual[grupo.titulo] ?? ativo;
        const idLista = `menu-${grupo.titulo.replace(/\W+/g, "-").toLowerCase()}`;
        return (
          <div key={grupo.titulo} className="mt-1 flex flex-col">
            <button
              type="button"
              aria-expanded={aberto}
              aria-controls={idLista}
              onClick={() =>
                setManual((atual) => ({
                  ...atual,
                  [grupo.titulo]: !(atual[grupo.titulo] ?? ativo),
                }))
              }
              className={clsx(
                "flex min-h-11 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-semibold tracking-wide uppercase transition-colors lg:min-h-9",
                ativo ? "text-orange" : "text-white/60 hover:text-white",
              )}
            >
              <span>{grupo.titulo}</span>
              <Chevron aberto={aberto} />
            </button>
            {aberto ? (
              <div id={idLista} className="flex flex-col gap-0.5 pl-1">
                {listaDeItens(grupo.itens)}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
