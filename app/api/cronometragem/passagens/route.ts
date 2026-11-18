import { NextResponse } from "next/server";
import { ipDoCliente } from "@/lib/ip";
import {
  autenticarDecoder,
  registrarPassagens,
  validarDiagnostico,
  validarPassagens,
} from "@/lib/cronometragem/decoders-store";
import { ErroNegocio } from "@/lib/operacao/erros";

// Porta de entrada do coletor (coletor/): ele lê o decoder na rede da pista e
// manda as passagens pra cá. Autenticação por token do decoder (cadastrado em
// /admin/cronometragem), nunca por cookie de usuário — um cliente externo sem
// o token não consegue injetar passagens. Lote vazio = batimento. O corpo pode
// trazer também `estado` (decoder conectado?) e `eventos` (conexões, erros).
export const dynamic = "force-dynamic";

const MAX_BYTES = 512 * 1024;

export async function POST(request: Request) {
  const autorizacao = request.headers.get("authorization") ?? "";
  const token = autorizacao.startsWith("Bearer ")
    ? autorizacao.slice(7).trim()
    : "";
  const decoder = token ? await autenticarDecoder(token) : null;
  if (!decoder) {
    return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
  }

  const texto = await request.text();
  if (texto.length > MAX_BYTES) {
    return NextResponse.json({ erro: "Envio grande demais." }, { status: 413 });
  }
  let corpo: { passagens?: unknown; estado?: unknown; eventos?: unknown };
  try {
    corpo = JSON.parse(texto || "{}");
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  try {
    const { validas, rejeitadas } = validarPassagens(corpo.passagens ?? []);
    const { estado, eventos } = validarDiagnostico(corpo);
    const ip = ipDoCliente((nome) => request.headers.get(nome));
    const resultado = await registrarPassagens(decoder.id, validas, {
      rejeitadas,
      estado,
      eventos,
      ip,
    });
    return NextResponse.json({
      ...resultado,
      motivoRejeicao: rejeitadas[0]?.motivo,
    });
  } catch (erro) {
    if (erro instanceof ErroNegocio) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    console.error("[cronometragem] falha ao gravar passagens:", erro);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }
}
