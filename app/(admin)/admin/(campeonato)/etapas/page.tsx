import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EtapasTable } from "@/components/admin/etapas-table";
import { campeonato, etapas, tracados } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Etapas" };

export default function AdminEtapasPage() {
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
