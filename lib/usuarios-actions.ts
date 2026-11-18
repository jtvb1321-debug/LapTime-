"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "@/lib/audit";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import type { AcaoState } from "@/lib/operacao-actions";
import { hashSenha } from "@/lib/senha";
import {
  encontrarUsuario,
  ErroDeUsuario,
  PAPEIS,
  trocarPapel,
  trocarSenha,
} from "@/lib/usuarios-store";
import type { PapelUsuario } from "@/lib/types";

// Alfabeto sem letras e números que se confundem (0/O, 1/l/I).
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function senhaAleatoria(tamanho = 12) {
  const bytes = randomBytes(tamanho);
  let s = "";
  for (let i = 0; i < tamanho; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return s;
}

// Só o administrador (permissão usuario.administrar) redefine senha e muda o acesso das contas.
export async function redefinirSenhaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const sessao = await exigirPermissao("usuario.administrar");
  if (!sessao) return { erro: "Você não tem permissão para esta ação." };
  const perfilId = String(dados.get("perfilId") ?? "");
  const digitada = String(dados.get("senha") ?? "");
  if (digitada && (digitada.length < 8 || digitada.length > 128)) {
    return { erro: "A senha deve ter de 8 a 128 caracteres." };
  }
  const alvo = await encontrarUsuario(perfilId);
  if (!alvo) return { erro: "Usuário não encontrado." };
  const senha = digitada || senhaAleatoria();
  try {
    await trocarSenha(perfilId, hashSenha(senha));
  } catch (e) {
    if (e instanceof ErroDeUsuario) return { erro: e.message };
    throw e;
  }
  // A senha nunca vai para a auditoria: só o fato de ter sido redefinida.
  await registrarAuditoria({
    usuarioId: sessao.id,
    acao: "usuario.senha_redefinir",
    entidade: "perfil",
    entidadeId: perfilId,
    depois: { email: alvo.email, gerada: !digitada },
    ip: await ipDaRequisicao(),
  });
  revalidatePath("/admin/usuarios");
  return {
    ok: digitada
      ? `Senha de ${alvo.email} redefinida. A conta foi desconectada.`
      : `Nova senha de ${alvo.email}: ${senha} — anote agora, ela não aparece de novo. A conta foi desconectada.`,
  };
}

export async function alterarAcessoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const sessao = await exigirPermissao("usuario.administrar");
  if (!sessao) return { erro: "Você não tem permissão para esta ação." };
  const perfilId = String(dados.get("perfilId") ?? "");
  const papel = String(dados.get("papel") ?? "") as PapelUsuario;
  if (!PAPEIS.some((p) => p.valor === papel)) {
    return { erro: "Escolha um acesso válido." };
  }
  if (perfilId === sessao.id) {
    return { erro: "Você não pode mudar o próprio acesso." };
  }
  const alvo = await encontrarUsuario(perfilId);
  if (!alvo) return { erro: "Usuário não encontrado." };
  if (alvo.papel === papel) return { ok: "Esse já é o acesso atual." };
  try {
    const { antes } = await trocarPapel(perfilId, papel);
    await registrarAuditoria({
      usuarioId: sessao.id,
      acao: "usuario.papel_alterar",
      entidade: "perfil",
      entidadeId: perfilId,
      antes: { papel: antes },
      depois: { papel, email: alvo.email },
      ip: await ipDaRequisicao(),
    });
  } catch (e) {
    if (e instanceof ErroDeUsuario) return { erro: e.message };
    throw e;
  }
  revalidatePath("/admin/usuarios");
  return {
    ok:
      papel === "admin"
        ? `${alvo.email} agora é administrador (acesso total).`
        : `Acesso de ${alvo.email} alterado.`,
  };
}
