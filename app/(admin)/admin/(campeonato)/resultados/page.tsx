import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { PoleBadge, VoltaRapidaBadge } from "@/components/ui/race-badge";
import {
  baterias,
  bonusVoltaRapidaConfirmado,
  formatGap,
  formatTempoVolta,
  getCategoriaById,
  getKartById,
  getPilotoById,
  getVoltaRapida,
  pontosComBonus,
  resultados,
} from "@/lib/mock/data";
import type { Resultado } from "@/lib/types";

export const metadata: Metadata = { title: "Resultados" };

const colunas: Coluna<Resultado>[] = [
  {
    header: "Bateria",
    cell: (r) => {
      const bateria = baterias.find((b) => b.id === r.bateriaId);
      return `${getCategoriaById(bateria?.categoriaId ?? "")?.nome} — ${bateria?.nome}`;
    },
  },
  {
    header: "Pos.",
    cell: (r) => {
      const bateria = baterias.find((b) => b.id === r.bateriaId);
      const ehPole = bateria?.numero === 1 && r.posicao === 1;
      return (
        <span className="flex items-center justify-end gap-2">
          <PosicaoBadge posicao={r.posicao} />
          {ehPole ? <PoleBadge /> : null}
        </span>
      );
    },
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
        </span>
      );
    },
  },
  { header: "Kart", cell: (r) => getKartById(r.kartId)?.placa },
  {
    header: "Melhor volta",
    cell: (r) => {
      const bateria = baterias.find((b) => b.id === r.bateriaId);
      const ehVoltaRapida =
        bateria?.numero === 2 && getVoltaRapida(r.bateriaId)?.id === r.id;
      return (
        <span className="flex items-center justify-end gap-2">
          {formatTempoVolta(r.melhorVoltaMs)}
          {ehVoltaRapida ? (
            <VoltaRapidaBadge provisoria={bateria?.status !== "encerrada"} />
          ) : null}
        </span>
      );
    },
    numerica: true,
  },
  { header: "Gap", cell: (r) => formatGap(r.gapMs), numerica: true },
  {
    header: "Pontos",
    cell: (r) => {
      const bateria = baterias.find((b) => b.id === r.bateriaId);
      if (!bateria) return r.pontos;
      const pontos = pontosComBonus(bateria, r);
      return bonusVoltaRapidaConfirmado(bateria, r)
        ? `${pontos} (+1 VR)`
        : pontos;
    },
    numerica: true,
  },
];

export default function AdminResultadosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resultados"
        description="Todos os resultados lançados na etapa atual."
      />
      <DataTable colunas={colunas} linhas={resultados} chave={(r) => r.id} />
    </div>
  );
}
