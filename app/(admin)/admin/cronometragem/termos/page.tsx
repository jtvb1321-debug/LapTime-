import type { Metadata } from "next";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { TermosDaPista } from "@/components/cronometragem/termos-da-pista";
import { FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import {
  aguardandoTermo,
  termosPorBusca,
} from "@/lib/cronometragem/termos-da-pista";
import { pode } from "@/lib/permissoes";
import { cadastrarPilotoParaTermoAction } from "@/lib/termos-pista-actions";
import { urlPublica } from "@/lib/url-publica";

export const metadata: Metadata = { title: "Termos" };
export const dynamic = "force-dynamic";

export default async function TermosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeOperar = pode(sessao.papel, "sessao.operar");
  const q = String((await searchParams).q ?? "")
    .trim()
    .slice(0, 80);
  const base = await urlPublica();
  const [resultados, aguardando] = await Promise.all([
    q ? termosPorBusca(q, base) : Promise.resolve([]),
    aguardandoTermo(
      base,
      podeOperar
        ? { usuarioId: sessao.id, ip: await ipDaRequisicao() }
        : undefined,
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AtualizacaoPeriodica intervaloMs={5000} />
      <PageHeader
        title="Termos"
        description="O termo de responsabilidade é assinado antes da bateria, pelo cadastro do piloto. Sem termo válido, o piloto não larga."
      />

      <Card>
        <CardHeader>
          <h2 className="text-ink text-base font-semibold">Buscar piloto</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="q" className="text-ink text-sm font-medium">
                Nome, apelido, nº do cadastro ou telefone
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                autoComplete="off"
                className="campo w-full"
              />
            </div>
            <Button type="submit">Buscar</Button>
          </form>
          {q ? (
            <TermosDaPista
              itens={resultados}
              vazio="Ninguém encontrado. Cadastre o piloto abaixo."
              podeOperar={podeOperar}
            />
          ) : null}
        </CardBody>
      </Card>

      {podeOperar ? (
        <Card>
          <CardHeader>
            <h2 className="text-ink text-base font-semibold">Piloto novo</h2>
            <p className="text-ink-3 text-xs">
              Cadastra e já gera o link e o QR do termo. Se o nome e o telefone
              já existirem, usa o cadastro que existe.
            </p>
          </CardHeader>
          <CardBody>
            <FormAcao
              action={cadastrarPilotoParaTermoAction}
              rotulo="Cadastrar e gerar o termo"
              className="max-w-xl"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="novo-nome"
                    className="text-ink text-sm font-medium"
                  >
                    Nome completo
                  </label>
                  <input
                    id="novo-nome"
                    name="nome"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="off"
                    className="campo w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="novo-apelido"
                    className="text-ink text-sm font-medium"
                  >
                    Apelido (opcional)
                  </label>
                  <input
                    id="novo-apelido"
                    name="apelido"
                    maxLength={40}
                    autoComplete="off"
                    className="campo w-full"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label
                    htmlFor="novo-telefone"
                    className="text-ink text-sm font-medium"
                  >
                    Telefone com DDD (WhatsApp)
                  </label>
                  <input
                    id="novo-telefone"
                    name="telefone"
                    required
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="(11) 99999-0000"
                    className="campo w-full"
                  />
                </div>
              </div>
            </FormAcao>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-ink text-base font-semibold">
            Aguardando assinatura
          </h2>
          <p className="text-ink-3 text-xs">
            Pilotos que já estão em uma bateria aberta e ainda não têm termo
            válido.
          </p>
        </CardHeader>
        <CardBody>
          <TermosDaPista
            itens={aguardando}
            vazio="Nenhum piloto de bateria aberta está sem termo."
            podeOperar={podeOperar}
          />
        </CardBody>
      </Card>
    </div>
  );
}
