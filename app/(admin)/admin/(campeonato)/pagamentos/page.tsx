import type { Metadata } from "next";
import Link from "next/link";
import { PagamentosAdmin } from "@/components/admin/pagamentos-admin";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { lerInscricoesDoCampeonato } from "@/lib/inscricoes-store";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Pagamentos" };
export const dynamic = "force-dynamic";

export default async function AdminPagamentosPage() {
  const [campeonato, sessao] = await Promise.all([
    lerCampeonatoAtivo(),
    getSession(),
  ]);
  const inscricoes = campeonato
    ? await lerInscricoesDoCampeonato(campeonato.id)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pagamentos"
        description="Pagamentos das inscrições: confirme quando receber (Pix, dinheiro ou cartão)."
      />
      {!campeonato ? (
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Não há campeonato ativo. Ative um em{" "}
          <Link
            href="/admin/campeonatos"
            className="text-orange-ink font-medium hover:underline"
          >
            Campeonatos
          </Link>
          .
        </p>
      ) : (
        <PagamentosAdmin
          inscricoes={inscricoes}
          podeEditar={Boolean(
            sessao && pode(sessao.papel, "cadastro.gerenciar"),
          )}
          podeEstornar={Boolean(sessao && pode(sessao.papel, "caixa.estornar"))}
        />
      )}
    </div>
  );
}
