import { NomeCategoria } from "@/components/ui/nome-categoria";
import type { Metadata } from "next";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { corSolidaCategoria } from "@/lib/categoria-cor";
import {
  categorias,
  formatCidadeUf,
  getPilotosPorCategoria,
  nomeExibicaoPiloto,
} from "@/lib/mock/data";
import type { Piloto } from "@/lib/types";

export const metadata: Metadata = { title: "Classificação" };

// Sobrenome em negrito e o resto do nome em peso normal — mesmo destaque
// usado nas listas de pilotos da F1.
function NomePiloto({ nome }: { nome: string }) {
  const partes = nome.trim().split(/\s+/);
  const sobrenome = partes.pop();
  const primeiroNome = partes.join(" ");
  return (
    <span>
      {primeiroNome ? `${primeiroNome} ` : ""}
      <span className="font-bold">{sobrenome}</span>
    </span>
  );
}

const colunas: Coluna<Piloto>[] = [
  {
    header: "Pos.",
    cell: (p) => <PosicaoBadge posicao={p.posicaoCampeonato} />,
  },
  {
    header: "Piloto",
    cell: (p) => (
      <span className="flex items-center gap-2.5">
        <Avatar nome={p.nome} avatarUrl={p.avatarUrl} tamanho="sm" />
        <NomePiloto nome={nomeExibicaoPiloto(p)} />
      </span>
    ),
  },
  { header: "Cidade", cell: (p) => formatCidadeUf(p) ?? "—" },
  { header: "Vitórias", cell: (p) => p.vitorias, numerica: true },
  { header: "Pódios", cell: (p) => p.podios, numerica: true },
  {
    header: "Pontos",
    cell: (p) => (
      <span className="text-orange-ink font-semibold">{p.pontos}</span>
    ),
    numerica: true,
  },
];

export default function ClassificacaoPage() {
  if (categorias.length === 0) {
    return (
      <p className="text-ink-2 text-sm">Nenhuma categoria cadastrada ainda.</p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {categorias.map((categoria) => (
        <section key={categoria.id} className="flex flex-col gap-3">
          <h2 className="text-ink flex items-center gap-2 text-base font-semibold">
            <span
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                corSolidaCategoria(categoria.id),
              )}
            />
            <NomeCategoria categoriaId={categoria.id}>
              {categoria.nome}
            </NomeCategoria>
          </h2>
          <DataTable
            colunas={colunas}
            linhas={getPilotosPorCategoria(categoria.id)}
            chave={(p) => p.id}
          />
        </section>
      ))}
    </div>
  );
}
