import { NextResponse } from "next/server";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { criarPareamento } from "@/lib/cronometragem/computadores-store";
import { montarInstalador } from "@/lib/cronometragem/instalador-agente";
import { urlPublica } from "@/lib/url-publica";

// Instalador do agente para um computador novo: um .zip já com o endereço do
// sistema e um código de pareamento novo (15 minutos, uso único). Só POST
// (cria o código) e só para quem administra equipamentos.
export const dynamic = "force-dynamic";

export async function POST() {
  const sessao = await exigirPermissao("equipamento.administrar");
  if (!sessao) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  try {
    const { codigo } = await criarPareamento({
      usuarioId: sessao.id,
      ip: await ipDaRequisicao(),
    });
    const zip = await montarInstalador(await urlPublica(), codigo);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition":
          'attachment; filename="GridLap-Instalador-Agente.zip"',
        "cache-control": "no-store",
      },
    });
  } catch (erro) {
    console.error("[coletor] falha ao montar o instalador:", erro);
    return NextResponse.json({ erro: "Falha interna." }, { status: 500 });
  }
}
