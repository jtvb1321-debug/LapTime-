import { NomeCategoria } from "@/components/ui/nome-categoria";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { PoleBadge, VoltaRapidaBadge } from "@/components/ui/race-badge";
import {
  baterias,
  formatGap,
  formatTempoVolta,
  getBateriaClassificatoriaDaFinal,
  getCategoriaById,
  getKartById,
  getPilotoById,
  getPole,
  getResultadosPorBateria,
  getVoltaRapida,
} from "@/lib/mock/data";
import type { Resultado } from "@/lib/types";

export const metadata: Metadata = { title: "Live timing" };

export default function AdminLiveTimingPage() {
  const bateriaAoVivo = baterias.find((b) => b.status === "ao_vivo");
  const classificatoria = bateriaAoVivo
    ? getBateriaClassificatoriaDaFinal(bateriaAoVivo)
    : undefined;
  const pole = classificatoria ? getPole(classificatoria.id) : undefined;
  const voltaRapida = bateriaAoVivo
    ? getVoltaRapida(bateriaAoVivo.id)
    : undefined;

  const colunas: Coluna<Resultado>[] = [
    {
      header: "Pos.",
      cell: (r) => <PosicaoBadge posicao={r.posicao} />,
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
            {piloto?.nome}
            {pole?.pilotoId === r.pilotoId ? <PoleBadge /> : null}
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
          {voltaRapida?.id === r.id ? <VoltaRapidaBadge provisoria /> : null}
        </span>
      ),
      numerica: true,
    },
    { header: "Gap", cell: (r) => formatGap(r.gapMs), numerica: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Live timing"
        description="Painel de cronometragem da bateria em andamento."
        actions={
          <>
            <Button variant="secondary">Pausar</Button>
            <Button variant="secondary">Encerrar bateria</Button>
          </>
        }
      />
      {bateriaAoVivo ? (
        <>
          <div className="flex items-center gap-2">
            <StatusPill tone="orange">
              <span className="bg-orange h-1.5 w-1.5 animate-pulse rounded-full" />{" "}
              AO VIVO
            </StatusPill>
            <span className="text-ink-2 text-sm">
              <NomeCategoria categoriaId={bateriaAoVivo.categoriaId}>
                {getCategoriaById(bateriaAoVivo.categoriaId)?.nome}
              </NomeCategoria>{" "}
              — {bateriaAoVivo.nome}
            </span>
          </div>
          <DataTable
            colunas={colunas}
            linhas={getResultadosPorBateria(bateriaAoVivo.id)}
            chave={(r) => r.id}
          />
        </>
      ) : (
        <p className="text-ink-2 text-sm">
          Nenhuma bateria ao vivo neste momento.
        </p>
      )}
      <p className="text-ink-3 text-xs">
        Quando o Supabase Realtime estiver conectado, esta tabela vai atualizar
        automaticamente a cada volta. O ponto extra da volta mais rápida só é
        confirmado ao encerrar a bateria.
      </p>
    </div>
  );
}
