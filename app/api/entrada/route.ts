import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, podeAcessarAdmin } from "@/lib/auth";
import { COOKIE_ENTRADA } from "@/lib/entrada";

export const dynamic = "force-dynamic";

// Chamada pela animação de entrada: confirma a sessão no servidor e encerra a
// animação (apaga o cookie). Sem sessão válida devolve 401.
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ erro: "Sessão inválida." }, { status: 401 });
  }
  (await cookies()).delete(COOKIE_ENTRADA);
  return NextResponse.json({
    ok: true,
    painel: podeAcessarAdmin(session.papel),
  });
}
