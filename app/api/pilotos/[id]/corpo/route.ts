import { NextResponse } from "next/server";
import { lerFotoCorpo } from "@/lib/apresentacao-store";

export const dynamic = "force-dynamic";

// Recorte do piloto usado no vídeo de apresentação (aparece no site). O endereço leva ?v=<tamanho>,
// que muda quando a foto muda; por isso o navegador pode guardar a resposta por muito tempo.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const foto = await lerFotoCorpo(id);
  if (!foto) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(foto.bytes), {
    headers: {
      "Content-Type": foto.tipo,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
