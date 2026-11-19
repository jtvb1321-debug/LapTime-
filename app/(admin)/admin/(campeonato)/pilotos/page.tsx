import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PilotosPorCategoria } from "@/components/admin/pilotos-por-categoria";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import { campeonatos, categorias } from "@/lib/mock/data";
import { lerPilotos } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Pilotos" };

export default async function AdminPilotosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  await aplicarAjustesDeCategoria();
  const [{ categoria }, pilotos] = await Promise.all([
    searchParams,
    lerPilotos(),
  ]);
  const fichas = categorias.map((c) => ({
    id: c.id,
    nome: c.nome,
    pilotos: pilotos.filter((p) => p.categoriaId === c.id).length,
  }));
  const selecionada = fichas.some((f) => f.id === categoria)
    ? (categoria ?? null)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pilotos"
        description="Escolha a categoria para ver os pilotos."
      />
      <PilotosPorCategoria
        categorias={fichas}
        pilotos={pilotos}
        selecionada={selecionada}
        campeonatosIniciais={campeonatos}
      />
    </div>
  );
}
