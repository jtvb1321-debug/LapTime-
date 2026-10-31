import { revalidatePath } from "next/cache";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";
import type { AcaoState } from "@/lib/operacao-actions";
import type { Permissao } from "@/lib/permissoes";

export function textoDoForm(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? "").trim();
}

// Mesma regra das ações do balcão: permissão conferida no servidor, erro de
// regra vira mensagem, falha técnica vai só pro log.
export async function executarAcao(
  permissao: Permissao,
  fn: (ator: Ator) => Promise<string | void>,
): Promise<AcaoState> {
  const sessao = await exigirPermissao(permissao);
  if (!sessao) return { erro: "Você não tem permissão para esta ação." };
  try {
    const ok = await fn({ usuarioId: sessao.id, ip: await ipDaRequisicao() });
    revalidatePath("/admin/cronometragem", "layout");
    return { ok: ok || "Feito." };
  } catch (erro) {
    if (erro instanceof ErroNegocio) return { erro: erro.message };
    console.error("[cronometragem] falha inesperada:", erro);
    return { erro: "Não foi possível concluir. Tente de novo." };
  }
}
