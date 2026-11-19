import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "@/lib/audit";
import { exigirPermissao, getSession, ipDaRequisicao } from "@/lib/auth";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { AcaoState } from "@/lib/operacao-actions";
import type { Permissao } from "@/lib/permissoes";

interface Opcoes {
  // Permissão do painel exigida; sem ela, só vale quem estiver logado como piloto (`comoPiloto`).
  permissao?: Permissao;
  comoPiloto?: boolean;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  depois?: unknown;
  caminhos: string[];
  mensagemOk: string;
}

// Roda a operação com permissão, auditoria e mensagem de erro amigável (usado nas ações de inscrição
// e pagamento). `operacao` recebe quem está logado (id e, se for piloto, o pilotoId).
export async function executarAuditado(
  o: Opcoes,
  operacao: (quem: {
    usuarioId: string;
    pilotoId?: string | null;
  }) => Promise<void>,
): Promise<AcaoState> {
  const sessao = o.permissao
    ? await exigirPermissao(o.permissao)
    : await getSession();
  if (!sessao || (o.comoPiloto && sessao.papel !== "piloto")) {
    return { erro: "Você não tem permissão para fazer isso." };
  }
  try {
    await operacao({ usuarioId: sessao.id, pilotoId: sessao.pilotoId });
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message };
    return {
      erro: "Não foi possível concluir. Tente de novo; se continuar, avise o suporte.",
    };
  }
  await registrarAuditoria({
    usuarioId: sessao.id,
    acao: o.acao,
    entidade: o.entidade,
    entidadeId: o.entidadeId,
    depois: o.depois,
    ip: await ipDaRequisicao(),
  });
  for (const c of o.caminhos) revalidatePath(c);
  return { ok: o.mensagemOk };
}
