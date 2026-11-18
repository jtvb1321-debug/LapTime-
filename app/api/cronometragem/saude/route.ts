import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/auth";
import { consultar } from "@/lib/db/conexao";

// Sonda leve da fonte de dados da tela ao vivo. Responde SÓ a uma pergunta: "o servidor e o
// banco estão atendendo agora?". Isso NÃO diz nada sobre o decoder (que é confirmado à parte,
// pelo estado que o coletor reporta) nem garante que os dados estejam atualizados (isso só é
// confirmado quando uma atualização realmente chega à tela).
// A tela a consulta antes de cada atualização: se falhar, ela NÃO tenta recarregar (o que
// apagaria a classificação) e mantém a última conhecida, avisando.
// Exige login com permissão de ver a cronometragem e devolve apenas { ok }: sem dados da
// prova, sem nomes, sem versões, sem o motivo técnico da falha.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await exigirPermissao("cronometragem.ver"))) {
    return NextResponse.json(
      { ok: false },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    await consultar("select 1");
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
