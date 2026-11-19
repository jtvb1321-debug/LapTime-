import { Avatar } from "@/components/ui/avatar";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { nomeExibicaoPiloto } from "@/lib/mock/data";
import type { ClassificacaoDoPiloto } from "@/lib/pontuacao-campeonato";
import type { Piloto } from "@/lib/types";

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

// Classificação do campeonato por categoria: pontos, vitórias, pódios e os pontos de cada etapa.
export function ClassificacaoCampeonato({
  classificacao,
  pilotos,
  categorias,
  etapas,
}: {
  classificacao: ClassificacaoDoPiloto[];
  pilotos: Piloto[];
  categorias: { id: string; nome: string }[];
  etapas: { id: string; numero: number; nome: string }[];
}) {
  const grupos = categorias
    .map((c) => ({
      categoria: c,
      linhas: classificacao
        .filter((x) => x.categoriaId === c.id)
        .sort((a, b) => a.posicao - b.posicao),
    }))
    .filter((g) => g.linhas.length > 0);

  if (grupos.length === 0) {
    return (
      <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
        A classificação aparece assim que houver pilotos no campeonato.
      </p>
    );
  }

  const colunas: Coluna<ClassificacaoDoPiloto>[] = [
    {
      header: "Pos.",
      cell: (l) => <PosicaoBadge posicao={l.posicao} />,
    },
    {
      header: "Piloto",
      cell: (l) => {
        const p = pilotos.find((x) => x.id === l.pilotoId);
        return (
          <span className="flex items-center gap-2.5">
            <Avatar
              nome={p ? nomeExibicaoPiloto(p) : "?"}
              avatarUrl={p?.avatarUrl}
              tamanho="sm"
            />
            <span>
              {p ? <NomePiloto nome={nomeExibicaoPiloto(p)} /> : "—"}
              {p ? (
                <span className="text-ink-3 ml-1.5 text-xs">#{p.numero}</span>
              ) : null}
            </span>
          </span>
        );
      },
    },
    ...etapas.map((e): Coluna<ClassificacaoDoPiloto> => ({
      header: `E${e.numero}`,
      cell: (l) => l.porEtapa[e.id] ?? "—",
      numerica: true,
    })),
    { header: "Vit.", cell: (l) => l.vitorias, numerica: true },
    { header: "Pód.", cell: (l) => l.podios, numerica: true },
    {
      header: "Pontos",
      cell: (l) => (
        <span className="text-orange-ink font-semibold">{l.pontos}</span>
      ),
      numerica: true,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {grupos.map(({ categoria, linhas }) => (
        <section
          key={categoria.id}
          aria-labelledby={`classif-${categoria.id}`}
          className="flex flex-col gap-3"
        >
          <h2
            id={`classif-${categoria.id}`}
            className="font-display text-xl font-bold"
          >
            <NomeCategoria categoriaId={categoria.id}>
              {categoria.nome}
            </NomeCategoria>
          </h2>
          <DataTable
            colunas={colunas}
            linhas={linhas}
            chave={(l) => l.pilotoId}
            rotulo={`Classificação ${categoria.nome}`}
          />
        </section>
      ))}
    </div>
  );
}
