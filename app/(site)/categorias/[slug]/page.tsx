import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { corSolidaCategoria } from "@/lib/categoria-cor";
import {
  categorias,
  formatCidadeUf,
  getPilotosPorCategoria,
} from "@/lib/mock/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categoria = categorias.find((c) => c.slug === slug);
  return { title: categoria?.nome ?? "Categoria" };
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categoria = categorias.find((c) => c.slug === slug);
  if (!categoria) notFound();

  const pilotos = getPilotosPorCategoria(categoria.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border overflow-hidden rounded-lg border pb-6">
        <div
          className={clsx("h-1.5 w-full", corSolidaCategoria(categoria.id))}
        />
        <div className="px-6 pt-5">
          <h1 className="text-ink text-2xl font-semibold">{categoria.nome}</h1>
          <p className="text-ink-2 mt-1 text-sm">{categoria.descricao}</p>
          <p className="text-ink-3 mt-1 text-xs">
            Peso mínimo: {categoria.pesoMinimoKg} kg
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pilotos.map((piloto) => (
          <Link key={piloto.id} href={`/pilotos/${piloto.slug}`}>
            <Card className="hover:border-orange/40 h-full transition-colors">
              <CardBody className="flex items-center gap-3">
                <Avatar nome={piloto.nome} avatarUrl={piloto.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate font-medium">{piloto.nome}</p>
                  <p className="text-ink-3 font-mono text-xs">
                    #{piloto.numero} · {piloto.posicaoCampeonato}º lugar
                  </p>
                  {formatCidadeUf(piloto) ? (
                    <p className="text-ink-2 text-xs">
                      {formatCidadeUf(piloto)}
                    </p>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
