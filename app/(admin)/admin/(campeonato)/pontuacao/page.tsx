import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { categorias, getPilotosPorCategoria } from "@/lib/mock/data";
import type { Piloto } from "@/lib/types";

export const metadata: Metadata = { title: "Pontuação" };

const TABELA_PONTOS = [
  { posicao: "1º", pontos: 25 },
  { posicao: "2º", pontos: 20 },
  { posicao: "3º", pontos: 16 },
  { posicao: "4º", pontos: 13 },
  { posicao: "5º", pontos: 11 },
  { posicao: "6º", pontos: 10 },
  { posicao: "7º em diante", pontos: "10 − 1 por posição (mín. 1)" },
];

const colunasPilotos: Coluna<Piloto>[] = [
  { header: "Pos.", cell: (p) => p.posicaoCampeonato, numerica: true },
  { header: "Piloto", cell: (p) => p.nome },
  { header: "Pontos", cell: (p) => p.pontos, numerica: true },
];

export default function AdminPontuacaoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pontuação"
        description="Regra de pontos por posição e classificação atual por categoria."
      />

      <Card>
        <CardBody>
          <h2 className="text-ink mb-3 text-sm font-medium">
            Pontos por posição na bateria final
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TABELA_PONTOS.map((linha) => (
              <li
                key={linha.posicao}
                className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="text-ink-2">{linha.posicao}</span>
                <span className="text-ink font-display text-lg font-bold">
                  {linha.pontos}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="text-ink text-sm font-medium">
            Pole position e volta mais rápida
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            <li className="border-border flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-ink-2">
                Pole position (1º na bateria classificatória) — define o grid da
                final
              </span>
              <span className="text-ink font-display text-lg font-bold">
                +0
              </span>
            </li>
            <li className="border-border flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-ink-2">
                Volta mais rápida da bateria final, entre os 10 primeiros (regra
                da F1)
              </span>
              <span className="text-ink font-display text-lg font-bold">
                +1
              </span>
            </li>
          </ul>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {categorias.map((categoria) => (
          <div key={categoria.id} className="flex flex-col gap-3">
            <h2 className="text-ink text-sm font-medium">{categoria.nome}</h2>
            <DataTable
              colunas={colunasPilotos}
              linhas={getPilotosPorCategoria(categoria.id)}
              chave={(p) => p.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
