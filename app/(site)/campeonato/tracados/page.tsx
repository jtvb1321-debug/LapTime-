import type { Metadata } from "next";
import { TracadosLista } from "@/components/site/tracados-lista";
import { baterias, etapas, pilotos, resultados } from "@/lib/mock/data";

import { tracadosDoCampeonatoAtivo } from "@/lib/campeonatos-site";

export const metadata: Metadata = { title: "Traçados" };
export const dynamic = "force-dynamic";

export default async function TracadosPage() {
  const tracados = await tracadosDoCampeonatoAtivo();
  return (
    <TracadosLista
      tracadosIniciais={tracados}
      etapasIniciais={etapas}
      dadosCorrida={{ pilotos, baterias, resultados }}
    />
  );
}
