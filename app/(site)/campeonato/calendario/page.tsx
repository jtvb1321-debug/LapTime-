import type { Metadata } from "next";
import { CalendarioLista } from "@/components/site/calendario-lista";
import { tracadosDoCampeonatoAtivo } from "@/lib/campeonatos-site";
import { etapasDoCampeonatoAtivo } from "@/lib/etapas-store";

export const metadata: Metadata = { title: "Calendário" };
export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const [tracados, etapas] = await Promise.all([
    tracadosDoCampeonatoAtivo(),
    etapasDoCampeonatoAtivo(),
  ]);
  return (
    <CalendarioLista etapasIniciais={etapas} tracadosIniciais={tracados} />
  );
}
