import type { Metadata } from "next";
import Link from "next/link";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { PageHeader } from "@/components/ui/page-header";
import { lerBateriasDoCampeonato } from "@/lib/baterias-campeonato-store";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { lerPainel } from "@/lib/cronometragem/corridas-store";
import { formatDataEHora } from "@/lib/etapa-formato";
import { lerEtapasDoCampeonato } from "@/lib/etapas-store";
import { categorias } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Balizamento" };
export const dynamic = "force-dynamic";

// Grid de largada de cada bateria da etapa: na classificação, a ordem de entrada; na corrida, o grid
// definido pela melhor volta da classificação. Kart e sensor se ajustam na cronometragem.
export default async function AdminBalizamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string }>;
}) {
  await aplicarAjustesDeCategoria();
  const [{ etapa: pedida }, campeonato] = await Promise.all([
    searchParams,
    lerCampeonatoAtivo(),
  ]);
  if (!campeonato) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Balizamento" description="Grid de largada." />
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Não há campeonato ativo. Ative um em{" "}
          <Link
            href="/admin/campeonatos"
            className="text-orange-ink font-medium hover:underline"
          >
            Campeonatos
          </Link>
          .
        </p>
      </div>
    );
  }
  const [etapas, baterias] = await Promise.all([
    lerEtapasDoCampeonato(campeonato.id),
    lerBateriasDoCampeonato(campeonato.id),
  ]);
  const etapa =
    etapas.find((e) => e.id === pedida) ??
    etapas.find((e) => baterias.some((b) => b.etapaId === e.id)) ??
    etapas[0];
  const dela = etapa ? baterias.filter((b) => b.etapaId === etapa.id) : [];
  const grids = await Promise.all(
    dela.map(async (b) => {
      const corridaId = b.corridaId ?? b.classificacaoId;
      const painel = await lerPainel(corridaId);
      return { bateria: b, corridaId, painel };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Balizamento"
        description="Grid de largada de cada bateria da etapa."
      />
      {etapas.length > 1 ? (
        <nav aria-label="Etapas" className="flex flex-wrap gap-2">
          {etapas.map((e) => (
            <Link
              key={e.id}
              href={`/admin/balizamento?etapa=${e.id}`}
              aria-current={e.id === etapa?.id ? "page" : undefined}
              className={
                e.id === etapa?.id
                  ? "bg-orange text-on-orange flex min-h-11 items-center rounded-md px-3 text-sm font-medium md:min-h-9"
                  : "border-border-strong text-ink flex min-h-11 items-center rounded-md border px-3 text-sm md:min-h-9"
              }
            >
              {e.nome}
            </Link>
          ))}
        </nav>
      ) : null}
      {etapa ? (
        <p className="text-ink-2 text-sm">
          {etapa.nome} · {formatDataEHora(etapa)}
        </p>
      ) : null}

      {grids.length === 0 ? (
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Nenhuma bateria nesta etapa ainda. Crie as baterias em{" "}
          <Link
            href="/admin/baterias"
            className="text-orange-ink font-medium hover:underline"
          >
            Baterias
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {grids.map(({ bateria, corridaId, painel }) => {
            const nomeCategoria =
              categorias.find((c) => c.id === bateria.categoriaId)?.nome ??
              bateria.categoriaId;
            const ehCorrida = Boolean(bateria.corridaId);
            const grid = painel?.grid ?? [];
            return (
              <section
                key={bateria.id}
                className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">
                    <NomeCategoria
                      categoriaId={bateria.categoriaId}
                      className="inline-block rounded bg-[#0c1630] px-2 py-0.5"
                    >
                      {nomeCategoria}
                    </NomeCategoria>{" "}
                    <span className="text-ink-3 text-sm font-normal">
                      {ehCorrida
                        ? "Corrida: grid pela classificação"
                        : "Classificação: ordem de entrada"}
                    </span>
                  </h2>
                  <Link
                    href={`/admin/cronometragem/corridas/${corridaId}`}
                    className="text-orange-ink text-sm font-medium hover:underline"
                  >
                    Ajustar na cronometragem →
                  </Link>
                </div>
                {grid.length === 0 ? (
                  <p className="text-ink-2 text-sm">
                    Sem pilotos nesta bateria.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-1">
                    {grid.map((p, i) => (
                      <li
                        key={p.id}
                        className="border-border flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="font-display text-ink w-8 text-lg font-bold">
                          {p.posicaoGrid ?? i + 1}º
                        </span>
                        <span className="text-ink min-w-0 flex-1 truncate font-medium">
                          {p.nome}
                        </span>
                        <span className="text-ink-3 text-xs">
                          {p.kartNumero ? `Kart ${p.kartNumero}` : "sem kart"}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
