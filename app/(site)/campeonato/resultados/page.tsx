import type { Metadata } from "next";
import { ResultadosDasBaterias } from "@/components/campeonato/resultados-das-baterias";
import { carregarCampeonatoAtivo } from "@/lib/dados-do-campeonato";

export const metadata: Metadata = { title: "Resultados" };
export const dynamic = "force-dynamic";

export default async function ResultadosPage() {
  const dados = await carregarCampeonatoAtivo();
  if (!dados) {
    return (
      <p className="text-ink-2 text-sm">
        Os resultados aparecem quando um campeonato estiver ativo.
      </p>
    );
  }
  return (
    <ResultadosDasBaterias
      baterias={dados.resultados.baterias}
      categorias={dados.categorias}
    />
  );
}
