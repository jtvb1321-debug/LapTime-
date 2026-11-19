import type { Metadata } from "next";
import { TracadosLista } from "@/components/site/tracados-lista";
import { tracadosDoCampeonatoAtivo } from "@/lib/campeonatos-site";
import { etapasDoCampeonatoAtivo } from "@/lib/etapas-store";
import { baterias, pilotos, resultados } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Traçados" };
export const dynamic = "force-dynamic";

export default async function TracadosPage() {
  const [tracados, etapas] = await Promise.all([
    tracadosDoCampeonatoAtivo(),
    etapasDoCampeonatoAtivo(),
  ]);
  return (
    <TracadosLista
      tracadosIniciais={tracados}
      etapasIniciais={etapas}
      dadosCorrida={{ pilotos, baterias, resultados }}
    />
  );
}
