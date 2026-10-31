import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { CategoriaBadge } from "@/components/ui/categoria-badge";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { formatCidadeUf, getCategoriaById } from "@/lib/mock/data";
import { lerPilotos } from "@/lib/pilotos-store";
import type { Piloto } from "@/lib/types";

export const metadata: Metadata = { title: "Pilotos" };

const colunas: Coluna<Piloto>[] = [
  { header: "Nº", cell: (p) => p.numero, numerica: true },
  {
    header: "Nome",
    cell: (p) => (
      <span className="flex items-center gap-2.5">
        <Avatar nome={p.nome} avatarUrl={p.avatarUrl} tamanho="sm" />
        {p.nome}
      </span>
    ),
  },
  {
    header: "Categoria",
    cell: (p) => {
      const categoria = getCategoriaById(p.categoriaId);
      return categoria ? (
        <CategoriaBadge nome={categoria.nome} categoriaId={categoria.id} />
      ) : null;
    },
  },
  { header: "Cidade", cell: (p) => formatCidadeUf(p) ?? "—" },
  {
    header: "Pontos",
    cell: (p) => (
      <span className="text-orange-ink font-semibold">{p.pontos}</span>
    ),
    numerica: true,
  },
  { header: "Posição", cell: (p) => `${p.posicaoCampeonato}º`, numerica: true },
];

export default async function AdminPilotosPage() {
  const pilotos = await lerPilotos();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pilotos"
        description="Todos os pilotos cadastrados."
        actions={<Button variant="secondary">Novo piloto</Button>}
      />
      <DataTable colunas={colunas} linhas={pilotos} chave={(p) => p.id} />
    </div>
  );
}
