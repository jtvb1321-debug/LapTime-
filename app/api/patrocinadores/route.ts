import { NextResponse } from "next/server";
import {
  lerPatrocinadores,
  salvarPatrocinadores,
} from "@/lib/patrocinadores-store";
import type { Patrocinador } from "@/lib/types";

// Usado pelo admin (components/admin/patrocinadores-table.tsx) pra ler e
// gravar o cadastro de patrocinadores — o overlay de transmissão lê o mesmo
// arquivo através de /api/overlay/*, então uma logo cadastrada aqui aparece
// lá sem depender do navegador que fez o cadastro.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await lerPatrocinadores());
}

export async function PUT(request: Request) {
  const lista = (await request.json()) as Patrocinador[];
  await salvarPatrocinadores(lista);
  return NextResponse.json(lista);
}
