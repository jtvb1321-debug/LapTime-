import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { TracadosTable } from "@/components/admin/tracados-table";
import { tracados } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Traçados" };

export default function AdminTracadosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Traçados"
        description="Configurações de percurso do kartódromo. Cada etapa pode ser vinculada a um traçado."
      />
      <TracadosTable tracadosIniciais={tracados} />
    </div>
  );
}
