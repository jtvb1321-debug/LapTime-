import { NextResponse } from "next/server";
import { ipDoCliente } from "@/lib/ip";
import { parear } from "@/lib/cronometragem/computadores-store";
import { excedeuLimite } from "@/lib/limite-tentativas";
import { ErroNegocio } from "@/lib/operacao/erros";

// O agente do computador da pista troca o código de pareamento (gerado em
// /admin/cronometragem pelo administrador) pelo token do computador. O código
// vale 15 minutos e uma vez só; as tentativas por IP são limitadas.
export const dynamic = "force-dynamic";

const JANELA_MS = 10 * 60_000;
const MAXIMO_POR_IP = 10;
// Teto geral, independente do IP informado pelo cliente (o cabeçalho
// X-Forwarded-For pode ser forjado quando não há proxy na frente).
const MAXIMO_GERAL = 40;

export async function POST(request: Request) {
  const ip = ipDoCliente((nome) => request.headers.get(nome));
  if (
    excedeuLimite(`parear:${ip ?? "?"}`, MAXIMO_POR_IP, JANELA_MS) ||
    excedeuLimite("parear:geral", MAXIMO_GERAL, JANELA_MS)
  ) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  }
  let corpo: { codigo?: unknown; nome?: unknown; sistema?: unknown };
  try {
    corpo = JSON.parse((await request.text()) || "{}");
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  try {
    const resultado = await parear(
      typeof corpo.codigo === "string" ? corpo.codigo : "",
      {
        nome: typeof corpo.nome === "string" ? corpo.nome : undefined,
        sistema: typeof corpo.sistema === "string" ? corpo.sistema : undefined,
      },
      ip,
    );
    return NextResponse.json(resultado);
  } catch (erro) {
    if (erro instanceof ErroNegocio) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    console.error("[coletor] falha ao parear:", erro);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }
}
