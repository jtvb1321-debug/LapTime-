"use server";

import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "@/lib/audit";
import { getSession, ipDaRequisicao } from "@/lib/auth";
import {
  erroDoNascimento,
  FOTO_MAX_CARACTERES,
  idadeDe,
  limparTexto,
} from "@/lib/cadastro-validacao";
import { hojeEmSaoPaulo } from "@/lib/operacao/tempo";
import type { AcaoState } from "@/lib/operacao-actions";
import {
  atualizarPerfilDoPiloto,
  encontrarPilotoPorId,
  ErroDePerfil,
} from "@/lib/pilotos-store";

const FOTO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

// O piloto edita só o PRÓPRIO perfil: o piloto vem da sessão, nunca do formulário.
export async function atualizarMeuPerfilAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const sessao = await getSession();
  if (!sessao || sessao.papel !== "piloto" || !sessao.pilotoId) {
    return { erro: "Só o piloto pode editar o próprio perfil." };
  }
  const nome = limparTexto(dados.get("nome"));
  const apelido = limparTexto(dados.get("apelido"));
  const numero = Number(dados.get("numero"));
  const nascimento = limparTexto(dados.get("nascimento"));
  const foto = String(dados.get("fotoUrl") ?? "").trim();

  if (nome.length < 2 || nome.length > 80) {
    return { erro: "O nome deve ter de 2 a 80 caracteres." };
  }
  if (apelido.length < 2 || apelido.length > 30) {
    return { erro: "O apelido deve ter de 2 a 30 caracteres." };
  }
  if (!Number.isInteger(numero) || numero < 1 || numero > 999) {
    return { erro: "Escolha um número de 1 a 999." };
  }
  const hoje = hojeEmSaoPaulo();
  const erroData = erroDoNascimento(nascimento, hoje);
  if (erroData) return { erro: erroData };
  if (foto && (foto.length > FOTO_MAX_CARACTERES || !FOTO.test(foto))) {
    return { erro: "Foto inválida: use uma imagem PNG, JPG ou WEBP." };
  }

  const antes = await encontrarPilotoPorId(sessao.pilotoId);
  if (!antes) return { erro: "Piloto não encontrado." };
  try {
    await atualizarPerfilDoPiloto(
      sessao.pilotoId,
      { nome, apelido, numero, nascimento, avatarUrl: foto || undefined },
      idadeDe(nascimento, hoje),
    );
  } catch (e) {
    if (e instanceof ErroDePerfil) return { erro: e.message };
    throw e;
  }
  await registrarAuditoria({
    usuarioId: sessao.id,
    acao: "piloto.perfil_editar",
    entidade: "piloto",
    entidadeId: sessao.pilotoId,
    antes: { nome: antes.nome, apelido: antes.apelido, numero: antes.numero },
    depois: { nome, apelido, numero, nascimento, fotoTrocada: Boolean(foto) },
    ip: await ipDaRequisicao(),
  });
  revalidatePath("/admin/meu-perfil");
  revalidatePath("/area-do-piloto");
  revalidatePath(`/pilotos/${antes.slug}`);
  return { ok: "Perfil atualizado." };
}
