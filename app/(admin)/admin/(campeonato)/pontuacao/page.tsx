import type { Metadata } from "next";
import Link from "next/link";
import { PontuacaoEditor } from "@/components/admin/resultados-admin";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { pode } from "@/lib/permissoes";
import { lerPontuacao } from "@/lib/resultados-campeonato-store";

export const metadata: Metadata = { title: "Pontuação" };
export const dynamic = "force-dynamic";

export default async function AdminPontuacaoPage() {
  const [campeonato, sessao] = await Promise.all([
    lerCampeonatoAtivo(),
    getSession(),
  ]);
  const config = campeonato ? await lerPontuacao(campeonato.id) : null;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pontuação"
        description="Tabela de pontos do campeonato: pontos por posição de chegada, pole, volta mais rápida e participação."
      />
      {!campeonato || !config ? (
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
        <>
          <PontuacaoEditor
            campeonatoId={campeonato.id}
            config={config}
            podeEditar={Boolean(
              sessao && pode(sessao.papel, "cadastro.gerenciar"),
            )}
          />
          <p className="text-ink-3 max-w-2xl text-xs">
            Ao salvar, a classificação é recalculada com a nova tabela, também
            para as corridas que já terminaram. DSQ e quem não largou não
            pontuam; as punições registradas em Punições entram na conta.
          </p>
        </>
      )}
    </div>
  );
}
