import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { categorias, getPilotosPorCategoria } from "@/lib/mock/data";
import type { Categoria } from "@/lib/types";

export const metadata: Metadata = { title: "Categorias" };

const colunas: Coluna<Categoria>[] = [
  { header: "Nome", cell: (c) => c.nome },
  { header: "Nível", cell: (c) => c.nivel },
  {
    header: "Peso mínimo (kg)",
    cell: (c) => (c.pesoMinimoKg > 0 ? c.pesoMinimoKg : "—"),
    numerica: true,
  },
  {
    header: "Pilotos",
    cell: (c) => getPilotosPorCategoria(c.id).length,
    numerica: true,
  },
];

export default function AdminCategoriasPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categorias"
        description="Categorias do campeonato."
        actions={<Button variant="secondary">Nova categoria</Button>}
      />
      <DataTable colunas={colunas} linhas={categorias} chave={(c) => c.id} />
    </div>
  );
}
