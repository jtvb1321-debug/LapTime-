import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, toneParaStatus } from "@/components/ui/status-pill";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import {
  formatData,
  formatMoeda,
  getInscricaoById,
  getPilotoById,
  pagamentos,
} from "@/lib/mock/data";
import type { Pagamento } from "@/lib/types";

export const metadata: Metadata = { title: "Pagamentos" };

const colunas: Coluna<Pagamento>[] = [
  {
    header: "Piloto",
    cell: (p) =>
      getPilotoById(getInscricaoById(p.inscricaoId)?.pilotoId ?? "")?.nome,
  },
  {
    header: "Valor",
    cell: (p) => formatMoeda(p.valorCentavos),
    numerica: true,
  },
  { header: "Método", cell: (p) => p.metodo },
  { header: "Data", cell: (p) => formatData(p.criadaEm) },
  {
    header: "Status",
    cell: (p) => (
      <StatusPill tone={toneParaStatus(p.status)}>{p.status}</StatusPill>
    ),
  },
];

export default function AdminPagamentosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pagamentos"
        description="Pagamentos referentes às inscrições."
      />
      <DataTable colunas={colunas} linhas={pagamentos} chave={(p) => p.id} />
    </div>
  );
}
