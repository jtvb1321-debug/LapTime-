import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { PatrocinadoresTable } from "@/components/admin/patrocinadores-table";
import { patrocinadores } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Patrocinadores" };

export default function AdminPatrocinadoresPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patrocinadores"
        description="Marcas exibidas nos overlays de transmissão (ticker e grid de largada)."
      />
      <PatrocinadoresTable patrocinadoresIniciais={patrocinadores} />
    </div>
  );
}
