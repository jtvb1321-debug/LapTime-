import { NomeCategoria } from "@/components/ui/nome-categoria";
import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { Card, CardBody } from "@/components/ui/card";
import { corSolidaCategoria } from "@/lib/categoria-cor";
import { categorias, getPilotosPorCategoria } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriasPage() {
  if (categorias.length === 0) {
    return (
      <p className="text-ink-2 text-sm">Nenhuma categoria cadastrada ainda.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {categorias.map((categoria) => (
        <Link key={categoria.id} href={`/categorias/${categoria.slug}`}>
          <Card className="hover:border-orange/40 h-full overflow-hidden transition-colors">
            <div
              className={clsx("h-1.5 w-full", corSolidaCategoria(categoria.id))}
            />
            <CardBody className="flex flex-col gap-2">
              <h2 className="text-ink text-base font-semibold">
                <NomeCategoria categoriaId={categoria.id}>
                  {categoria.nome}
                </NomeCategoria>
              </h2>
              <p className="text-ink-2 text-sm">{categoria.descricao}</p>
              <p className="text-ink-3 mt-2 text-xs">
                {categoria.pesoMinimoKg > 0
                  ? `Peso mínimo: ${categoria.pesoMinimoKg} kg · `
                  : ""}
                {getPilotosPorCategoria(categoria.id).length} pilotos
              </p>
            </CardBody>
          </Card>
        </Link>
      ))}
    </div>
  );
}
