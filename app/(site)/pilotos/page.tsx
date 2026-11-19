import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import type { Metadata } from "next";
import { PilotosLista } from "@/components/site/pilotos-lista";
import { categorias } from "@/lib/mock/data";
import { lerPilotos } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Pilotos" };

export default async function PilotosPage() {
  await aplicarAjustesDeCategoria();
  const pilotos = await lerPilotos();
  return <PilotosLista categoriasIniciais={categorias} pilotos={pilotos} />;
}
