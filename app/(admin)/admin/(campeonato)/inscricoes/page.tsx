import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, toneParaStatus } from "@/components/ui/status-pill";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import {
  etapas,
  formatData,
  getCategoriaById,
  getPilotoById,
  inscricoes,
} from "@/lib/mock/data";
import type { Inscricao } from "@/lib/types";

export const metadata: Metadata = { title: "Inscrições" };

const colunas: Coluna<Inscricao>[] = [
  { header: "Piloto", cell: (i) => getPilotoById(i.pilotoId)?.nome },
  { header: "Categoria", cell: (i) => getCategoriaById(i.categoriaId)?.nome },
  {
    header: "Etapa",
    cell: (i) => etapas.find((e) => e.id === i.etapaId)?.nome,
  },
  { header: "Criada em", cell: (i) => formatData(i.criadaEm) },
  {
    header: "Status",
    cell: (i) => (
      <StatusPill tone={toneParaStatus(i.status)}>{i.status}</StatusPill>
    ),
  },
];

export default function AdminInscricoesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inscrições"
        description="Inscrições recebidas para as próximas etapas."
      />
      <DataTable colunas={colunas} linhas={inscricoes} chave={(i) => i.id} />
    </div>
  );
}
