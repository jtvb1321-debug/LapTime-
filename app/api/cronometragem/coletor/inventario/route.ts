import { NextResponse } from "next/server";
import {
  autenticarComputador,
  registrarInventario,
  validarInventario,
} from "@/lib/cronometragem/computadores-store";
import { ErroNegocio } from "@/lib/operacao/erros";

// O agente do computador da pista manda aqui, a cada poucos segundos, a lista
// do que está ligado nele (USB, portas seriais, aparelhos na rede). Autenticado
// pelo token do computador (pareado em /admin/cronometragem).
export const dynamic = "force-dynamic";

const MAX_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const autorizacao = request.headers.get("authorization") ?? "";
  const token = autorizacao.startsWith("Bearer ")
    ? autorizacao.slice(7).trim()
    : "";
  const computador = token ? await autenticarComputador(token) : null;
  if (!computador) {
    return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
  }
  const texto = await request.text();
  if (texto.length > MAX_BYTES) {
    return NextResponse.json({ erro: "Envio grande demais." }, { status: 413 });
  }
  let corpo: { dispositivos?: unknown };
  try {
    corpo = JSON.parse(texto || "{}");
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  try {
    const dispositivos = validarInventario(corpo.dispositivos ?? []);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    await registrarInventario(computador.id, dispositivos, ip);
    return NextResponse.json({ ok: true, dispositivos: dispositivos.length });
  } catch (erro) {
    if (erro instanceof ErroNegocio) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    console.error("[coletor] falha ao gravar inventário:", erro);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }
}
