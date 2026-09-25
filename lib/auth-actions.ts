"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  findPerfilPorEmail,
  paraSessao,
  podeAcessarAdmin,
  sessionCookieName,
} from "@/lib/auth";
import { verificarSenha } from "@/lib/senha";

export type LoginState = { erro?: string };

export async function loginMockAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const perfil = await findPerfilPorEmail(email);
  if (!perfil) {
    return { erro: "Não existe conta com esse e-mail." };
  }

  // Contas de demonstração não têm senha real (aceitam qualquer uma) — só
  // quem se cadastrou de verdade em /cadastro tem senhaHash, e aí a senha
  // precisa bater.
  if (perfil.senhaHash && !verificarSenha(senha, perfil.senhaHash)) {
    return { erro: "Senha incorreta." };
  }

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), JSON.stringify(paraSessao(perfil)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  if (redirectTo.startsWith("/admin") && !podeAcessarAdmin(perfil.papel)) {
    redirect("/area-do-piloto");
  }

  // Quem só tem acesso ao admin não tem nada pra ver em /area-do-piloto — a
  // rota genérica do header do site leva pra lá por padrão, então redireciona
  // quem é admin/fiscal direto pro painel em vez de deixá-lo preso ali.
  if (
    (redirectTo === "/" || redirectTo === "/area-do-piloto") &&
    podeAcessarAdmin(perfil.papel)
  ) {
    redirect("/admin");
  }

  redirect(redirectTo || "/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName());
  redirect("/login");
}
