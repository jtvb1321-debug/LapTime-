"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CategoriaBadge } from "@/components/ui/categoria-badge";
import { formatCidadeUf, nomeExibicaoPiloto } from "@/lib/mock/data";
import type { Categoria, Piloto } from "@/lib/types";
import { useMockStore } from "@/lib/use-mock-store";

const LIMITE = 20;

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

  // Cada piloto aparece duas vezes na faixa; a 2ª cópia é só para o laço contínuo (aria-hidden).
  const cartao = (p: Piloto, copia: boolean) => {
    const categoria = categorias.find((c) => c.id === p.categoriaId);
    return (
      <li
        key={`${copia ? "c" : "o"}-${p.id}`}
        aria-hidden={copia || undefined}
        className={copia ? "gl-marquee-copia w-36 shrink-0" : "w-36 shrink-0"}
      >
        <Link
          href={`/pilotos/${p.slug}`}
          tabIndex={copia ? -1 : undefined}
          className="group block rounded-lg focus-visible:outline-2"
        >
          <Card className="overflow-hidden transition-transform duration-200 group-hover:-translate-y-0.5">
            <div className="bg-graphite flex items-center justify-between px-2.5 py-1">
              <span className="font-display text-orange text-lg leading-none font-bold">
                {p.numero}
              </span>
              <span className="font-display text-[0.6rem] font-semibold tracking-[0.18em] text-white/70 uppercase">
                Piloto
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 px-2 py-2.5 text-center">
              <Avatar
                nome={nomeExibicaoPiloto(p)}
                avatarUrl={p.avatarUrl}
                tamanho="sm"
              />
              <p className="font-display text-ink w-full truncate text-sm leading-tight font-bold">
                {nomeExibicaoPiloto(p)}
              </p>
              {categoria ? (
                <CategoriaBadge
                  nome={categoria.nome}
                  categoriaId={categoria.id}
                />
              ) : null}
            </div>
          </Card>
        </Link>
      </li>
    );
  };

  return (
    <div className="gl-marquee overflow-hidden py-1">
      <ul
        aria-label="Pilotos do campeonato"
        className="gl-marquee-faixa"
        style={{
          ["--duracao" as string]: `${Math.max(20, ordenados.length * 4)}s`,
        }}
      >
        {ordenados.map((p) => cartao(p, false))}
        {ordenados.map((p) => cartao(p, true))}
      </ul>
    </div>
  );
}
