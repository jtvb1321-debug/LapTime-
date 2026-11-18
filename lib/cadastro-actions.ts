"use server";

import { redirect } from "next/navigation";
import { ipDaRequisicao, iniciarSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import {
  cadastrarPilotoComPerfil,
  ehViolacaoDeUnicidade,
} from "@/lib/cadastro-store";
import { fotoCorpoValida, salvarApresentacao } from "@/lib/apresentacao-store";
import { excedeuLimite } from "@/lib/limite-tentativas";
import { lerPilotos } from "@/lib/pilotos-store";
import { emailJaCadastrado } from "@/lib/perfis-store";
import {
  corValida,
  erroDoCadastro,
  limparTexto,
} from "@/lib/cadastro-validacao";
import { hashSenha } from "@/lib/senha";
import { ESTADOS_BRASIL } from "@/lib/estados-brasil";
import type { Perfil, Piloto } from "@/lib/types";

export type CadastroState = { erro?: string };

function gerarSlug(nome: string, sufixo: string) {
  const base = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return `${base}-${sufixo}`;
}

export async function cadastroPilotoMockAction(
  _prevState: CadastroState,
  formData: FormData,
): Promise<CadastroState> {
  // Freio contra cadastros em massa (robôs): poucas contas por IP na janela.
  if (
    excedeuLimite(`cadastro:${(await ipDaRequisicao()) ?? "?"}`, 8, 60 * 60_000)
  ) {
    return {
      erro: "Muitas tentativas de cadastro. Aguarde um pouco e tente de novo.",
    };
  }
  const nome = limparTexto(formData.get("nome"));
  const apelido = limparTexto(formData.get("apelido"));
  const email = limparTexto(formData.get("email"));
  const senha = String(formData.get("senha") ?? "");
  const idade = Number(formData.get("idade"));
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const pesoKg = Number(formData.get("pesoKg"));
  const uf = String(formData.get("uf") ?? "");
  const numero = Number(formData.get("numero"));
  const corNumero = corValida(
    limparTexto(formData.get("corNumero")),
    "#8b5cf6",
  );
  const corAssinatura = corValida(
    limparTexto(formData.get("corAssinatura")),
    "#f2f5f7",
  );
  const fotoUrl = String(formData.get("fotoUrl") ?? "").trim();
  const fotoCorpo = String(formData.get("fotoCorpo") ?? "").trim();

  if (!nome || !apelido || !email || !senha || !categoriaId || !uf) {
    return { erro: "Preencha todos os campos obrigatórios." };
  }
  const erro = erroDoCadastro({
    nome,
    apelido,
    email,
    senha,
    idade,
    pesoKg,
    fotoUrl,
  });
  if (erro) return { erro };
  if (fotoCorpo && !fotoCorpoValida(fotoCorpo)) {
    return { erro: "Foto de macacão inválida. Envie a foto de novo." };
  }
  if (!Number.isInteger(numero) || numero < 1 || numero > 999) {
    return { erro: "Escolha um número de 1 a 999." };
  }
  // Sem checar contra lib/mock/data.ts aqui: categorias criadas no admin
  // ficam no localStorage do navegador (ver useMockStore), e uma server
  // action não tem acesso a isso — o próprio <select> do formulário já
  // garante que só um id de categoria existente é enviado.
  if (!ESTADOS_BRASIL.some((e) => e.sigla === uf)) {
    return { erro: "Selecione um estado válido." };
  }
  if (await emailJaCadastrado(email)) {
    return { erro: "Já existe uma conta com esse e-mail." };
  }
  if ((await lerPilotos()).some((p) => p.numero === numero)) {
    return { erro: `O número ${numero} já está em uso por outro piloto.` };
  }

  const pilotoId = `piloto-${Date.now()}`;
  const posicaoInicial = (await lerPilotos()).length + 1;

  const novoPiloto: Piloto = {
    id: pilotoId,
    nome,
    apelido,
    slug: gerarSlug(apelido, pilotoId.slice(-6)),
    numero,
    categoriaId,
    uf,
    idade,
    pesoKg,
    avatarUrl: fotoUrl || undefined,
    corNumero,
    corAssinatura,
    vitorias: 0,
    podios: 0,
    pontos: 0,
    posicaoCampeonato: posicaoInicial,
  };

  const novoPerfil: Perfil = {
    id: `perfil-${pilotoId}`,
    userId: `user-${pilotoId}`,
    nome: apelido,
    email,
    papel: "piloto",
    pilotoId,
    avatarUrl: fotoUrl || undefined,
    senhaHash: hashSenha(senha),
  };

  try {
    await cadastrarPilotoComPerfil(novoPiloto, novoPerfil);
  } catch (erro) {
    // Dois cadastros simultâneos com o mesmo e-mail/slug: o banco barra o
    // segundo e nada fica pela metade.
    if (ehViolacaoDeUnicidade(erro)) {
      return { erro: "Já existe uma conta com esse e-mail." };
    }
    throw erro;
  }

  // O vídeo de apresentação não pode impedir o cadastro: se algo falhar aqui, a conta já existe e
  // a foto pode ser enviada de novo depois.
  if (fotoCorpo) {
    try {
      await salvarApresentacao(pilotoId, fotoCorpo, corAssinatura);
    } catch (e) {
      console.error("apresentacao: não foi possível salvar", e);
    }
  }

  await registrarAuditoria({
    usuarioId: novoPerfil.id,
    acao: "cadastro.piloto",
    entidade: "piloto",
    entidadeId: pilotoId,
    depois: { nome, apelido, numero, categoriaId, uf },
    ip: await ipDaRequisicao(),
  });
  await iniciarSessao(novoPerfil);

  redirect("/area-do-piloto");
}
