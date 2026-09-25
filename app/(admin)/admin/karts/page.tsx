import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { KartsTable } from "@/components/admin/karts-table";
import { karts } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Karts" };

export default function AdminKartsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Karts"
        description="Frota de karts da etapa atual. Clique no status para marcar disponível, em uso ou em manutenção."
      />
      <KartsTable kartsIniciais={karts} />
    </div>
  );
}
