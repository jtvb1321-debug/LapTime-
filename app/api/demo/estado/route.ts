import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/auth";
import { lerPainelDemo } from "@/lib/demo-corrida";

// Estado da corrida de demonstração para o painel de controle (polling).
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await exigirPermissao("simulacao.alternar"))) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  return NextResponse.json(lerPainelDemo());
}
