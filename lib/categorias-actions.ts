"use server";

import { revalidatePath } from "next/cache";
import { registrarAuditoria } from "@/lib/audit";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { limparTexto } from "@/lib/cadastro-validacao";
import {
  aplicarAjustesDeCategoria,
  categoriaExiste,
  salvarAjusteDeCategoria,
} from "@/lib/categorias-store";
import { getCategoriaById } from "@/lib/mock/data";
import type { AcaoState } from "@/lib/operacao-actions";

// Edita nome, descrição e peso mínimo de uma categoria (o id, o nível e a cor não mudam).
export async function editarCategoriaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const sessao = await exigirPermissao("cadastro.gerenciar");
  if (!sessao)
    return { erro: "Você não tem permissão para editar categorias." };

  const id = String(dados.get("id") ?? "");
  const nome = limparTexto(dados.get("nome"));
  const descricao = limparTexto(dados.get("descricao"));
  const pesoTexto = String(dados.get("pesoMinimoKg") ?? "").trim();
  const peso = pesoTexto === "" ? 0 : Number(pesoTexto);

  if (!categoriaExiste(id)) return { erro: "Categoria não encontrada." };
  if (nome.length < 2 || nome.length > 40) {
    return { erro: "O nome deve ter de 2 a 40 caracteres." };
  }
  if (descricao.length > 300) {
    return { erro: "A descrição pode ter até 300 caracteres." };
  }
  if (!Number.isInteger(peso) || peso < 0 || peso > 300) {
    return { erro: "O peso mínimo deve ser um número inteiro de 0 a 300 kg." };
  }

  await aplicarAjustesDeCategoria();
  const antes = getCategoriaById(id);
  try {
    await salvarAjusteDeCategoria(
      id,
      { nome, descricao, pesoMinimoKg: peso },
      sessao.id,
    );
  } catch {
    return {
      erro: "Não foi possível salvar. Se o erro continuar, avise o suporte (a tabela de ajustes pode não estar criada).",
    };
  }
  await registrarAuditoria({
    usuarioId: sessao.id,
    acao: "categoria.editar",
    entidade: "categoria",
    entidadeId: id,
    antes: antes && {
      nome: antes.nome,
      descricao: antes.descricao,
      pesoMinimoKg: antes.pesoMinimoKg,
    },
    depois: { nome, descricao, pesoMinimoKg: peso },
    ip: await ipDaRequisicao(),
  });
  for (const caminho of [
    "/admin/categorias",
    "/admin/pilotos",
    "/categorias",
    "/",
    "/cadastro",
  ]) {
    revalidatePath(caminho);
  }
  return { ok: "Categoria atualizada." };
}
