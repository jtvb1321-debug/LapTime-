import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { CategoriaBadge } from "@/components/ui/categoria-badge";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { PoleBadge, VoltaRapidaBadge } from "@/components/ui/race-badge";
import {
  baterias,
  bonusVoltaRapidaConfirmado,
  etapas,
  formatCidadeUf,
  formatGap,
  formatTempoVolta,
  getCategoriaById,
  getKartById,
  getPole,
  getVoltaRapida,
  nomeExibicaoPiloto,
  pontosComBonus,
  resultados,
} from "@/lib/mock/data";
import { encontrarPilotoPorSlug } from "@/lib/pilotos-store";
import { fonteAssinatura } from "@/lib/fonts";
import { corParaFundoClaro } from "@/lib/cor-contraste";
import type { Resultado } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const piloto = await encontrarPilotoPorSlug(slug);
  return { title: piloto ? nomeExibicaoPiloto(piloto) : "Piloto" };
}

const colunas: Coluna<Resultado>[] = [
  {
    header: "Etapa",
    cell: (r) => {
      const bateria = baterias.find((b) => b.id === r.bateriaId);
      const etapa = etapas.find((e) => e.id === bateria?.etapaId);
      return `${etapa?.nome} — ${bateria?.nome}`;
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
          {ehVoltaRapida ? <VoltaRapidaBadge /> : null}
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

export default async function PilotoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const piloto = await encontrarPilotoPorSlug(slug);
  if (!piloto) notFound();

  const categoria = getCategoriaById(piloto.categoriaId);
  const historico = resultados.filter((r) => r.pilotoId === piloto.id);

  const poles = baterias.filter(
    (b) => b.numero === 1 && getPole(b.id)?.pilotoId === piloto.id,
  ).length;
  const voltasRapidas = baterias.filter(
    (b) => b.numero === 2 && getVoltaRapida(b.id)?.pilotoId === piloto.id,
  ).length;
  const pontos = piloto.pontos;
  const vitorias = piloto.vitorias;
  const podios = piloto.podios;

  return (
    <div className="relative isolate flex flex-col gap-8">
      {piloto.corNumero || piloto.corAssinatura ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-6 z-0 flex h-[420px] flex-col items-end justify-start overflow-hidden select-none"
        >
          <span
            className="font-black italic"
            style={{
              color: corParaFundoClaro(piloto.corNumero, "#8b5cf6"),
              opacity: 0.09,
              fontSize: "min(38vw, 420px)",
              lineHeight: 0.75,
            }}
          >
            {piloto.numero}
          </span>
          <span
            className={`${fonteAssinatura.className} -mt-10 -mr-2 whitespace-nowrap`}
            style={{
              color: corParaFundoClaro(piloto.corAssinatura, "#171a23"),
              opacity: 0.16,
              fontSize: "min(9vw, 96px)",
            }}
          >
            {nomeExibicaoPiloto(piloto)}
          </span>
        </div>
      ) : null}

      <div className="border-border relative z-10 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Avatar
            nome={piloto.nome}
            avatarUrl={piloto.avatarUrl}
            tamanho="lg"
          />
          <div>
            <p
              className="font-mono text-sm"
              style={{ color: corParaFundoClaro(piloto.corNumero, "#9399a6") }}
            >
              #{piloto.numero}
            </p>
            <h1 className="text-ink text-2xl font-semibold">
              {nomeExibicaoPiloto(piloto)}
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              {categoria ? (
                <CategoriaBadge
                  nome={categoria.nome}
                  categoriaId={categoria.id}
                />
              ) : null}
              {formatCidadeUf(piloto) ? (
                <span className="text-ink-2 text-sm">
                  {formatCidadeUf(piloto)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {piloto.corNumero || piloto.corAssinatura ? (
          // Assinatura do piloto (número + nome nas cores que ele escolheu)
          // completando o espaço vazio do cabeçalho — itálico condensado no
          // estilo dos gráficos de transmissão da F1 (mesmo tratamento já
          // usado no título dos cards de traçado), não a fonte cursiva usada
          // nos overlays.
          <div className="flex items-baseline gap-3">
            <span
              className="text-6xl leading-none font-black tracking-tight italic"
              style={{ color: corParaFundoClaro(piloto.corNumero, "#8b5cf6") }}
            >
              {piloto.numero}
            </span>
            <span
              className="text-4xl leading-none font-black tracking-tight uppercase italic"
              style={{
                color: corParaFundoClaro(piloto.corAssinatura, "#171a23"),
              }}
            >
              {nomeExibicaoPiloto(piloto)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Posição",
            value: `${piloto.posicaoCampeonato}º`,
            cor: "text-ink",
          },
          { label: "Pontos", value: pontos, cor: "text-orange-ink" },
          { label: "Vitórias", value: vitorias, cor: "text-orange-ink" },
          { label: "Pódios", value: podios, cor: "text-ink" },
          { label: "Poles", value: poles, cor: "text-orange-ink" },
          {
            label: "Voltas rápidas",
            value: voltasRapidas,
            cor: "text-orange-ink",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-ink-3 text-xs tracking-wide uppercase">
                {stat.label}
              </p>
              <p
                className={clsx(
                  "mt-1 font-mono text-2xl font-semibold",
                  stat.cor,
                )}
              >
                {stat.value}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <section className="relative z-10 flex flex-col gap-3">
        <h2 className="text-ink text-base font-semibold">
          Histórico de resultados
        </h2>
        <DataTable colunas={colunas} linhas={historico} chave={(r) => r.id} />
      </section>
    </div>
  );
}
