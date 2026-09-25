"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { paraSessao, sessionCookieName } from "@/lib/auth";
import { adicionarPiloto, lerPilotos } from "@/lib/pilotos-store";
import { adicionarPerfil, emailJaCadastrado } from "@/lib/perfis-store";
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
  const nome = String(formData.get("nome") ?? "").trim();
  const apelido = String(formData.get("apelido") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const idade = Number(formData.get("idade"));
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const pesoKg = Number(formData.get("pesoKg"));
  const uf = String(formData.get("uf") ?? "");
  const numero = Number(formData.get("numero"));
  const corNumero = String(formData.get("corNumero") ?? "") || "#8b5cf6";
  const corAssinatura =
    String(formData.get("corAssinatura") ?? "") || "#f2f5f7";
  const fotoUrl = String(formData.get("fotoUrl") ?? "");

  if (!nome || !apelido || !email || !senha || !categoriaId || !uf) {
    return { erro: "Preencha todos os campos obrigatórios." };
  }
  if (senha.length < 6) {
    return { erro: "A senha precisa ter pelo menos 6 caracteres." };
  }
  if (!Number.isFinite(idade) || idade <= 0) {
    return { erro: "Informe uma idade válida." };
  }
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    return { erro: "Informe um peso válido." };
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

  await adicionarPiloto(novoPiloto);
  await adicionarPerfil(novoPerfil);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), JSON.stringify(paraSessao(novoPerfil)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/area-do-piloto");
}
