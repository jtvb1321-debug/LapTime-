import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { encontrarPilotoPorId } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Área do piloto" };

export default async function AreaDoPilotoPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/area-do-piloto");

  const piloto = session.pilotoId
    ? await encontrarPilotoPorId(session.pilotoId)
    : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-ink text-2xl font-semibold">Área do piloto</h1>
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
              className="text-orange text-sm font-medium hover:underline"
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
                <p className="text-ink-3 font-mono text-sm">#{piloto.numero}</p>
                <p className="text-ink text-lg font-medium">
                  {nomeExibicaoPiloto(piloto)}
                </p>
                <p className="text-ink-2 text-sm">
                  {getCategoriaById(piloto.categoriaId)?.nome}
                </p>
              </div>
              <Link
                href={`/pilotos/${piloto.slug}`}
                className="text-orange text-sm font-medium hover:underline"
              >
                Ver perfil público →
              </Link>
            </CardBody>
          </Card>

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
                          <span className="text-ink font-mono text-sm">
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
