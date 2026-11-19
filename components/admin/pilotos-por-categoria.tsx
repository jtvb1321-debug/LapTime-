"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { BandeiraUf } from "@/components/ui/bandeira-uf";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { corSolidaCategoria } from "@/lib/categoria-cor";
import type { Campeonato, Piloto } from "@/lib/types";
import { useMockStore } from "@/lib/use-mock-store";

export interface FichaDeCategoria {
  id: string;
  nome: string;
  pilotos: number;
}

// Pilotos do painel: primeiro escolhe-se a categoria (fichas coloridas com a quantidade de pilotos),
// só então a lista aparece. Pontos e posição só existem com campeonato ativo — o mesmo cadastro
// ("ativo") da tela Campeonatos —, então sem campeonato ativo as duas colunas nem aparecem.
export function PilotosPorCategoria({
  categorias,
  pilotos,
  selecionada,
  campeonatosIniciais,
}: {
  categorias: FichaDeCategoria[];
  pilotos: Piloto[];
  selecionada: string | null;
  campeonatosIniciais: Campeonato[];
}) {
  const [campeonatos] = useMockStore(
    "gridlap:campeonatos",
    campeonatosIniciais,
  );
  const campeonatoAtivo = campeonatos.some((c) => c.ativo);
  const categoria = categorias.find((c) => c.id === selecionada);
  const lista = categoria
    ? pilotos
        .filter((p) => p.categoriaId === categoria.id)
        .sort((a, b) => a.numero - b.numero)
    : [];

  const colunas: Coluna<Piloto>[] = [
    { header: "Nº", cell: (p) => p.numero, numerica: true },
    {
      header: "Nome",
      cell: (p) => (
        <span className="flex items-center gap-2.5">
          <Avatar nome={p.nome} avatarUrl={p.avatarUrl} tamanho="sm" />
          {p.nome}
        </span>
      ),
    },
    {
      header: "Estado",
      cell: (p) =>
        p.uf ? (
          <span className="inline-flex items-center gap-2">
            <BandeiraUf uf={p.uf} className="size-5" />
            {p.uf}
          </span>
        ) : (
          "—"
        ),
    },
    { header: "Cidade", cell: (p) => p.cidade || "—" },
    ...(campeonatoAtivo
      ? ([
          {
            header: "Pontos",
            cell: (p) => (
              <span className="text-orange-ink font-semibold">{p.pontos}</span>
            ),
            numerica: true,
          },
          {
            header: "Posição",
            cell: (p) => `${p.posicaoCampeonato}º`,
            numerica: true,
          },
        ] satisfies Coluna<Piloto>[])
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Categorias">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categorias.map((c) => {
            const ativa = c.id === selecionada;
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/pilotos?categoria=${c.id}`}
                  aria-current={ativa ? "page" : undefined}
                  scroll={false}
                  className={`border-border bg-surface hover:border-border-strong flex h-full flex-col overflow-hidden rounded-xl border transition-colors focus-visible:outline-2 ${
                    ativa ? "ring-2 ring-[#4cc9ff]/70" : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-full ${corSolidaCategoria(c.id)}`}
                  />
                  <span className="flex flex-col gap-0.5 px-3 py-3">
                    <span className="font-display text-sm leading-tight font-bold">
                      <NomeCategoria
                        categoriaId={c.id}
                        className="inline-block rounded-md bg-[#0c1630] px-2 py-0.5"
                      >
                        {c.nome}
                      </NomeCategoria>
                    </span>
                    <span className="text-ink-2 text-xs">
                      {c.pilotos === 1 ? "1 piloto" : `${c.pilotos} pilotos`}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {categoria ? (
        <section
          aria-labelledby="pilotos-da-categoria"
          className="flex flex-col gap-3"
        >
          <h2
            id="pilotos-da-categoria"
            className="font-display text-base font-bold"
          >
            Pilotos da categoria{" "}
            <NomeCategoria categoriaId={categoria.id}>
              {categoria.nome}
            </NomeCategoria>
          </h2>
          <DataTable
            colunas={colunas}
            linhas={lista}
            chave={(p) => p.id}
            vazio="Nenhum piloto nesta categoria ainda."
            rotulo={`Pilotos da categoria ${categoria.nome}`}
          />
          {!campeonatoAtivo ? (
            <p className="text-ink-3 text-xs">
              Pontos e posição aparecem quando houver um campeonato ativo.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Escolha uma categoria acima para ver os pilotos.
        </p>
      )}
    </div>
  );
}
