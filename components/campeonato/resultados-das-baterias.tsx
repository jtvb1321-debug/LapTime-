import { DataTable, type Coluna } from "@/components/ui/data-table";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { PoleBadge, VoltaRapidaBadge } from "@/components/ui/race-badge";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";
import { formatData } from "@/lib/mock/data";
import type { LinhaPontuada } from "@/lib/pontuacao-campeonato";
import type { BateriaComResultado } from "@/lib/resultados-campeonato-store";

const SITUACAO: Record<string, string> = {
  dns: "Não largou",
  dnf: "Não terminou",
  dsq: "Desclassificado",
  nao_largou: "Não largou",
  sem_sensor: "Sem sensor",
};

// Resultado de cada corrida finalizada, agrupado por etapa, com os pontos de cada piloto.
export function ResultadosDasBaterias({
  baterias,
  categorias,
  detalharPontos = false,
}: {
  baterias: BateriaComResultado[];
  categorias: { id: string; nome: string }[];
  // No painel mostra a conta dos pontos (posição + bônus − punição).
  detalharPontos?: boolean;
}) {
  if (baterias.length === 0) {
    return (
      <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
        Ainda não há corridas finalizadas. Os resultados aparecem aqui assim que
        cada corrida terminar.
      </p>
    );
  }
  const etapas = [...new Map(baterias.map((b) => [b.etapaId, b])).values()];

  const colunas: Coluna<LinhaPontuada>[] = [
    {
      header: "Pos.",
      cell: (l) =>
        l.posicao !== null && !SITUACAO[l.situacao] ? (
          <PosicaoBadge posicao={l.posicao} />
        ) : (
          <span className="text-ink-3 text-xs">
            {SITUACAO[l.situacao] ?? "—"}
          </span>
        ),
    },
    {
      header: "Piloto",
      cell: (l) => (
        <span className="flex flex-wrap items-center gap-2">
          {l.nome}
          {l.pole ? <PoleBadge /> : null}
          {l.voltaRapida ? <VoltaRapidaBadge /> : null}
        </span>
      ),
    },
    { header: "Voltas", cell: (l) => l.voltas, numerica: true },
    {
      header: "Melhor volta",
      cell: (l) =>
        l.melhorVoltaMs !== null ? formatarTempoVolta(l.melhorVoltaMs) : "—",
      numerica: true,
    },
    ...(detalharPontos
      ? ([
          {
            header: "Conta",
            cell: (l) => {
              const partes = [`${l.pontosPosicao}`];
              if (l.bonusPole) partes.push(`+${l.bonusPole} pole`);
              if (l.bonusVoltaRapida) partes.push(`+${l.bonusVoltaRapida} VR`);
              if (l.participacao) partes.push(`+${l.participacao} part.`);
              if (l.penalidade) partes.push(`−${l.penalidade} punição`);
              return (
                <span className="text-ink-3 text-xs">
                  {l.desclassificada ? "desclassificado" : partes.join(" ")}
                </span>
              );
            },
          },
        ] satisfies Coluna<LinhaPontuada>[])
      : []),
    {
      header: "Pontos",
      cell: (l) => (
        <span className="text-orange-ink font-semibold">{l.total}</span>
      ),
      numerica: true,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {etapas.map((e) => (
        <section
          key={e.etapaId}
          aria-labelledby={`res-${e.etapaId}`}
          className="flex flex-col gap-4"
        >
          <h2
            id={`res-${e.etapaId}`}
            className="font-display text-xl font-bold"
          >
            {e.etapaNome}{" "}
            <span className="text-ink-3 text-sm font-normal">
              · {formatData(e.etapaData)}
            </span>
          </h2>
          {baterias
            .filter((b) => b.etapaId === e.etapaId)
            .map((b) => (
              <div key={b.bateriaId} className="flex flex-col gap-2">
                <h3 className="text-base font-semibold">
                  <NomeCategoria
                    categoriaId={b.categoriaId}
                    className="inline-block rounded bg-[#0c1630] px-2 py-0.5"
                  >
                    {categorias.find((c) => c.id === b.categoriaId)?.nome ??
                      b.categoriaId}
                  </NomeCategoria>
                </h3>
                <DataTable
                  colunas={colunas}
                  linhas={[...b.linhas].sort(
                    (x, y) =>
                      (x.posicao ?? 999) - (y.posicao ?? 999) ||
                      x.nome.localeCompare(y.nome),
                  )}
                  chave={(l) => `${b.bateriaId}-${l.pilotoId ?? l.nome}`}
                  rotulo={`Resultado ${b.etapaNome}`}
                />
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
