import type { Metadata } from "next";
import Link from "next/link";
import { RecalcularBotao } from "@/components/admin/resultados-admin";
import { ClassificacaoCampeonato } from "@/components/campeonato/classificacao-campeonato";
import { ResultadosDasBaterias } from "@/components/campeonato/resultados-das-baterias";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { carregarCampeonatoAtivo } from "@/lib/dados-do-campeonato";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Resultados" };
export const dynamic = "force-dynamic";

export default async function AdminResultadosPage() {
  const [dados, sessao] = await Promise.all([
    carregarCampeonatoAtivo(),
    getSession(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resultados"
        description="Resultado oficial de cada corrida finalizada, com a conta dos pontos, e a classificação do campeonato."
      />
      {!dados ? (
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
          {sessao && pode(sessao.papel, "cadastro.gerenciar") ? (
            <RecalcularBotao />
          ) : null}
          <section className="flex flex-col gap-4">
            <h2 className="text-ink text-lg font-semibold">
              Classificação do campeonato
            </h2>
            <ClassificacaoCampeonato
              classificacao={dados.resultados.classificacao}
              pilotos={dados.pilotos}
              categorias={dados.categorias}
              etapas={dados.etapas}
            />
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="text-ink text-lg font-semibold">
              Resultados das corridas
            </h2>
            <ResultadosDasBaterias
              baterias={dados.resultados.baterias}
              categorias={dados.categorias}
              detalharPontos
            />
          </section>
        </>
      )}
    </div>
  );
}
