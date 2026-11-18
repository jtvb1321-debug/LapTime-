import { NextResponse } from "next/server";
import { autenticarComputador } from "@/lib/cronometragem/computadores-store";
import { provisionarDecoderDoComputador } from "@/lib/cronometragem/decoders-store";
import { ipDoCliente } from "@/lib/ip";
import { ErroNegocio } from "@/lib/operacao/erros";

// Plug-and-play: o agente do computador da pista detectou um decoder
// (ex.: CalX Pro) e pede o cadastro. Autenticado pelo token do COMPUTADOR
// (gl_pc_…); devolve o token do decoder para o agente começar a enviar as
// passagens, sem o operador copiar nada.
export const dynamic = "force-dynamic";

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
  if (texto.length > 4096) {
    return NextResponse.json({ erro: "Envio grande demais." }, { status: 413 });
  }
  let corpo: Record<string, unknown>;
  try {
    corpo = JSON.parse(texto || "{}");
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  try {
    const r = await provisionarDecoderDoComputador(
      computador.id,
      {
        driver: str(corpo.driver) ?? "",
        nome: str(corpo.nome),
        endereco: str(corpo.endereco),
        modelo: str(corpo.modelo),
      },
      ipDoCliente((nome) => request.headers.get(nome)),
    );
    return NextResponse.json({
      decoderId: r.id,
      token: r.token,
      criado: r.criado,
    });
  } catch (erro) {
    if (erro instanceof ErroNegocio) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    console.error("[coletor] falha ao cadastrar decoder:", erro);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }
}
