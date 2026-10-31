import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { PoleBadge, VoltaRapidaBadge } from "@/components/ui/race-badge";
import {
  baterias,
  etapas,
  formatGap,
  formatTempoVolta,
  getBateriaClassificatoriaDaFinal,
  getCategoriaById,
  getKartById,
  getPilotoById,
  getPole,
  getResultadosPorBateria,
  getVoltaRapida,
  nomeExibicaoPiloto,
} from "@/lib/mock/data";
import type { Resultado } from "@/lib/types";

export const metadata: Metadata = { title: "Live timing" };

// Sobrenome em negrito e o resto do nome em peso normal — mesmo destaque já
// usado na Classificação e no overlay de transmissão.
function NomePiloto({ nome }: { nome: string }) {
  const partes = nome.trim().split(/\s+/);
  const sobrenome = partes.pop();
  const primeiroNome = partes.join(" ");
  return (
    <>
      {primeiroNome ? `${primeiroNome} ` : ""}
      <span className="font-bold">{sobrenome}</span>
    </>
  );
}

export default function LiveTimingPage() {
  // Enquanto os dados forem locais, esta bateria "ao_vivo" é fixa. Com o
  // Supabase conectado, isso vira uma subscription no Realtime na tabela
  // `resultados` filtrada pela bateria em andamento.
  const bateriaAoVivo = baterias.find((b) => b.status === "ao_vivo");

  if (!bateriaAoVivo) {
    return (
      <p className="text-ink-2 text-sm">
        Nenhuma bateria ao vivo neste momento.
      </p>
    );
  }

  const etapa = etapas.find((e) => e.id === bateriaAoVivo.etapaId);
  const categoria = getCategoriaById(bateriaAoVivo.categoriaId);
  const classificatoria = getBateriaClassificatoriaDaFinal(bateriaAoVivo);
  const pole = classificatoria ? getPole(classificatoria.id) : undefined;
  const voltaRapida = getVoltaRapida(bateriaAoVivo.id);

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
            <span className="flex items-center gap-1.5">
              {piloto ? <NomePiloto nome={nomeExibicaoPiloto(piloto)} /> : null}
              {piloto?.uf ? (
                <span className="bg-ink/5 text-ink-2 rounded px-1 py-0.5 text-[10px] font-bold uppercase">
                  {piloto.uf}
                </span>
              ) : null}
            </span>
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
    {
      header: "Gap",
      cell: (r) => (
        <span className="text-orange-ink">{formatGap(r.gapMs)}</span>
      ),
      numerica: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-ink text-base font-semibold">
            {categoria?.nome} — {bateriaAoVivo.nome}
          </h2>
          <p className="text-ink-2 text-sm">
            {etapa?.nome} · {etapa?.kartodromo} · {bateriaAoVivo.voltas} voltas
          </p>
        </div>
        <StatusPill tone="orange">
          <span className="bg-orange h-1.5 w-1.5 animate-pulse rounded-full" />{" "}
          AO VIVO
        </StatusPill>
      </div>
      <DataTable
        colunas={colunas}
        linhas={getResultadosPorBateria(bateriaAoVivo.id)}
        chave={(r) => r.id}
        linhaClassName={(r) =>
          voltaRapida?.id === r.id
            ? "border-l-4 border-orange bg-orange/5"
            : undefined
        }
      />
      <p className="text-ink-3 text-xs">
        A volta mais rápida só confirma o ponto extra do campeonato quando a
        bateria encerra, se o piloto terminar entre os 10 primeiros.
      </p>
    </div>
  );
}
