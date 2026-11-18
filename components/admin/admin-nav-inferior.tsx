"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconeDoMenu } from "@/components/admin/icones-menu";
import { menuParaPapel, type AdminNavItem } from "@/lib/admin-nav";
import { hrefAtivo, todosOsItens } from "@/lib/nav-inferior";
import type { PapelUsuario } from "@/lib/types";

// Itens do grupo agrupados por seção (ex.: Campeonato > Estrutura), na ordem de sempre.
function porSecao(itens: AdminNavItem[]) {
  const secoes: { nome: string | null; itens: AdminNavItem[] }[] = [];
  for (const item of itens) {
    const nome = item.secao ?? null;
    const atual = secoes.find((s) => s.nome === nome);
    if (atual) atual.itens.push(item);
    else secoes.push({ nome, itens: [item] });
  }
  return secoes;
}

const COLUNAS: Record<number, string> = {
  1: "md:w-60 md:columns-1",
  2: "md:w-[28rem] md:columns-2",
  3: "md:w-[40rem] md:columns-3",
};

type Entrada =
  | { tipo: "link"; item: AdminNavItem }
  | { tipo: "grupo"; titulo: string; itens: AdminNavItem[] };

// Navegação inferior do painel, numa linha só: os acessos do dia (Visão do dia, Agenda, Clientes,
// Pista e baterias) são links diretos e cada grupo do menu (Campeonato, Financeiro, Relatórios,
// Configurações...) abre uma lista para cima com os módulos dele. As rotas, os nomes e as
// permissões vêm de lib/admin-nav.ts e não mudam.
export function AdminNavInferior({ papel }: { papel: PapelUsuario }) {
  const pathname = usePathname();
  const grupos = menuParaPapel(papel);
  const ativoHref = hrefAtivo(pathname, todosOsItens(grupos));
  const [aberto, setAberto] = useState<string | null>(null);
  const [foco, setFoco] = useState<number | null>(null);
  const raiz = useRef<HTMLElement>(null);

  const entradas: Entrada[] = grupos.flatMap((g): Entrada[] =>
    g.fixo
      ? g.itens.map((item) => ({ tipo: "link", item }))
      : [{ tipo: "grupo", titulo: g.titulo, itens: g.itens }],
  );

  // Fecha ao escolher um módulo, ao clicar fora e com Esc (devolvendo o foco ao botão do grupo).
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(null);
      raiz.current
        ?.querySelector<HTMLElement>(`[data-grupo="${aberto}"]`)
        ?.focus();
    };
    document.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  // Efeito "dock magnético": o item sob o cursor cresce e os vizinhos se afastam um pouco.
  const deslocamento = (i: number) => {
    if (foco === null) return 0;
    const d = i - foco;
    return Math.abs(d) > 2 || d === 0 ? 0 : d * 10;
  };

  const classeDoItem =
    "relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-[11px] leading-tight font-medium whitespace-nowrap text-white/75 transition-colors hover:text-white md:min-h-12 md:w-auto md:flex-row md:gap-2 md:px-4 md:text-sm motion-reduce:transition-none " +
    "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-orange after:transition-transform after:duration-200 motion-reduce:after:transition-none " +
    "aria-[current=page]:text-orange aria-[current=page]:after:scale-x-100 aria-expanded:text-white";
  const classeMagnetica =
    "transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transform-none motion-reduce:transition-none";

  return (
    <nav
      ref={raiz}
      aria-label="Navegação principal do painel"
      className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[#050a14] via-[#050a14] via-60% to-transparent pt-8 print:hidden"
    >
      <ul className="mx-auto flex max-w-full [scrollbar-width:none] items-stretch justify-start gap-1 overflow-x-auto px-2 pb-[env(safe-area-inset-bottom)] md:justify-center md:overflow-visible md:px-3 md:pb-2 [&::-webkit-scrollbar]:hidden">
        {entradas.map((e, i) => {
          const rotulo = e.tipo === "link" ? e.item.label : e.titulo;
          const iconeHref =
            e.tipo === "link" ? e.item.href : (e.itens[0]?.href ?? "");
          const ativo =
            e.tipo === "link"
              ? e.item.href === ativoHref
              : e.itens.some((it) => it.href === ativoHref);
          const icone = (
            <span
              className={`inline-flex ${classeMagnetica} ${
                foco === i ? "-translate-y-1 scale-125" : ""
              }`}
            >
              <IconeDoMenu href={iconeHref} label={rotulo} className="size-6" />
            </span>
          );
          const secoes = e.tipo === "grupo" ? porSecao(e.itens) : [];
          const colunas = Math.min(3, Math.max(1, secoes.length));
          return (
            <li
              key={rotulo}
              className="relative shrink-0 md:static"
              onMouseEnter={() => setFoco(i)}
              onMouseLeave={() => setFoco(null)}
            >
              <div
                className={classeMagnetica}
                style={{ transform: `translateX(${deslocamento(i)}px)` }}
              >
                {e.tipo === "link" ? (
                  <Link
                    href={e.item.href}
                    aria-current={ativo ? "page" : undefined}
                    className={classeDoItem}
                  >
                    {icone}
                    <span>{rotulo}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    data-grupo={e.titulo}
                    aria-haspopup="true"
                    aria-expanded={aberto === e.titulo}
                    aria-current={ativo ? "page" : undefined}
                    onClick={() =>
                      setAberto((v) => (v === e.titulo ? null : e.titulo))
                    }
                    className={classeDoItem}
                  >
                    {icone}
                    <span>{rotulo}</span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 12 12"
                      className={`hidden size-3 transition-transform md:block ${
                        aberto === e.titulo ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    >
                      <path d="M2.5 7.5 6 4l3.5 3.5" />
                    </svg>
                  </button>
                )}
              </div>
              {e.tipo === "grupo" && aberto === e.titulo ? (
                <div
                  role="group"
                  aria-label={e.titulo}
                  className={`fixed inset-x-2 bottom-[calc(var(--nav-inferior)+0.25rem)] z-50 max-h-[min(70dvh,32rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1630] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)] md:absolute md:inset-x-auto md:bottom-[calc(var(--nav-inferior)-1rem)] md:max-w-[92vw] md:[column-gap:1.25rem] md:p-4 ${COLUNAS[colunas]} ${i >= entradas.length - 3 ? "md:right-4 md:left-auto" : ""}`}
                >
                  {secoes.map((s) => (
                    <div
                      key={s.nome ?? "_"}
                      className="mb-3 break-inside-avoid last:mb-0"
                    >
                      {s.nome ? (
                        <p className="font-display mb-1 px-2 text-xs font-semibold tracking-[0.14em] text-white/50 uppercase">
                          {s.nome}
                        </p>
                      ) : null}
                      <ul className="flex flex-col gap-0.5">
                        {s.itens.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              aria-current={
                                item.href === ativoHref ? "page" : undefined
                              }
                              onClick={() => setAberto(null)}
                              className="aria-[current=page]:text-orange flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm text-white/80 hover:bg-white/10 hover:text-white md:min-h-9"
                            >
                              <IconeDoMenu
                                href={item.href}
                                label={item.label}
                                className="size-5 shrink-0"
                              />
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
