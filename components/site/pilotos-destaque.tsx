"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CategoriaBadge } from "@/components/ui/categoria-badge";
import { formatCidadeUf, nomeExibicaoPiloto } from "@/lib/mock/data";
import type { Categoria, Piloto } from "@/lib/types";
import { useMockStore } from "@/lib/use-mock-store";

const LIMITE = 12;

// Pilotos na página inicial. Mostra só o que a página pública de pilotos já mostra (nome de
// exibição, número, categoria, foto, cidade) e leva ao perfil que já existe. No celular, os cartões
// correm na horizontal dentro da própria faixa (a página não ganha rolagem lateral).
export function PilotosDestaque({
  pilotos,
  categoriasIniciais,
}: {
  pilotos: Piloto[];
  categoriasIniciais: Categoria[];
}) {
  const [categorias] = useMockStore("gridlap:categorias", categoriasIniciais);

  if (pilotos.length === 0) {
    return (
      <div className="rounded-2xl border border-white/12 bg-black/20 p-8 text-center">
        <p className="text-ink text-base font-semibold">
          Nenhum piloto cadastrado ainda
        </p>
        <p className="text-ink-2 mt-1 text-sm">
          Os pilotos do campeonato aparecem aqui assim que se cadastrarem.
        </p>
        <Link
          href="/cadastro"
          className="text-orange-ink mt-3 inline-flex min-h-11 items-center text-sm font-medium hover:underline"
        >
          Quero me cadastrar como piloto →
        </Link>
      </div>
    );
  }

  const ordenados = [...pilotos]
    .sort(
      (a, b) =>
        a.posicaoCampeonato - b.posicaoCampeonato || a.numero - b.numero,
    )
    .slice(0, LIMITE);

  return (
    <ul
      aria-label="Pilotos do campeonato"
      className="-mx-6 flex snap-x snap-mandatory scroll-pl-6 gap-2.5 overflow-x-auto px-6 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-6"
    >
      {ordenados.map((p) => {
        const categoria = categorias.find((c) => c.id === p.categoriaId);
        const cidade = formatCidadeUf(p);
        return (
          <li
            key={p.id}
            className="w-[46%] shrink-0 snap-start sm:w-auto sm:shrink"
          >
            <Link
              href={`/pilotos/${p.slug}`}
              className="group block h-full rounded-xl focus-visible:outline-2"
            >
              <Card className="h-full overflow-hidden transition-transform duration-200 group-hover:-translate-y-0.5">
                <div className="bg-graphite flex items-center justify-between px-3 py-1.5">
                  <span className="font-display text-orange text-2xl leading-none font-bold">
                    {p.numero}
                  </span>
                  <span className="font-display text-[0.65rem] font-semibold tracking-[0.2em] text-white/70 uppercase">
                    Piloto
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                  <Avatar
                    nome={nomeExibicaoPiloto(p)}
                    avatarUrl={p.avatarUrl}
                    tamanho="md"
                  />
                  <div className="w-full min-w-0">
                    <p className="font-display text-ink truncate text-base leading-tight font-bold">
                      {nomeExibicaoPiloto(p)}
                    </p>
                    {categoria ? (
                      <span className="mt-0.5 inline-block">
                        <CategoriaBadge
                          nome={categoria.nome}
                          categoriaId={categoria.id}
                        />
                      </span>
                    ) : null}
                    {cidade ? (
                      <p className="text-ink-3 truncate text-xs">{cidade}</p>
                    ) : null}
                    <p className="text-orange-ink mt-0.5 text-xs font-medium group-hover:underline">
                      Ver perfil →
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
