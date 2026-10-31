import { cache } from "react";
import { ipDoCliente } from "@/lib/ip";
import { cookies, headers } from "next/headers";
import { buscarSessao, criarSessao, revogarSessao } from "@/lib/auth-core";
import { pode, type Permissao } from "@/lib/permissoes";
import type { PapelUsuario, Perfil } from "@/lib/types";

// Camada do Next sobre lib/auth-core.ts: lê/grava o cookie de sessão. O
// cookie guarda só um token aleatório; quem é o usuário (e se a sessão ainda
// vale) vem do banco — não dá pra "forjar" um papel editando o cookie.
const SESSION_COOKIE = "vk_session";

export type SessionUser = Perfil;

export function sessionCookieName() {
  return SESSION_COOKIE;
}

// `cache` evita repetir a consulta ao banco várias vezes na mesma requisição
// (layout + página chamam getSession).
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return buscarSessao(token);
});

export async function ipDaRequisicao(): Promise<string | null> {
  const h = await headers();
  return ipDoCliente((nome) => h.get(nome));
}

// Cria a sessão no banco e grava o cookie. `COOKIE_SECURE=1` só deve ser
// ligado quando o site é servido por HTTPS (senão o navegador descarta o
// cookie).
export async function iniciarSessao(perfil: Perfil): Promise<void> {
  const h = await headers();
  const { token, expiraEm } = await criarSessao(perfil.id, {
    ip: await ipDaRequisicao(),
    userAgent: h.get("user-agent"),
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.COOKIE_SECURE === "1",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await revogarSessao(token);
  cookieStore.delete(SESSION_COOKIE);
}

export function podeAcessarAdmin(papel: PapelUsuario) {
  return pode(papel, "painel.acessar");
}

// Devolve a sessão se o usuário logado tiver a permissão; senão null.
// Use no começo de toda server action / rota de API que altera dados.
export async function exigirPermissao(
  permissao: Permissao,
): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session || !pode(session.papel, permissao)) return null;
  return session;
}
