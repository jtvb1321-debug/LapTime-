import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import {
  lerCampeonatoAtivo,
  type CampeonatoCompleto,
} from "@/lib/campeonatos-store";
import { lerEtapasDoCampeonato } from "@/lib/etapas-store";
import { categorias } from "@/lib/mock/data";
import { lerPilotos } from "@/lib/pilotos-store";
import {
  atualizarClassificacaoDosPilotos,
  lerResultadosDoCampeonato,
  type ResultadosDoCampeonato,
} from "@/lib/resultados-campeonato-store";
import type { Etapa, Piloto } from "@/lib/types";

export interface DadosDoCampeonatoAtivo {
  campeonato: CampeonatoCompleto;
  resultados: ResultadosDoCampeonato;
  pilotos: Piloto[];
  etapas: Etapa[];
  // Categorias que fazem parte do campeonato (todas, se ainda não escolheu).
  categorias: { id: string; nome: string }[];
}

// Tudo que as telas de resultado/classificação precisam do campeonato ativo, numa chamada só.
// Também mantém a classificação gravada nos pilotos em dia. Sem campeonato ativo: null.
export async function carregarCampeonatoAtivo(): Promise<DadosDoCampeonatoAtivo | null> {
  await aplicarAjustesDeCategoria();
  const campeonato = await lerCampeonatoAtivo();
  if (!campeonato) return null;
  await atualizarClassificacaoDosPilotos();
  const [resultados, pilotos, etapas] = await Promise.all([
    lerResultadosDoCampeonato(campeonato.id),
    lerPilotos(),
    lerEtapasDoCampeonato(campeonato.id),
  ]);
  return {
    campeonato,
    resultados,
    pilotos: pilotos.filter((p) => campeonato.pilotoIds.includes(p.id)),
    etapas,
    categorias: categorias
      .filter(
        (c) =>
          campeonato.categoriaIds.length === 0 ||
          campeonato.categoriaIds.includes(c.id),
      )
      .map((c) => ({ id: c.id, nome: c.nome })),
  };
}
