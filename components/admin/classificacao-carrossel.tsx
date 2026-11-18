"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/avatar";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { corBadgeCategoria } from "@/lib/categoria-cor";
import type { Categoria, Piloto } from "@/lib/types";

interface Grupo {
  categoria: Categoria;
  pilotos: Piloto[];
}

// Alterna sozinho entre as categorias a cada poucos segundos, como um
// carrossel — o clique numa aba também troca na hora e reinicia a contagem.
const INTERVALO_MS = 5000;

export function ClassificacaoCarrossel({ grupos }: { grupos: Grupo[] }) {
  const [ativo, setAtivo] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setAtivo((i) => (i + 1) % grupos.length);
    }, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [grupos.length]);

  const grupo = grupos[ativo];
  if (!grupo) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {grupos.map((g, i) => (
          <button
            key={g.categoria.id}
            type="button"
            onClick={() => setAtivo(i)}
            className={clsx(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              i === ativo
                ? corBadgeCategoria(g.categoria.id)
                : "bg-ink/5 text-ink-3 hover:bg-ink/10",
            )}
          >
            {g.categoria.nome}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {grupo.pilotos.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2.5">
              <PosicaoBadge posicao={p.posicaoCampeonato} />
              <Avatar nome={p.nome} avatarUrl={p.avatarUrl} tamanho="sm" />
              {p.nome}
            </span>
            <span className="text-orange-ink font-display text-lg font-bold">
              {p.pontos}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
