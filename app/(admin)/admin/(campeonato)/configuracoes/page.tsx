import type { Metadata } from "next";
import Link from "next/link";
import { ImagemCampeonato } from "@/components/admin/imagem-campeonato";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { getSession } from "@/lib/auth";
import { lerImagemDoCampeonato } from "@/lib/campeonato-imagem-store";
import { campeonatos } from "@/lib/mock/data";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function AdminConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ campeonato?: string }>;
}) {
  const { campeonato: pedido } = await searchParams;
  const sessao = await getSession();
  const campeonato =
    campeonatos.find((c) => c.id === pedido) ??
    campeonatos.find((c) => c.ativo) ??
    campeonatos[0];
  const imagem = campeonato ? await lerImagemDoCampeonato(campeonato.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações do campeonato"
        description="Dados gerais e imagem de apresentação de cada campeonato."
      />

      {campeonatos.length > 1 ? (
        <nav aria-label="Campeonatos" className="flex flex-wrap gap-2">
          {campeonatos.map((c) => (
            <Link
              key={c.id}
              href={`/admin/configuracoes?campeonato=${encodeURIComponent(c.id)}`}
              aria-current={c.id === campeonato?.id ? "page" : undefined}
              className={
                c.id === campeonato?.id
                  ? "bg-orange text-on-orange flex min-h-11 items-center rounded-md px-3 text-sm font-medium md:min-h-9"
                  : "border-border-strong text-ink flex min-h-11 items-center rounded-md border px-3 text-sm md:min-h-9"
              }
            >
              {c.nome}
            </Link>
          ))}
        </nav>
      ) : null}

      {!campeonato ? (
        <Card>
          <CardBody>
            <p className="text-ink-2 text-sm">
              Nenhum campeonato cadastrado. Cadastre um em{" "}
              <span className="text-ink font-medium">Campeonatos</span>.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-ink text-sm font-semibold">Dados gerais</h2>
              <StatusPill tone="warning">Dados de demonstração</StatusPill>
            </CardHeader>
            <CardBody className="flex max-w-lg flex-col gap-3">
              <p className="text-ink-2 text-sm">
                O cadastro do campeonato ainda não é editável nem gravado no
                banco. Só a imagem abaixo é real.
              </p>
              <dl className="text-sm">
                <dt className="text-ink-3 text-xs">Nome</dt>
                <dd className="text-ink mb-2">{campeonato.nome}</dd>
                <dt className="text-ink-3 text-xs">Temporada</dt>
                <dd className="text-ink mb-2">{campeonato.temporada}</dd>
                <dt className="text-ink-3 text-xs">Descrição</dt>
                <dd className="text-ink">{campeonato.descricao}</dd>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-ink text-sm font-semibold">
                Imagem de apresentação · {campeonato.nome}
              </h2>
            </CardHeader>
            <CardBody>
              <ImagemCampeonato
                key={campeonato.id}
                campeonatoId={campeonato.id}
                nomeCampeonato={campeonato.nome}
                existente={Boolean(imagem)}
                altAtual={imagem?.alt ?? ""}
                versao={imagem?.atualizadoEm.getTime() ?? 0}
                podeEditar={
                  sessao ? pode(sessao.papel, "cadastro.gerenciar") : false
                }
              />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
