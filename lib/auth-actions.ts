"use server";

import { redirect } from "next/navigation";
import {
  encerrarSessao,
  getSession,
  ipDaRequisicao,
  iniciarSessao,
  podeAcessarAdmin,
} from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { autenticar } from "@/lib/auth-core";
import { cookies } from "next/headers";
import { destinoSeguro } from "@/lib/destino-seguro";
import {
  COOKIE_ENTRADA,
  VALIDADE_ENTRADA_S,
  destinoComEntrada,
} from "@/lib/entrada";

export type LoginState = { erro?: string; email?: string };

export async function loginMockAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha.", email };
  }

  const resultado = await autenticar(email, senha, await ipDaRequisicao());
  if (!resultado.ok) {
    return { erro: resultado.erro, email };
  }
  const perfil = resultado.perfil;

  await iniciarSessao(perfil);

  // Só aceita destino interno (nada que o navegador leve a outro site).
  const destino = destinoSeguro(redirectTo);

  if (destino.startsWith("/admin") && !podeAcessarAdmin(perfil.papel)) {
    return irPara("/area-do-piloto");
  }

  // Quem só tem acesso ao admin não tem nada pra ver em /area-do-piloto — a
  // rota genérica do header do site leva pra lá por padrão, então redireciona
  // quem é admin/fiscal/operador direto pro painel em vez de deixá-lo preso ali.
  if (
    (destino === "/" || destino === "/area-do-piloto") &&
    podeAcessarAdmin(perfil.papel)
  ) {
    return irPara("/admin");
  }

  return irPara(destino);
}

// Marca a entrada (animação de boas-vindas) só quando o destino a mostra.
async function irPara(destino: string): Promise<never> {
  if (destinoComEntrada(destino)) {
    (await cookies()).set(COOKIE_ENTRADA, "1", {
      path: "/",
      sameSite: "lax",
      maxAge: VALIDADE_ENTRADA_S,
      secure: process.env.COOKIE_SECURE === "1",
    });
  }
  redirect(destino);
}

export async function logoutAction() {
  const session = await getSession();
  await encerrarSessao();
  (await cookies()).delete(COOKIE_ENTRADA);
  if (session) {
    await registrarAuditoria({
      usuarioId: session.id,
      acao: "logout",
      entidade: "login",
      entidadeId: session.email.toLowerCase(),
      ip: await ipDaRequisicao(),
    });
  }
  redirect("/login");
}
