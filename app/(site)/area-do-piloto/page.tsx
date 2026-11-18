import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EntradaGrid } from "@/components/entrada/entrada-grid";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill, toneParaStatus } from "@/components/ui/status-pill";
import { logoutAction } from "@/lib/auth-actions";
import { getSession, podeAcessarAdmin } from "@/lib/auth";
import {
  formatMoeda,
  getCategoriaById,
  inscricoes,
  nomeExibicaoPiloto,
  pagamentos,
} from "@/lib/mock/data";
import { EnviarApresentacao } from "@/components/pilotos/enviar-apresentacao";
import { lerApresentacao } from "@/lib/apresentacao-store";
import { encontrarPilotoPorId } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Área do piloto" };

export default async function AreaDoPilotoPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/area-do-piloto");

  const piloto = session.pilotoId
    ? await encontrarPilotoPorId(session.pilotoId)
    : undefined;
  const apresentacao = piloto ? await lerApresentacao(piloto.id) : null;

  return (
    <div className="flex flex-col gap-8">
      <EntradaGrid />
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="font-display text-ink before:bg-orange text-3xl font-bold tracking-tight before:mb-2 before:block before:h-1 before:w-9 before:rounded-full before:content-['']">
            Área do piloto
          </h1>
          <p className="text-ink-2 mt-1 text-sm">
            Logado como {session.nome} ({session.papel})
          </p>
        </div>
        <form action={logoutAction}>
          <button className="text-ink-2 hover:text-ink text-sm font-medium">
            Sair
          </button>
        </form>
      </div>

      {podeAcessarAdmin(session.papel) ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink-2 text-sm">
              Este perfil ({session.papel}) tem acesso ao painel administrativo.
            </p>
            <Link
              href="/admin"
              className="text-orange-ink text-sm font-medium hover:underline"
            >
              Ir para o admin →
            </Link>
          </CardBody>
        </Card>
      ) : null}

      {!piloto ? (
        <p className="text-ink-2 text-sm">
          Este perfil ({session.papel}) não está vinculado a um piloto. Entre
          com a conta de demonstração jhonattan@gridlap.com.br para ver o
          exemplo de área do piloto.
        </p>
      ) : (
        <>
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-ink-3 font-display text-sm">
                  #{piloto.numero}
                </p>
                <p className="text-ink text-lg font-medium">
                  {nomeExibicaoPiloto(piloto)}
                </p>
                <p className="text-ink-2 text-sm">
                  {getCategoriaById(piloto.categoriaId)?.nome}
                </p>
              </div>
              <Link
                href={`/pilotos/${piloto.slug}`}
                className="text-orange-ink text-sm font-medium hover:underline"
              >
                Ver perfil público →
              </Link>
            </CardBody>
          </Card>

          <Link href="/admin/meu-perfil">
            <Card>
              <CardBody>
                <p className="text-ink font-medium">Editar meu perfil</p>
                <p className="text-ink-3 text-xs">
                  Nome, número, data de nascimento e foto
                </p>
              </CardBody>
            </Card>
          </Link>

          <section className="flex flex-col gap-3">
            <h2 className="text-ink text-base font-semibold">Acompanhar</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [
                  "/admin/pista-e-baterias",
                  "Pista e baterias",
                  "Ao vivo e resultados",
                ],
                ["/admin/campeonatos", "Campeonato", "Estrutura do campeonato"],
                [
                  "/admin/resultados",
                  "Classificação",
                  "Resultados e pontuação",
                ],
              ].map(([href, titulo, texto]) => (
                <Link key={href} href={href}>
                  <Card>
                    <CardBody>
                      <p className="text-ink font-medium">{titulo}</p>
                      <p className="text-ink-3 text-xs">{texto}</p>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-ink text-base font-semibold">
              Meu vídeo de apresentação
            </h2>
            <Card>
              <CardBody>
                <EnviarApresentacao
                  numero={piloto.numero}
                  nome={piloto.nome}
                  corDestaque={piloto.corNumero ?? "#facc15"}
                  corFaixa={piloto.corAssinatura ?? "#f2f5f7"}
                  temVideo={Boolean(apresentacao)}
                  slug={piloto.slug}
                />
              </CardBody>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-ink text-base font-semibold">
              Minhas inscrições
            </h2>
            <div className="flex flex-col gap-2">
              {inscricoes
                .filter((i) => i.pilotoId === piloto.id)
                .map((inscricao) => {
                  const pagamento = pagamentos.find(
                    (p) => p.inscricaoId === inscricao.id,
                  );
                  return (
                    <Card key={inscricao.id}>
                      <CardBody className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <StatusPill tone={toneParaStatus(inscricao.status)}>
                            {inscricao.status}
                          </StatusPill>
                          <span className="text-ink-2 text-sm">
                            Inscrição de {inscricao.criadaEm}
                          </span>
                        </div>
                        {pagamento ? (
                          <span className="text-ink font-display text-sm">
                            {formatMoeda(pagamento.valorCentavos)} ·{" "}
                            {pagamento.status}
                          </span>
                        ) : null}
                      </CardBody>
                    </Card>
                  );
                })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
