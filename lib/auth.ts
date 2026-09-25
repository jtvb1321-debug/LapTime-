import { cookies } from "next/headers";
import { lerPerfis } from "@/lib/perfis-store";
import type { PapelUsuario, Perfil } from "@/lib/types";

// Sessão local mockada: um cookie guarda o perfil logado como JSON.
// Quando o Supabase Auth entrar, isso vira "ler o usuário da sessão do
// Supabase e buscar o perfil correspondente na tabela `perfis`" — a forma
// de SessionUser abaixo é a mesma coisa que Perfil, de propósito.
const SESSION_COOKIE = "vk_session";

export type SessionUser = Perfil;

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function findPerfilPorEmail(
  email: string,
): Promise<Perfil | undefined> {
  const perfis = await lerPerfis();
  return perfis.find((p) => p.email.toLowerCase() === email.toLowerCase());
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

// O cookie de sessão guarda o perfil como JSON — sem isso, o hash da senha
// (mesmo que salgado) iria junto. `JSON.stringify` descarta chaves com valor
// `undefined`, então isso já remove `senhaHash` da sessão sem precisar de
// destructuring.
export function paraSessao(perfil: Perfil): SessionUser {
  return { ...perfil, senhaHash: undefined };
}

export function podeAcessarAdmin(papel: PapelUsuario) {
  return papel === "admin" || papel === "fiscal";
}
