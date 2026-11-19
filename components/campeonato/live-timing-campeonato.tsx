import Link from "next/link";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { StatusPill } from "@/components/ui/status-pill";
import {
  lerAoVivoDoCampeonato,
  type LinhaAoVivo,
} from "@/lib/baterias-campeonato-store";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";
import { categorias } from "@/lib/mock/data";

const FASE = {
  classificacao: "Classificação",
  corrida: "Corrida",
  unica: "Bateria",
} as const;

const colunas: Coluna<LinhaAoVivo>[] = [
  {
    header: "Pos",
    cell: (l) => (
      <span className="text-lg font-semibold">
        {l.posicao !== null ? `${l.posicao}º` : "—"}
      </span>
    ),
    numerica: true,
  },
  { header: "Nº", cell: (l) => l.numero ?? "—", numerica: true },
  { header: "Piloto", cell: (l) => l.nome },
  { header: "Kart", cell: (l) => l.kartNumero ?? "—", numerica: true },
  { header: "Voltas", cell: (l) => l.voltas, numerica: true },
  {
    header: "Última",
    cell: (l) =>
      l.ultimaVoltaMs !== null ? formatarTempoVolta(l.ultimaVoltaMs) : "—",
    numerica: true,
  },
  {
    header: "Melhor volta",
    cell: (l) =>
      l.melhorVoltaMs !== null ? formatarTempoVolta(l.melhorVoltaMs) : "—",
    numerica: true,
  },
  { header: "Diferença", cell: (l) => l.diferenca, numerica: true },
];

// Classificação ao vivo da bateria do campeonato que está rodando (dados do decoder, atualizados a
// cada poucos segundos). Usado no painel e no site.
export async function LiveTimingCampeonato({
  linkDeBaterias,
}: {
  linkDeBaterias?: string;
}) {
  await aplicarAjustesDeCategoria();
  const vivo = await lerAoVivoDoCampeonato();

  if (!vivo) {
    return (
      <div className="flex flex-col gap-3">
        <AtualizacaoPeriodica intervaloMs={5000} />
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Nenhuma bateria do campeonato ao vivo neste momento.
          {linkDeBaterias ? (
            <>
              {" "}
              <Link
                href={linkDeBaterias}
                className="text-orange-ink font-medium hover:underline"
              >
                Ver as baterias
              </Link>
              .
            </>
          ) : null}
        </p>
      </div>
    );
  }

  const categoria = categorias.find((c) => c.id === vivo.categoriaId);
  return (
    <div className="flex flex-col gap-4">
      <AtualizacaoPeriodica intervaloMs={3000} />
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone="orange">
          <span className="bg-orange h-1.5 w-1.5 animate-pulse rounded-full" />{" "}
          AO VIVO
        </StatusPill>
        <span className="text-ink-2 text-sm">
          <NomeCategoria
            categoriaId={vivo.categoriaId}
            className="inline-block rounded bg-[#0c1630] px-2 py-0.5"
          >
            {categoria?.nome ?? vivo.categoriaId}
          </NomeCategoria>{" "}
          · {vivo.etapaNome} · {FASE[vivo.fase]}
          {vivo.estado === "encerrando" ? " (encerrando)" : ""}
        </span>
      </div>
      <DataTable
        colunas={colunas}
        linhas={vivo.linhas}
        chave={(l) => `${l.nome}-${l.numero ?? ""}-${l.kartNumero ?? ""}`}
        vazio="Aguardando as primeiras passagens no decoder."
        rotulo="Classificação ao vivo"
      />
    </div>
  );
}
