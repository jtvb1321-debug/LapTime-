import Link from "next/link";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CategoriaBadge } from "@/components/ui/categoria-badge";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { VoltaRapidaBadge } from "@/components/ui/race-badge";
import { lerImagemDoCampeonato } from "@/lib/campeonato-imagem-store";
import { corSolidaCategoria } from "@/lib/categoria-cor";
import {
  baterias,
  campeonato,
  etapas,
  formatData,
  formatGap,
  formatTempoVolta,
  getCategoriaById,
  getEtapaAtual,
  getKartById,
  getPilotoById,
  getResultadosPorBateria,
  getVoltaRapida,
} from "@/lib/mock/data";
import type { Etapa, Resultado } from "@/lib/types";

export default async function HomePage() {
  const imagemDoCampeonato = campeonato
    ? await lerImagemDoCampeonato(campeonato.id).catch(() => null)
    : null;
  const proximaEtapa: Etapa | undefined =
    etapas.find((e) => e.status === "agendada") ?? etapas[0];
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

  const voltaRapida = bateriaAtual
    ? getVoltaRapida(bateriaAtual.id)
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
    <div className="flex flex-col gap-10">
      {campeonato && imagemDoCampeonato ? (
        <section aria-label={`Apresentação: ${campeonato.nome}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/campeonatos/${encodeURIComponent(campeonato.id)}/imagem?v=${imagemDoCampeonato.atualizadoEm.getTime()}`}
            alt={imagemDoCampeonato.alt}
            className="border-border aspect-[16/7] w-full rounded-lg border object-cover"
          />
        </section>
      ) : null}
      <section>
        <Card className="overflow-hidden">
          {!etapaAtual ? (
            <CardBody>
              <p className="text-ink-2 text-sm">
                Nenhum campeonato em andamento no momento. Volte em breve.
              </p>
            </CardBody>
          ) : (
            <>
              <div
                className={clsx(
                  "h-1.5 w-full",
                  categoriaAtual
                    ? corSolidaCategoria(categoriaAtual.id)
                    : "bg-ink-3",
                )}
              />
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-ink-3 text-xs tracking-wide uppercase">
                      {etapaAtual.kartodromo} · Etapa {etapaAtual.numero}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {categoriaAtual ? (
                        <CategoriaBadge
                          nome={categoriaAtual.nome}
                          categoriaId={categoriaAtual.id}
                        />
                      ) : null}
                      <h1 className="text-ink text-base font-semibold">
                        {bateriaAtual
                          ? bateriaAtual.nome
                          : "Nenhuma bateria no momento"}
                      </h1>
                    </div>
                  </div>
                  {bateriaAtual ? (
                    <StatusPill
                      tone={
                        bateriaAtual.status === "ao_vivo" ? "orange" : "neutral"
                      }
                    >
                      {bateriaAtual.horario}
                    </StatusPill>
                  ) : null}
                </div>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                {proximaBateria ? (
                  <p className="text-ink-2 text-sm">
                    Próxima bateria: {categoriaProxima?.nome} —{" "}
                    {proximaBateria.nome} às {proximaBateria.horario}
                  </p>
                ) : null}

                {bateriaAtual ? (
                  <>
                    <DataTable
                      colunas={colunas}
                      linhas={getResultadosPorBateria(bateriaAtual.id)}
                      chave={(r) => r.id}
                    />
                    <p className="text-ink-3 text-xs">
                      Classificação volta a volta ainda fictícia — passa a vir
                      da API de cronometragem quando o laptime real estiver
                      integrado.
                    </p>
                  </>
                ) : (
                  <p className="text-ink-2 text-sm">
                    Nenhuma bateria em andamento no momento.
                  </p>
                )}
              </CardBody>
            </>
          )}
        </Card>
      </section>

      {proximaEtapa ? (
        <section>
          <Card>
            <CardHeader>
              <h2 className="text-ink text-sm font-medium">Próxima etapa</h2>
            </CardHeader>
            <CardBody className="flex flex-col gap-1">
              <p className="text-ink font-medium">{proximaEtapa.nome}</p>
              <p className="text-ink-2 text-sm">
                {proximaEtapa.kartodromo} — {proximaEtapa.cidade}
              </p>
              <p className="text-ink-2 font-mono text-sm">
                {formatData(proximaEtapa.data)}
              </p>
              <Link
                href="/campeonato/calendario"
                className="text-orange-ink mt-3 text-sm font-medium hover:underline"
              >
                Ver calendário completo →
              </Link>
            </CardBody>
          </Card>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-ink text-lg font-semibold">
            Etapas do campeonato
          </h2>
          <Link
            href="/campeonato/calendario"
            className="text-ink-2 hover:text-ink text-sm font-medium"
          >
            Ver todas
          </Link>
        </div>
        {etapas.length === 0 ? (
          <p className="text-ink-2 text-sm">Nenhuma etapa cadastrada ainda.</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {etapas.map((etapa) => {
            const tone =
              etapa.status === "em_andamento"
                ? "orange"
                : etapa.status === "encerrada"
                  ? "ink"
                  : "neutral";
            return (
              <Card key={etapa.id} className="overflow-hidden">
                <div
                  className={clsx(
                    "h-1 w-full",
                    tone === "orange"
                      ? "bg-orange"
                      : tone === "ink"
                        ? "bg-ink"
                        : "bg-ink-3",
                  )}
                />
                <CardBody className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-ink text-sm font-medium">
                      Etapa {etapa.numero}
                    </span>
                    <StatusPill tone={tone}>
                      {etapa.status.replace("_", " ")}
                    </StatusPill>
                  </div>
                  <p className="text-ink font-medium">{etapa.kartodromo}</p>
                  <p className="text-ink-2 text-sm">{etapa.cidade}</p>
                  <p className="text-ink-3 font-mono text-sm">
                    {formatData(etapa.data)}
                  </p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
