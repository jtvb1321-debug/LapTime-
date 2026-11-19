import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { TracadosTable } from "@/components/admin/tracados-table";
import { getSession } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { lerTracados } from "@/lib/tracados-store";

export const metadata: Metadata = { title: "Traçados" };
export const dynamic = "force-dynamic";

export default async function AdminTracadosPage() {
  const [tracados, sessao] = await Promise.all([lerTracados(), getSession()]);
  const podeEditar = Boolean(
    sessao && pode(sessao.papel, "cadastro.gerenciar"),
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Traçados"
        description="Biblioteca de traçados desenhados sobre o asfalto do kartódromo. Cada campeonato escolhe os que usa (no mínimo 2)."
      />
      <TracadosTable tracados={tracados} podeEditar={podeEditar} />
    </div>
  );
}
