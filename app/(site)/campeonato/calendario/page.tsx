import type { Metadata } from "next";
import { CalendarioLista } from "@/components/site/calendario-lista";
import { tracadosDoCampeonatoAtivo } from "@/lib/campeonatos-site";
import { etapas } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Calendário" };
export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const tracados = await tracadosDoCampeonatoAtivo();
  return (
    <CalendarioLista etapasIniciais={etapas} tracadosIniciais={tracados} />
  );
}
