import { NextResponse } from "next/server";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { IMAGEM_MAX_BYTES } from "@/lib/campeonato-imagem";
import {
  lerBytesDaImagem,
  removerImagemDoCampeonato,
  salvarImagemDoCampeonato,
} from "@/lib/campeonato-imagem-store";
import { ErroNegocio } from "@/lib/operacao/erros";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

// Pública (aparece no site). 404 quando o campeonato não tem imagem: a tela
// mostra o estado padrão. A imagem sempre vem do campeonato do endereço.
export async function GET(request: Request, { params }: Contexto) {
  const { id } = await params;
  const img = await lerBytesDaImagem(id);
  if (!img) return new NextResponse(null, { status: 404 });
  const etag = `"${img.atualizado_em.getTime()}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }
  return new NextResponse(new Uint8Array(img.dados), {
    headers: {
      "Content-Type": img.tipo_mime,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: etag,
    },
  });
}

// Enviar/substituir e remover: só quem gerencia cadastros.
export async function PUT(request: Request, { params }: Contexto) {
  const sessao = await exigirPermissao("cadastro.gerenciar");
  if (!sessao) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 401 });
  }
  const { id } = await params;
  const tamanhoDeclarado = Number(request.headers.get("content-length") ?? 0);
  if (tamanhoDeclarado > IMAGEM_MAX_BYTES + 64 * 1024) {
    return NextResponse.json(
      { erro: "A imagem passa de 2 MB." },
      { status: 413 },
    );
  }
  let dados: FormData;
  try {
    dados = await request.formData();
  } catch {
    return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });
  }
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: "Escolha uma imagem." }, { status: 400 });
  }
  try {
    await salvarImagemDoCampeonato(
      id,
      new Uint8Array(await arquivo.arrayBuffer()),
      String(dados.get("alt") ?? ""),
      { usuarioId: sessao.id, ip: await ipDaRequisicao() },
    );
  } catch (erro) {
    if (erro instanceof ErroNegocio) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    throw erro;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const sessao = await exigirPermissao("cadastro.gerenciar");
  if (!sessao) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 401 });
  }
  const { id } = await params;
  try {
    await removerImagemDoCampeonato(id, {
      usuarioId: sessao.id,
      ip: await ipDaRequisicao(),
    });
  } catch (erro) {
    if (erro instanceof ErroNegocio) {
      return NextResponse.json({ erro: erro.message }, { status: 400 });
    }
    throw erro;
  }
  return NextResponse.json({ ok: true });
}
