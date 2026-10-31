import { NextResponse } from "next/server";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { ErroNegocio } from "@/lib/operacao/erros";
import {
  lerPatrocinadores,
  salvarPatrocinadores,
  validarPatrocinadores,
} from "@/lib/patrocinadores-store";
import type { Patrocinador } from "@/lib/types";

// Usado pelo admin (components/admin/patrocinadores-table.tsx) pra ler e
// gravar o cadastro de patrocinadores — o overlay de transmissão lê o mesmo
// banco através de /api/overlay/*, então uma logo cadastrada aqui aparece
// lá sem depender do navegador que fez o cadastro.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await lerPatrocinadores());
}

// Escrever exige login com permissão (antes qualquer pessoa podia
// sobrescrever a lista).
export async function PUT(request: Request) {
  const session = await exigirPermissao("cadastro.gerenciar");
  if (!session) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let lista: Patrocinador[];
  try {
    lista = validarPatrocinadores(await request.json());
  } catch (erro) {
    return NextResponse.json(
      {
        erro:
          erro instanceof ErroNegocio
            ? erro.message
            : "O corpo da requisição não é um JSON válido.",
      },
      { status: 400 },
    );
  }

  const antes = await lerPatrocinadores();
  await salvarPatrocinadores(lista);
  await registrarAuditoria({
    usuarioId: session.id,
    acao: "patrocinadores.salvar",
    entidade: "patrocinador",
    // Sem as logos (são imagens grandes): só ids, nomes e se estão ativos.
    antes: antes.map(({ id, nome, ativo }) => ({ id, nome, ativo })),
    depois: lista.map(({ id, nome, ativo }) => ({ id, nome, ativo })),
    ip: await ipDaRequisicao(),
  });
  return NextResponse.json(lista);
}
