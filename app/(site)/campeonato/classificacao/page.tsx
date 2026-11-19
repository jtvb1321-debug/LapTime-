import type { Metadata } from "next";
import { ClassificacaoCampeonato } from "@/components/campeonato/classificacao-campeonato";
import { carregarCampeonatoAtivo } from "@/lib/dados-do-campeonato";

export const metadata: Metadata = { title: "Classificação" };
export const dynamic = "force-dynamic";

export default async function ClassificacaoPage() {
  const dados = await carregarCampeonatoAtivo();
  if (!dados) {
    return (
      <p className="text-ink-2 text-sm">
        A classificação aparece quando um campeonato estiver ativo.
      </p>
    );
  }
  return (
    <ClassificacaoCampeonato
      classificacao={dados.resultados.classificacao}
      pilotos={dados.pilotos}
      categorias={dados.categorias}
      etapas={dados.etapas}
    />
  );
}
