import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EtapasTable } from "@/components/admin/etapas-table";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { tracadosDoCampeonatoAtivo } from "@/lib/campeonatos-site";
import { etapas } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Etapas" };
export const dynamic = "force-dynamic";

export default async function AdminEtapasPage() {
  const [campeonato, tracados] = await Promise.all([
    lerCampeonatoAtivo(),
    tracadosDoCampeonatoAtivo(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Etapas" description="Etapas do campeonato atual." />
      <EtapasTable
        etapasIniciais={etapas}
        tracados={tracados}
        campeonatoId={campeonato?.id}
      />
    </div>
  );
}
