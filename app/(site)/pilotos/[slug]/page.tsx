import { BandeiraUf } from "@/components/ui/bandeira-uf";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoriaBadge } from "@/components/ui/categoria-badge";
import { PoleBadge, VoltaRapidaBadge } from "@/components/ui/race-badge";
import {
  baterias,
  bonusVoltaRapidaConfirmado,
  etapas,
  formatData,
  formatTempoVolta,
  getCampeonato,
  getCategoriaById,
  getPole,
  getTracadoById,
  getVoltaRapida,
  inscricoes,
  nomeExibicaoPiloto,
  pontosComBonus,
  punicoes,
  resultados,
} from "@/lib/mock/data";
import {
  EvolucaoPontos,
  type PontoEvolucao,
} from "@/components/pilotos/evolucao-pontos";
import { VerCardPiloto } from "@/components/pilotos/ver-card-piloto";
import { lerApresentacao } from "@/lib/apresentacao-store";
import { getSession } from "@/lib/auth";
import { encontrarPilotoPorSlug } from "@/lib/pilotos-store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const piloto = await encontrarPilotoPorSlug(slug);
  return { title: piloto ? nomeExibicaoPiloto(piloto) : "Piloto" };
}

const PAINEL = "rounded-xl border border-white/10 bg-[#0c1630]";

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return (
    (p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")
  ).toUpperCase();
}

interface LinhaHistorico {
  id: string;
  etapa: string;
  corrida: string;
  data: string;
  posicao: number;
  ehPole: boolean;
  melhorVolta: string;
  ehVoltaRapida: boolean;
  pontos: string;
  penalidades: string | null;
}

