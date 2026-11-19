import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getSession } from "@/lib/auth";
import { lerAoVivoDoCampeonato } from "@/lib/baterias-campeonato-store";
import { carregarCampeonatoAtivo } from "@/lib/dados-do-campeonato";
import { listarKarts } from "@/lib/cronometragem/cadastros-store";
import { formatDataEHora } from "@/lib/etapa-formato";
import { lerInscricoesDoCampeonato } from "@/lib/inscricoes-store";
import { formatMoeda, nomeExibicaoPiloto } from "@/lib/mock/data";
import { lerRecursos } from "@/lib/resultados-campeonato-store";

export const metadata: Metadata = { title: "Painel gerencial" };
export const dynamic = "force-dynamic";

function Atalho({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link
      href={href}
      className="border-border bg-surface text-ink hover:border-border-strong flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium"
    >
      {rotulo}
    </Link>
  );
}

// Visão geral do campeonato ativo, toda com dados reais (inscrições, pagamentos, frota, ao vivo,
// classificação e resultados).
export default async function AdminDashboardPage() {
  // A recepção só opera o balcão: vai direto pra agenda.
  const sessao = await getSession();
  if (sessao?.papel === "recepcao") redirect("/admin/balcao");

  const dados = await carregarCampeonatoAtivo();
  if (!dados) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Painel gerencial"
          description="Visão geral do campeonato."
        />
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Não há campeonato ativo. Crie e ative um em{" "}
          <Link
            href="/admin/campeonatos"
            className="text-orange-ink font-medium hover:underline"
          >
            Campeonatos
          </Link>
          .
        </p>
      </div>
    );
  }

  const { campeonato, resultados, pilotos, etapas } = dados;
  const [inscricoes, vivo, karts, recursos] = await Promise.all([
    lerInscricoesDoCampeonato(campeonato.id),
    lerAoVivoDoCampeonato(),
    listarKarts().catch(() => []),
    lerRecursos(campeonato.id),
  ]);

  const proxima = etapas
    .filter((e) => e.status === "agendada" || e.status === "em_andamento")
    .sort((a, b) =>
      `${a.data} ${a.hora ?? ""}`.localeCompare(`${b.data} ${b.hora ?? ""}`),
    )[0];
  const daProxima = proxima
    ? inscricoes.filter(
        (i) => i.etapaId === proxima.id && i.status !== "cancelada",
      )
    : [];
  const confirmadas = daProxima.filter((i) => i.status === "confirmada").length;
  const pendentes = daProxima.length - confirmadas;

  const soma = (status: string) =>
    inscricoes
      .filter((i) => i.pagamento?.status === status)
      .reduce((t, i) => t + (i.pagamento?.valorCentavos ?? 0), 0);
  const recursosAbertos = recursos.filter((r) => r.status === "aberto").length;
  const kartsAtivos = karts.filter((k) => k.status === "ativo").length;

  const lider = (categoriaId: string) =>
    resultados.classificacao
      .filter((c) => c.categoriaId === categoriaId)
      .sort((a, b) => a.posicao - b.posicao)
      .slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Painel gerencial"
        description={`${campeonato.nome} · temporada ${campeonato.temporada}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Pilotos" value={pilotos.length} />
        <StatCard
          label="Inscrições confirmadas"
          value={confirmadas}
          hint={proxima ? `na ${proxima.nome}` : "sem etapa aberta"}
        />
        <StatCard label="A receber" value={formatMoeda(soma("aguardando"))} />
        <StatCard label="Recebido" value={formatMoeda(soma("confirmado"))} />
        <StatCard label="Karts ativos" value={kartsAtivos} />
        <StatCard
          label="Recursos abertos"
          value={recursosAbertos}
          hint={recursosAbertos > 0 ? "aguardando decisão" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-ink text-sm font-medium">Próxima etapa</h2>
            <Link
              href="/admin/etapas"
              className="text-orange-ink text-xs font-medium hover:underline"
            >
              Etapas →
            </Link>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {proxima ? (
              <>
                <p className="font-display text-ink text-xl font-bold">
                  {proxima.nome}
                </p>
                <p className="text-orange-ink text-sm font-medium">
                  {formatDataEHora(proxima)}
                </p>
                <p className="text-ink-2 text-sm">
                  {proxima.kartodromo}, {proxima.cidade}
                </p>
                <p className="text-ink-2 text-sm">
                  {confirmadas} confirmado(s)
                  {pendentes > 0 ? ` · ${pendentes} aguardando pagamento` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Atalho href="/admin/inscricoes" rotulo="Inscrições" />
                  <Atalho href="/admin/baterias" rotulo="Baterias" />
                </div>
              </>
            ) : (
              <p className="text-ink-2 text-sm">
                Nenhuma etapa agendada. Cadastre em Etapas.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-ink text-sm font-medium">Ao vivo agora</h2>
            <Link
              href="/admin/live-timing"
              className="text-orange-ink text-xs font-medium hover:underline"
            >
              Live timing →
            </Link>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {vivo ? (
              <>
                <StatusPill tone="orange">
                  <span className="bg-orange h-1.5 w-1.5 animate-pulse rounded-full" />{" "}
                  AO VIVO
                </StatusPill>
                <p className="text-ink-2 text-sm">
                  <NomeCategoria
                    categoriaId={vivo.categoriaId}
                    className="inline-block rounded bg-[#0c1630] px-2 py-0.5"
                  >
                    {dados.categorias.find((c) => c.id === vivo.categoriaId)
                      ?.nome ?? vivo.categoriaId}
                  </NomeCategoria>{" "}
                  · {vivo.etapaNome}
                </p>
                <ol className="flex flex-col gap-1 text-sm">
                  {vivo.linhas.slice(0, 5).map((l, i) => (
                    <li
                      key={`${l.nome}-${i}`}
                      className="flex justify-between gap-3"
                    >
                      <span className="text-ink">
                        {l.posicao ?? "—"}º {l.nome}
                      </span>
                      <span className="text-ink-3">{l.voltas} volta(s)</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-ink-2 text-sm">
                Nenhuma bateria rolando neste momento.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-ink text-sm font-medium">
            Líderes por categoria
          </h2>
          <Link
            href="/admin/resultados"
            className="text-orange-ink text-xs font-medium hover:underline"
          >
            Classificação completa →
          </Link>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dados.categorias.map((c) => {
            const top = lider(c.id);
            return (
              <div key={c.id} className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold">
                  <NomeCategoria
                    categoriaId={c.id}
                    className="inline-block rounded bg-[#0c1630] px-2 py-0.5"
                  >
                    {c.nome}
                  </NomeCategoria>
                </p>
                {top.length === 0 ? (
                  <p className="text-ink-3 text-xs">Sem pilotos.</p>
                ) : (
                  <ol className="flex flex-col gap-0.5 text-sm">
                    {top.map((t) => {
                      const p = pilotos.find((x) => x.id === t.pilotoId);
                      return (
                        <li
                          key={t.pilotoId}
                          className="flex justify-between gap-3"
                        >
                          <span className="text-ink">
                            {t.posicao}º {p ? nomeExibicaoPiloto(p) : "—"}
                          </span>
                          <span className="text-orange-ink font-semibold">
                            {t.pontos}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Atalho href="/admin/balizamento" rotulo="Balizamento" />
        <Atalho href="/admin/pagamentos" rotulo="Pagamentos" />
        <Atalho href="/admin/punicoes" rotulo="Punições" />
        <Atalho href="/admin/relatorios" rotulo="Relatórios" />
      </div>
    </div>
  );
}
