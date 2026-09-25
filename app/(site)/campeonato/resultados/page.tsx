import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { PoleBadge, VoltaRapidaBadge } from "@/components/ui/race-badge";
import {
  baterias,
  bonusVoltaRapidaConfirmado,
  categorias,
  etapas,
  formatGap,
  formatTempoVolta,
  getCategoriaById,
  getKartById,
  getPilotoById,
  getResultadosPorBateria,
  getVoltaRapida,
  nomeExibicaoPiloto,
  pontosComBonus,
} from "@/lib/mock/data";
import type { Bateria, Resultado } from "@/lib/types";

export const metadata: Metadata = { title: "Resultados" };

function colunasDaBateria(bateria: Bateria): Coluna<Resultado>[] {
  const ehClassificatoria = bateria.numero === 1;
  const voltaRapida = getVoltaRapida(bateria.id);

  return [
    {
      header: "Pos.",
      cell: (r) => (
        <span className="flex items-center justify-end gap-2">
          <PosicaoBadge posicao={r.posicao} />
          {ehClassificatoria && r.posicao === 1 ? <PoleBadge /> : null}
        </span>
      ),
      numerica: true,
    },
    {
      header: "Piloto",
      cell: (r) => {
        const piloto = getPilotoById(r.pilotoId);
        return (
          <span className="flex items-center gap-2.5">
            <Avatar
              nome={piloto?.nome ?? ""}
              avatarUrl={piloto?.avatarUrl}
              tamanho="sm"
            />
            {piloto ? nomeExibicaoPiloto(piloto) : null}
          </span>
        );
      },
    },
    { header: "Kart", cell: (r) => getKartById(r.kartId)?.placa },
    {
      header: "Melhor volta",
      cell: (r) => (
        <span className="flex items-center justify-end gap-2">
          {formatTempoVolta(r.melhorVoltaMs)}
          {!ehClassificatoria && voltaRapida?.id === r.id ? (
            <VoltaRapidaBadge />
          ) : null}
        </span>
      ),
      numerica: true,
    },
    { header: "Gap", cell: (r) => formatGap(r.gapMs), numerica: true },
    {
      header: "Pontos",
      cell: (r) => {
        const pontos = pontosComBonus(bateria, r);
        return bonusVoltaRapidaConfirmado(bateria, r)
          ? `${pontos} (+1 VR)`
          : pontos;
      },
      numerica: true,
    },
  ];
}

export default function ResultadosPage() {
  const bateriasEncerradas = baterias.filter((b) => b.status === "encerrada");

  return (
    <div className="flex flex-col gap-8">
      {bateriasEncerradas.map((bateria) => {
        const etapa = etapas.find((e) => e.id === bateria.etapaId);
        const categoria = getCategoriaById(bateria.categoriaId);
        return (
          <section key={bateria.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-ink text-base font-semibold">
                {categoria?.nome} — {bateria.nome}
              </h2>
              <p className="text-ink-2 text-sm">
                {etapa?.nome} · {etapa?.kartodromo}
              </p>
            </div>
            <DataTable
              colunas={colunasDaBateria(bateria)}
              linhas={getResultadosPorBateria(bateria.id)}
              chave={(r) => r.id}
            />
          </section>
        );
      })}
      {bateriasEncerradas.length === 0 ? (
        <p className="text-ink-2 text-sm">Nenhum resultado disponível ainda.</p>
      ) : null}
      <p className="text-ink-3 text-xs">
        {categorias.length} categorias disputando esta temporada.
      </p>
    </div>
  );
}
