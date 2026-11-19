import { AvisoEmDesenvolvimento } from "@/components/admin/aviso-em-desenvolvimento";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  baterias,
  formatData,
  getCategoriaById,
  getPilotoById,
  punicoes,
} from "@/lib/mock/data";
import type { Punicao } from "@/lib/types";

export const metadata: Metadata = { title: "Punições" };

const colunas: Coluna<Punicao>[] = [
  { header: "Piloto", cell: (p) => getPilotoById(p.pilotoId)?.nome },
  {
    header: "Bateria",
    cell: (p) => {
      const bateria = baterias.find((b) => b.id === p.bateriaId);
      return `${getCategoriaById(bateria?.categoriaId ?? "")?.nome} — ${bateria?.nome}`;
    },
  },
  { header: "Tipo", cell: (p) => p.tipo.replace("_", " ") },
  { header: "Motivo", cell: (p) => p.motivo },
  { header: "Data", cell: (p) => formatData(p.aplicadaEm) },
];

export default function AdminPunicoesPage() {
  return (
    <div className="flex flex-col gap-6">
      <AvisoEmDesenvolvimento />
      <PageHeader
        title="Punições"
        description="Punições aplicadas pela fiscalização de prova."
        actions={<Button variant="secondary">Nova punição</Button>}
      />
      <DataTable colunas={colunas} linhas={punicoes} chave={(p) => p.id} />
    </div>
  );
}