export default async function PilotoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const piloto = await encontrarPilotoPorSlug(slug);
  if (!piloto) notFound();
  const [apresentacao, sessao] = await Promise.all([
    lerApresentacao(piloto.id),
    getSession(),
  ]);

  const categoria = getCategoriaById(piloto.categoriaId);
  const temporada = getCampeonato()?.temporada;
  const nome = nomeExibicaoPiloto(piloto);

  // Resultados oficiais do piloto (mesma fonte e mesmas regras de antes).
  const historico = resultados.filter((r) => r.pilotoId === piloto.id);
  const poles = baterias.filter(
    (b) => b.numero === 1 && getPole(b.id)?.pilotoId === piloto.id,
  ).length;
  const voltasRapidas = baterias.filter(
    (b) => b.numero === 2 && getVoltaRapida(b.id)?.pilotoId === piloto.id,
  ).length;

  const linhas: LinhaHistorico[] = historico
    .map((r) => {
      const bateria = baterias.find((b) => b.id === r.bateriaId);
      const etapa = etapas.find((e) => e.id === bateria?.etapaId);
      const pts = bateria ? pontosComBonus(bateria, r) : r.pontos;
      const penal = punicoes.filter(
        (p) => p.bateriaId === r.bateriaId && p.pilotoId === piloto.id,
      );
      return {
        id: r.id,
        etapa: etapa?.nome ?? "Etapa",
        corrida: bateria?.nome ?? "",
        data: etapa ? formatData(etapa.data) : "",
        posicao: r.posicao,
        ehPole: bateria?.numero === 1 && r.posicao === 1,
        melhorVolta: formatTempoVolta(r.melhorVoltaMs),
        ehVoltaRapida:
          bateria?.numero === 2 && getVoltaRapida(r.bateriaId)?.id === r.id,
        pontos:
          bateria && bonusVoltaRapidaConfirmado(bateria, r)
            ? `${pts} (+1 VR)`
            : String(pts),
        penalidades: penal.length
          ? penal.map((p) => p.tipo.replace(/_/g, " ")).join(", ")
          : null,
        _ordem: (etapa?.numero ?? 0) * 100 + (bateria?.numero ?? 0),
      };
    })
    .sort((a, b) => a._ordem - b._ordem)
    .map(({ _ordem, ...resto }) => {
      void _ordem;
      return resto;
    });
  const temPenalidades = linhas.some((l) => l.penalidades);

  // Evolução: pontos acumulados por etapa, a partir dos mesmos resultados.
  const porEtapa = new Map<
    string,
    { numero: number; nome: string; pts: number }
  >();
  for (const r of historico) {
    const bateria = baterias.find((b) => b.id === r.bateriaId);
    const etapa = etapas.find((e) => e.id === bateria?.etapaId);
    if (!bateria || !etapa) continue;
    const atual = porEtapa.get(etapa.id) ?? {
      numero: etapa.numero,
      nome: etapa.nome,
      pts: 0,
    };
    atual.pts += pontosComBonus(bateria, r);
    porEtapa.set(etapa.id, atual);
  }
  const ordenadas = [...porEtapa.values()].sort((a, b) => a.numero - b.numero);
  const evolucao: PontoEvolucao[] = ordenadas.map((e, idx) => ({
    rotulo: e.nome,
    pontosDaEtapa: e.pts,
    acumulado: ordenadas.slice(0, idx + 1).reduce((t, x) => t + x.pts, 0),
  }));

  // Próxima etapa cadastrada (ainda não encerrada), por data.
  const proxima = etapas
    .filter((e) => e.status === "agendada" || e.status === "em_andamento")
    .sort((a, b) => a.data.localeCompare(b.data))[0];
  const inscricao = proxima
    ? inscricoes.find(
        (i) => i.pilotoId === piloto.id && i.etapaId === proxima.id,
      )
    : undefined;
  const circuito = proxima
    ? [
        proxima.kartodromo,
        proxima.cidade,
        getTracadoById(proxima.tracadoId ?? "")?.nome,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  // A posição no campeonato (e o destaque azul dela) só faz sentido quando o piloto está inscrito
  // num campeonato cuja 1ª etapa já aconteceu (encerrada ou em andamento) ou já tem resultado.
  const campeonatoIniciado =
    linhas.length > 0 ||
    inscricoes.some((i) => {
      if (i.pilotoId !== piloto.id) return false;
      const etapaInscrita = etapas.find((e) => e.id === i.etapaId);
      if (!etapaInscrita) return false;
      return etapas.some(
        (e) =>
          e.campeonatoId === etapaInscrita.campeonatoId &&
          e.numero === 1 &&
          (e.status === "encerrada" || e.status === "em_andamento"),
      );
    });

  const estatisticas = [
    ...(campeonatoIniciado
      ? [
          {
            label: "Posição",
            valor: `${piloto.posicaoCampeonato}º`,
            destaque: false,
          },
        ]
      : []),
    {
      label: "Pontos",
      valor: String(piloto.pontos),
      destaque: campeonatoIniciado,
    },
    { label: "Vitórias", valor: String(piloto.vitorias), destaque: false },
    { label: "Pódios", valor: String(piloto.podios), destaque: false },
    { label: "Poles", valor: String(poles), destaque: false },
    { label: "Voltas rápidas", valor: String(voltasRapidas), destaque: false },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className={`${PAINEL} flex flex-col gap-4 p-4 sm:p-5`}>
        <div className="flex items-center gap-3 sm:gap-5">
          {piloto.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto do cadastro, servida por rota própria
            <img
              src={piloto.avatarUrl}
              alt={`Foto de ${nome}`}
              loading="lazy"
              decoding="async"
              className="size-16 shrink-0 rounded-xl border border-white/15 object-cover sm:size-28"
            />
          ) : (
            <span
              aria-hidden="true"
              className="font-display flex size-16 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#13224a] text-xl font-bold text-[#cfdcf3] sm:size-28 sm:text-4xl"
            >
              {iniciais(piloto.nome)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold tracking-[0.14em] text-[#4cc9ff] uppercase">
              #{piloto.numero}
            </p>
            <h1 className="font-display text-ink mt-0.5 text-xl leading-tight font-bold break-words sm:text-3xl">
              {piloto.nome}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {categoria ? (
                <CategoriaBadge
                  nome={categoria.nome}
                  categoriaId={categoria.id}
                />
              ) : null}
              {piloto.uf ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-[#9fb2d4]">
                  <BandeiraUf uf={piloto.uf} className="size-5" />
                  {piloto.uf}
                </span>
              ) : null}
              {temporada ? (
                <span className="text-sm text-[#9fb2d4]">
                  Temporada {temporada}
                </span>
              ) : null}
            </div>
          </div>
          {campeonatoIniciado ? (
            <div className="shrink-0 rounded-lg border border-[#4cc9ff]/30 bg-[#4cc9ff]/10 px-3 py-2 text-center sm:px-5 sm:py-3">
              <p className="text-[10px] tracking-wider text-[#9fb2d4] uppercase sm:text-xs">
                Campeonato
              </p>
              <p className="font-display text-2xl leading-none font-bold text-[#4cc9ff] sm:text-4xl">
                {piloto.posicaoCampeonato}º
              </p>
            </div>
          ) : null}
        </div>
        {apresentacao ? (
          <div>
            <VerCardPiloto
              dados={{
                numero: piloto.numero,
                nome: piloto.nome,
                corFaixa: piloto.corAssinatura ?? apresentacao.corFaixa,
                corDestaque: piloto.corNumero ?? "#facc15",
              }}
              fotoUrl={`/api/pilotos/${piloto.id}/corpo?v=${apresentacao.versao}`}
              podeBaixar={sessao?.papel === "admin"}
              nomeArquivo={`apresentacao-${piloto.slug}`}
            />
          </div>
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {estatisticas.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-white/10 bg-[#0c1630] px-3 py-2.5 transition-colors hover:border-[#4cc9ff]/40"
          >
            <dt className="text-[11px] tracking-wide text-[#9fb2d4] uppercase">
              {s.label}
            </dt>
            <dd
              className={`font-display mt-0.5 text-2xl leading-none font-bold ${
                s.destaque ? "text-[#4cc9ff]" : "text-ink"
              }`}
            >
              {s.valor}
            </dd>
          </div>
        ))}
      </dl>

      {evolucao.length > 0 ? (
        <section className={`${PAINEL} p-4 sm:p-5`}>
          <h2 className="text-ink mb-3 text-base font-semibold">
            Evolução da pontuação
          </h2>
          <EvolucaoPontos pontos={evolucao} />
        </section>
      ) : null}

      <section className={`${PAINEL} p-4 sm:p-5`}>
        <h2 className="text-ink mb-2 text-base font-semibold">Próxima etapa</h2>
        {proxima ? (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div>
              <p className="text-ink font-medium">
                {proxima.nome} · {formatData(proxima.data)}
              </p>
              {circuito ? (
                <p className="text-sm text-[#9fb2d4]">{circuito}</p>
              ) : null}
            </div>
            {inscricao ? (
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-[#cfdcf3] capitalize">
                Inscrição {inscricao.status}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[#9fb2d4]">
            Nenhuma etapa cadastrada para os próximos dias.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink text-base font-semibold">
          Histórico de resultados
        </h2>
        {linhas.length === 0 ? (
          <div
            className={`${PAINEL} px-5 py-8 text-center text-sm text-[#9fb2d4]`}
          >
            Nenhum resultado registrado ainda.
          </div>
        ) : (
          <>
            <div
              className={`${PAINEL} hidden overflow-x-auto sm:block`}
              role="region"
              aria-label="Histórico de resultados"
              tabIndex={0}
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs tracking-wide text-[#9fb2d4] uppercase">
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Etapa
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Data
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium"
                    >
                      Chegada
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium"
                    >
                      Melhor volta
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-right font-medium"
                    >
                      Pontos
                    </th>
                    {temPenalidades ? (
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        Penalidades
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-2.5">
                        {l.etapa}
                        {l.corrida ? (
                          <span className="text-[#9fb2d4]"> — {l.corrida}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-[#cfdcf3]">{l.data}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          <strong>{l.posicao}º</strong>
                          {l.ehPole ? <PoleBadge /> : null}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex items-center justify-end gap-2">
                          {l.melhorVolta}
                          {l.ehVoltaRapida ? <VoltaRapidaBadge /> : null}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {l.pontos}
                      </td>
                      {temPenalidades ? (
                        <td className="px-4 py-2.5 text-[#ffcf4a]">
                          {l.penalidades ?? "—"}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-2 sm:hidden">
              {linhas.map((l) => (
                <li key={l.id} className={`${PAINEL} p-3`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">
                      {l.etapa}
                      {l.corrida ? (
                        <span className="text-[#9fb2d4]"> — {l.corrida}</span>
                      ) : null}
                    </p>
                    <p className="font-display shrink-0 text-xl font-bold text-[#4cc9ff]">
                      {l.posicao}º
                    </p>
                  </div>
                  <p className="text-xs text-[#9fb2d4]">{l.data}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span>Volta {l.melhorVolta}</span>
                    <span>{l.pontos} pts</span>
                    {l.ehPole ? <PoleBadge /> : null}
                    {l.ehVoltaRapida ? <VoltaRapidaBadge /> : null}
                    {l.penalidades ? (
                      <span className="text-[#ffcf4a]">{l.penalidades}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
