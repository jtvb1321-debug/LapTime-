import type { Metadata } from "next";
import Link from "next/link";
import { InscreverNaEtapa } from "@/components/site/inscrever-na-etapa";
import { getSession } from "@/lib/auth";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { etapasDoCampeonatoAtivo } from "@/lib/etapas-store";
import { lerInscricoesDoPiloto } from "@/lib/inscricoes-store";

export const metadata: Metadata = { title: "Inscrição" };
export const dynamic = "force-dynamic";

export default async function InscricaoPage() {
  const [sessao, campeonato, etapas] = await Promise.all([
    getSession(),
    lerCampeonatoAtivo(),
    etapasDoCampeonatoAtivo(),
  ]);
  const abertas = etapas.filter((e) => e.status === "agendada");
  const ehPiloto = sessao?.papel === "piloto" && Boolean(sessao.pilotoId);
  const minhas =
    ehPiloto && sessao?.pilotoId && campeonato
      ? await lerInscricoesDoPiloto(sessao.pilotoId, campeonato.id)
      : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-ink before:bg-orange text-3xl font-bold tracking-tight before:mb-2 before:block before:h-1 before:w-9 before:rounded-full before:content-['']">
          Inscrição
        </h1>
        <p className="text-ink-2 mt-1 text-sm">
          {campeonato
            ? `Inscreva-se nas etapas do ${campeonato.nome}.`
            : "Inscreva-se nas próximas etapas do campeonato."}
        </p>
      </div>

      {!campeonato || abertas.length === 0 ? (
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Nenhuma etapa aberta para inscrição no momento. Volte em breve.
        </p>
      ) : !sessao ? (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-5">
          <p className="text-ink text-sm">
            Entre na sua conta de piloto para se inscrever nas etapas.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login?redirectTo=/inscricao"
              className="bg-orange text-on-orange inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="border-border-strong text-ink inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium"
            >
              Quero me cadastrar
            </Link>
          </div>
        </div>
      ) : !ehPiloto ? (
        <p className="text-ink-2 text-sm">
          Esta conta não é de piloto. As inscrições são feitas pelo próprio
          piloto; a organização também pode inscrever em Inscrições, no painel.
        </p>
      ) : (
        <InscreverNaEtapa etapas={abertas} minhas={minhas} />
      )}
    </div>
  );
}
