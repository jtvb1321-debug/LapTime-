import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { CategoriaBadge } from "@/components/ui/categoria-badge";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { PoleBadge, VoltaRapidaBadge } from "@/components/ui/race-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { ButtonLink } from "@/components/ui/button";
import { ClassificacaoCarrossel } from "@/components/admin/classificacao-carrossel";
import { corDoKart } from "@/lib/kart-cor";
import {
  baterias,
  bonusVoltaRapidaConfirmado,
  categorias,
  etapas,
  formatData,
  formatGap,
  formatTempoVolta,
  getBateriaClassificatoriaDaFinal,
  getCategoriaById,
  getEtapaAtual,
  getKartById,
  getPilotoById,
  getPilotosPorCategoria,
  getPole,
  getResultadosPorBateria,
  getVoltaRapida,
  inscricoes,
  karts,
  logSistema,
  pilotos,
  pontosComBonus,
} from "@/lib/mock/data";
import type { Resultado } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const TONE_ETAPA = {
  agendada: "neutral",
  em_andamento: "orange",
  encerrada: "ink",
  cancelada: "neutral",
} as const;

export default function AdminDashboardPage() {
  const etapaAtual = getEtapaAtual();
  const bateriasDaEtapa = etapaAtual
    ? baterias.filter((b) => b.etapaId === etapaAtual.id)
    : [];
  const bateriaAtual =
    bateriasDaEtapa.find((b) => b.status === "ao_vivo") ??
    bateriasDaEtapa.find((b) => b.status === "grid") ??
    bateriasDaEtapa[0];
  const categoriaAtual = bateriaAtual
    ? getCategoriaById(bateriaAtual.categoriaId)
    : undefined;
  const proximaBateria = bateriasDaEtapa.find(
    (b) =>
      b.id !== bateriaAtual?.id &&
      (b.status === "grid" || b.status === "agendada"),
  );
  const categoriaProxima = proximaBateria
    ? getCategoriaById(proximaBateria.categoriaId)
    : undefined;

  const classificatoria = bateriaAtual
    ? getBateriaClassificatoriaDaFinal(bateriaAtual)
    : undefined;
  const pole = classificatoria ? getPole(classificatoria.id) : undefined;
  const voltaRapida = bateriaAtual
    ? getVoltaRapida(bateriaAtual.id)
    : undefined;

  const inscricoesAguardando = inscricoes.filter(
    (i) => i.status === "aguardando",
  ).length;
  const kartsDisponiveis = karts.filter(
    (k) => k.status === "disponivel",
  ).length;

  const proximasEtapas = etapas
    .filter((e) => e.status === "em_andamento" || e.status === "agendada")
    .slice(0, 3);

  const rankingPorCategoria = categorias.map((categoria) => ({
    categoria,
    pilotos: getPilotosPorCategoria(categoria.id).slice(0, 5),
  }));

  const colunasBateria: Coluna<Resultado>[] = [
    {
      header: "Pos.",
      cell: (r) => (
        <span className="flex items-center justify-end gap-2">
          <PosicaoBadge posicao={r.posicao} />
          {pole?.pilotoId === r.pilotoId ? <PoleBadge /> : null}
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
            {piloto?.nome}
          </span>
        );
      },
    },
    {
      header: "Kart",
      cell: (r) => {
        const kart = getKartById(r.kartId);
        return (
          <span
            className={clsx(
              "rounded px-1.5 py-0.5 font-mono text-xs font-semibold",
              corDoKart(kart?.numero ?? 0),
            )}
          >
            {kart?.placa}
          </span>
        );
      },
    },
    {
      header: "Melhor volta",
      cell: (r) => (
        <span className="flex items-center justify-end gap-2">
          {formatTempoVolta(r.melhorVoltaMs)}
          {voltaRapida?.id === r.id ? (
            <VoltaRapidaBadge
              provisoria={bateriaAtual?.status !== "encerrada"}
            />
          ) : null}
        </span>
      ),
      numerica: true,
    },
    {
      header: "Gap",
      cell: (r) => <span className="text-orange">{formatGap(r.gapMs)}</span>,
      numerica: true,
    },
    {
      header: "Pontos",
      cell: (r) => {
        if (!bateriaAtual) return r.pontos;
        const pontos = pontosComBonus(bateriaAtual, r);
        return (
          <span className="text-orange font-semibold">
            {pontos}
            {bonusVoltaRapidaConfirmado(bateriaAtual, r) ? " (+1 VR)" : ""}
          </span>
        );
      },
      numerica: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Visão geral do campeonato." />

      <div className="flex flex-col gap-4 lg:flex-row">
        <Card className="overflow-hidden lg:flex-[2]">
          {etapaAtual ? (
            <>
              <div
                className={clsx(
                  "h-1 w-full",
                  etapaAtual.status === "em_andamento"
                    ? "bg-orange"
                    : etapaAtual.status === "encerrada"
                      ? "bg-ink"
                      : "bg-ink-3",
                )}
              />
              <CardBody className="flex flex-col gap-2">
                <StatusPill tone={TONE_ETAPA[etapaAtual.status]}>
                  {etapaAtual.status.replace("_", " ")}
                </StatusPill>
                <h2 className="text-ink text-lg font-semibold">
                  Etapa {etapaAtual.numero} — {etapaAtual.kartodromo}
                </h2>
                <p className="text-ink-2 text-sm">
                  {etapaAtual.cidade} · {formatData(etapaAtual.data)}
                </p>
                {proximaBateria ? (
                  <p className="text-ink-2 text-sm">
                    Próxima bateria: {categoriaProxima?.nome} —{" "}
                    {proximaBateria.nome} às {proximaBateria.horario}
                  </p>
                ) : null}
              </CardBody>
            </>
          ) : (
            <CardBody className="flex flex-col gap-2">
              <h2 className="text-ink text-lg font-semibold">
                Nenhum campeonato cadastrado
              </h2>
              <p className="text-ink-2 text-sm">
                Cadastre um campeonato e uma etapa para começar a temporada.
              </p>
              <Link
                href="/admin/campeonatos"
                className="text-orange w-fit text-sm font-medium hover:underline"
              >
                Ir para Campeonatos →
              </Link>
            </CardBody>
          )}
        </Card>

        <div className="flex flex-col gap-2 lg:flex-1">
          <ButtonLink
            href="/admin/live-timing"
            className="w-full justify-start"
          >
            Live timing
          </ButtonLink>
          <ButtonLink
            href="/admin/balizamento"
            variant="secondary"
            className="w-full justify-start"
          >
            Balizamento
          </ButtonLink>
          <ButtonLink
            href="/admin/resultados"
            variant="secondary"
            className="w-full justify-start"
          >
            Resultados
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-ink text-sm font-medium">Próximas etapas</h2>
            <Link
              href="/admin/etapas"
              className="text-ink-2 hover:text-orange text-xs font-medium"
            >
              Ver todas →
            </Link>
          </CardHeader>
          <CardBody className="flex flex-col gap-1">
            {proximasEtapas.map((etapa) => (
              <div
                key={etapa.id}
                className="border-border flex items-center justify-between border-b py-2 text-sm last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-ink font-medium">
                    Etapa {etapa.numero} — {etapa.kartodromo}
                  </p>
                  <p className="text-ink-3 text-xs">
                    {etapa.cidade} · {formatData(etapa.data)}
                  </p>
                </div>
                <StatusPill tone={TONE_ETAPA[etapa.status]}>
                  {etapa.status.replace("_", " ")}
                </StatusPill>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-ink text-sm font-medium">
              Classificação geral
            </h2>
            <Link
              href="/admin/pontuacao"
              className="text-ink-2 hover:text-orange text-xs font-medium"
            >
              Ver todas →
            </Link>
          </CardHeader>
          <CardBody>
            <ClassificacaoCarrossel grupos={rankingPorCategoria} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {categoriaAtual ? (
              <CategoriaBadge
                nome={categoriaAtual.nome}
                categoriaId={categoriaAtual.id}
              />
            ) : null}
            <h2 className="text-ink text-sm font-medium">
              {bateriaAtual ? bateriaAtual.nome : "Nenhuma bateria no momento"}
            </h2>
          </div>
          {bateriaAtual ? (
            <StatusPill
              tone={bateriaAtual.status === "ao_vivo" ? "orange" : "neutral"}
            >
              {bateriaAtual.horario}
            </StatusPill>
          ) : null}
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {bateriaAtual ? (
            <>
              <DataTable
                colunas={colunasBateria}
                linhas={getResultadosPorBateria(bateriaAtual.id)}
                chave={(r) => r.id}
              />
              <div className="text-ink-3 flex flex-wrap justify-between gap-2 text-xs">
                {voltaRapida ? (
                  <span>
                    Volta mais rápida:{" "}
                    <span className="text-ink font-medium">
                      {getPilotoById(voltaRapida.pilotoId)?.nome} —{" "}
                      {formatTempoVolta(voltaRapida.melhorVoltaMs)}
                    </span>
                  </span>
                ) : null}
                {pole ? (
                  <span>
                    Pole:{" "}
                    <span className="text-ink font-medium">
                      {getPilotoById(pole.pilotoId)?.nome} —{" "}
                      {formatTempoVolta(pole.melhorVoltaMs)}
                    </span>
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-ink-2 text-sm">
              Nenhuma bateria em andamento no momento.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pilotos inscritos" value={pilotos.length} />
        <StatCard label="Etapas na temporada" value={etapas.length} />
        <StatCard label="Karts disponíveis" value={kartsDisponiveis} />
        <StatCard
          label="Inscrições aguardando"
          value={inscricoesAguardando}
          hint="pagamento pendente"
        />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="text-ink text-sm font-medium">Atividade recente</h2>
          <ul className="flex flex-col gap-2">
            {logSistema.map((log) => (
              <li
                key={log.id}
                className="border-border flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className="text-ink-2">
                  {log.usuarioId} {log.acao} {log.entidade}{" "}
                  <span className="text-ink-3 font-mono">{log.entidadeId}</span>
                </span>
                <span className="text-ink-3 font-mono text-xs">
                  {formatData(log.criadoEm.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
