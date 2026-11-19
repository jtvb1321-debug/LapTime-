import type { Metadata } from "next";
import Link from "next/link";
import { EtapasDoCampeonato } from "@/components/admin/campeonato-passos";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { lerEtapasDoCampeonato } from "@/lib/etapas-store";
import { pode } from "@/lib/permissoes";
import { lerTracados } from "@/lib/tracados-store";

export const metadata: Metadata = { title: "Etapas" };
export const dynamic = "force-dynamic";

export default async function AdminEtapasPage() {
  const [campeonato, sessao, tracados] = await Promise.all([
    lerCampeonatoAtivo(),
    getSession(),
    lerTracados(),
  ]);
  const podeEditar = Boolean(
    sessao && pode(sessao.papel, "cadastro.gerenciar"),
  );
  const etapas = campeonato ? await lerEtapasDoCampeonato(campeonato.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Etapas"
        description={
          campeonato
            ? `Calendário do campeonato ativo: ${campeonato.nome}.`
            : "Etapas do campeonato."
        }
      />
      {!campeonato ? (
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Não há campeonato ativo. As etapas são cadastradas dentro de cada
          campeonato, em{" "}
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
          <EtapasDoCampeonato
            key={etapas.map((e) => e.id + e.data + e.hora + e.status).join(",")}
            campeonatoId={campeonato.id}
            etapas={etapas}
            tracados={tracados.filter((t) =>
              campeonato.tracadoIds.includes(t.id),
            )}
            podeEditar={podeEditar}
          />
          <p className="text-ink-3 text-xs">
            Para outro campeonato, abra-o em{" "}
            <Link
              href="/admin/campeonatos"
              className="text-orange-ink font-medium hover:underline"
            >
              Campeonatos
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
