import type { Metadata } from "next";
import { CalendarioLista } from "@/components/site/calendario-lista";
import { etapas, tracados } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Calendário" };

export default function CalendarioPage() {
  return (
    <CalendarioLista etapasIniciais={etapas} tracadosIniciais={tracados} />
  );
}
