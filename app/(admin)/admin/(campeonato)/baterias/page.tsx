import { NomeCategoria } from "@/components/ui/nome-categoria";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, toneParaStatus } from "@/components/ui/status-pill";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { baterias, getCategoriaById } from "@/lib/mock/data";
import type { Bateria } from "@/lib/types";

export const metadata: Metadata = { title: "Baterias" };

const colunas: Coluna<Bateria>[] = [
  { header: "Horário", cell: (b) => b.horario },
  {
    header: "Categoria",
    cell: (b) => (
      <NomeCategoria categoriaId={b.categoriaId}>
        {getCategoriaById(b.categoriaId)?.nome}
      </NomeCategoria>
    ),
  },
  { header: "Bateria", cell: (b) => b.nome },
  { header: "Voltas", cell: (b) => b.voltas, numerica: true },
  {
    header: "Status",
    cell: (b) => (
      <StatusPill tone={toneParaStatus(b.status)}>
        {b.status.replace("_", " ")}
      </StatusPill>
    ),
  },
];

export default function AdminBateriasPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Baterias"
        description="Programação de baterias da etapa atual."
        actions={<Button variant="secondary">Nova bateria</Button>}
      />
      <DataTable colunas={colunas} linhas={baterias} chave={(b) => b.id} />
    </div>
  );
}
