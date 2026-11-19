import type { Metadata } from "next";
import Link from "next/link";
import { BateriasAdmin } from "@/components/admin/baterias-admin";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { lerBateriasDoCampeonato } from "@/lib/baterias-campeonato-store";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { lerEtapasDoCampeonato } from "@/lib/etapas-store";
import { lerInscricoesDoCampeonato } from "@/lib/inscricoes-store";
import { categorias } from "@/lib/mock/data";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Baterias" };
export const dynamic = "force-dynamic";

export default async function AdminBateriasPage() {
  await aplicarAjustesDeCategoria();
  const [campeonato, sessao] = await Promise.all([
    lerCampeonatoAtivo(),
    getSession(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Baterias"
        description="Cada categoria da etapa vira uma bateria da cronometragem: classificação (define o grid) e depois a corrida."
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
        <Conteudo
          campeonatoId={campeonato.id}
          podeOperar={Boolean(sessao && pode(sessao.papel, "sessao.operar"))}
        />
      )}
    </div>
  );
}

async function Conteudo({
  campeonatoId,
  podeOperar,
}: {
  campeonatoId: string;
  podeOperar: boolean;
}) {
  const [etapas, baterias, inscricoes] = await Promise.all([
    lerEtapasDoCampeonato(campeonatoId),
    lerBateriasDoCampeonato(campeonatoId),
    lerInscricoesDoCampeonato(campeonatoId),
  ]);
  return (
    <BateriasAdmin
      etapas={etapas.map((e) => ({
        id: e.id,
        nome: e.nome,
        data: e.data,
        hora: e.hora ?? "",
        status: e.status,
        confirmados: inscricoes.filter(
          (i) => i.etapaId === e.id && i.status === "confirmada",
        ).length,
      }))}
      baterias={baterias}
      categorias={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
      podeOperar={podeOperar}
    />
  );
}
