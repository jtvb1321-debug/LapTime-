import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CampeonatosTable } from "@/components/admin/campeonatos-table";
import { campeonatos, etapas } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Campeonatos" };

export default function AdminCampeonatosPage() {
  const etapasPorCampeonato = Object.fromEntries(
    campeonatos.map((c) => [
      c.id,
      etapas.filter((e) => e.campeonatoId === c.id).length,
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Campeonatos" description="Temporadas cadastradas." />
      <CampeonatosTable
        campeonatosIniciais={campeonatos}
        etapasPorCampeonato={etapasPorCampeonato}
      />
    </div>
  );
}
