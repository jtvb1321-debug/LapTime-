import { NextResponse } from "next/server";
import { consultar } from "@/lib/db/conexao";

export const dynamic = "force-dynamic";

const FOTO = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/;

// Foto pública do piloto (aparece no site). O endereço leva ?v=<tamanho>, que muda quando a foto
// muda; por isso o navegador pode guardar a resposta por muito tempo.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const linhas = await consultar<{ avatar_url: string | null }>(
    "select avatar_url from piloto where id = $1",
    [id],
  );
  const m = FOTO.exec(linhas[0]?.avatar_url ?? "");
  if (!m) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(m[2], "base64")), {
    headers: {
      "Content-Type": m[1],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
