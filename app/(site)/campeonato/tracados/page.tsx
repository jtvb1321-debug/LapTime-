import type { Metadata } from "next";
import { TracadosLista } from "@/components/site/tracados-lista";
import { etapas, tracados } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Traçados" };

export default function TracadosPage() {
  return <TracadosLista tracadosIniciais={tracados} etapasIniciais={etapas} />;
}
