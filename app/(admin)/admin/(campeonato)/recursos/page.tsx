import type { Metadata } from "next";
import Link from "next/link";
import { RecursosAdmin } from "@/components/admin/resultados-admin";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { pode } from "@/lib/permissoes";
import { lerRecursos } from "@/lib/resultados-campeonato-store";

export const metadata: Metadata = { title: "Recursos" };
export const dynamic = "force-dynamic";

export default async function AdminRecursosPage() {
  const [campeonato, sessao] = await Promise.all([
    lerCampeonatoAtivo(),
    getSession(),
  ]);
  const recursos = campeonato ? await lerRecursos(campeonato.id) : [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recursos"
        description="Contestações enviadas pelos pilotos. Responda com um parecer: deferido (aceito) ou indeferido (negado)."
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
        <RecursosAdmin
          recursos={recursos}
          podeEditar={Boolean(
            sessao && pode(sessao.papel, "cadastro.gerenciar"),
          )}
        />
      )}
    </div>
  );
}
