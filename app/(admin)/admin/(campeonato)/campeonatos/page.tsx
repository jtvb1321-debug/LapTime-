import type { Metadata } from "next";
import Link from "next/link";
import { NovoCampeonatoForm } from "@/components/admin/campeonato-passos";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { getSession } from "@/lib/auth";
import {
  lerCampeonatos,
  MINIMO_DE_LOGOS,
  MINIMO_DE_TRACADOS,
  prontidaoDe,
} from "@/lib/campeonatos-store";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Campeonatos" };
export const dynamic = "force-dynamic";

const ROTULO = {
  ativo: "ativo",
  encerrado: "encerrado",
  rascunho: "em preparo",
};
const TOM = {
  ativo: "success",
  encerrado: "neutral",
  rascunho: "warning",
} as const;

export default async function AdminCampeonatosPage() {
  const [campeonatos, sessao] = await Promise.all([
    lerCampeonatos(),
    getSession(),
  ]);
  const podeEditar = Boolean(
    sessao && pode(sessao.papel, "cadastro.gerenciar"),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campeonatos"
        description="Crie o campeonato, envie a imagem, escolha os traçados e os logos dos patrocinadores. Com tudo pronto, ative: ele passa a aparecer no site."
      />

      {podeEditar ? (
        <section
          aria-labelledby="novo-titulo"
          className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
        >
          <h2 id="novo-titulo" className="text-ink text-base font-semibold">
            Novo campeonato
          </h2>
          <NovoCampeonatoForm />
        </section>
      ) : null}

      {campeonatos.length === 0 ? (
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Nenhum campeonato ainda. Crie o primeiro acima.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {campeonatos.map((c) => {
            const p = prontidaoDe(c);
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/campeonatos/${c.id}`}
                  className="border-border bg-surface hover:border-border-strong flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors focus-visible:outline-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-ink truncate text-lg font-bold">
                        {c.nome}
                      </h2>
                      <p className="text-ink-3 text-xs">
                        Temporada {c.temporada}
                      </p>
                    </div>
                    <StatusPill tone={TOM[c.status]}>
                      {ROTULO[c.status]}
                    </StatusPill>
                  </div>
                  <ul className="text-ink-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <li className={p.imagem ? "text-success" : ""}>
                      {p.imagem ? "✓" : "○"} Imagem
                    </li>
                    <li className={p.categorias ? "text-success" : ""}>
                      {p.categorias ? "✓" : "○"} Categorias{" "}
                      {c.categoriaIds.length}
                    </li>
                    <li className={p.tracados ? "text-success" : ""}>
                      {p.tracados ? "✓" : "○"} Traçados {c.tracadoIds.length}/
                      {MINIMO_DE_TRACADOS}
                    </li>
                    <li className={p.logos ? "text-success" : ""}>
                      {p.logos ? "✓" : "○"} Logos {c.logos.length}/
                      {MINIMO_DE_LOGOS}
                    </li>
                  </ul>
                  <span className="text-orange-ink text-sm font-medium">
                    {c.status === "rascunho" ? "Continuar →" : "Abrir →"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
