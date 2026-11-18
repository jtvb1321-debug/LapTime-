import type { AdminNavGroup, AdminNavItem } from "@/lib/admin-nav";

// Barra de navegação inferior do painel: poucos acessos principais fixos na barra e o resto no
// menu "Mais". Aqui só a regra de escolha e de destaque, sem mudar rotas, nomes nem permissões:
// quem decide o que cada perfil pode abrir continua sendo lib/admin-nav.ts.

// Acessos do dia a dia, em ordem de preferência. Só entram os que o perfil pode abrir.
export const PRINCIPAIS = [
  "/admin/balcao",
  "/admin/cronometragem/pista",
  "/admin/operacao/agenda",
  "/admin/operacao/clientes",
] as const;

export const LIMITE_NA_BARRA = 4;

export function todosOsItens(grupos: AdminNavGroup[]): AdminNavItem[] {
  return grupos.flatMap((g) => g.itens);
}

// Itens fixos na barra (na ordem de PRINCIPAIS) e o restante, que vai para o menu "Mais".
export function dividirBarraEMais(grupos: AdminNavGroup[]): {
  barra: AdminNavItem[];
  mais: AdminNavGroup[];
} {
  const itens = todosOsItens(grupos);
  const barra = PRINCIPAIS.map((href) => itens.find((i) => i.href === href))
    .filter((i): i is AdminNavItem => Boolean(i))
    .slice(0, LIMITE_NA_BARRA);
  const naBarra = new Set(barra.map((i) => i.href));
  const mais = grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !naBarra.has(i.href)) }))
    .filter((g) => g.itens.length > 0);
  return { barra, mais };
}

// Dos itens que casam com o endereço atual, só o mais específico fica aceso (ex.: em
// Cronometragem > Termos, acende "Pista e baterias" e não outro item mais genérico).
export function hrefAtivo(
  pathname: string,
  itens: { href: string; prefixos?: string[] }[],
): string | null {
  const casam: { href: string; tamanho: number }[] = [];
  for (const item of itens) {
    for (const h of [item.href, ...(item.prefixos ?? [])]) {
      const ok =
        h === "/admin" ? pathname === "/admin" : pathname.startsWith(h);
      if (ok) casam.push({ href: item.href, tamanho: h.length });
    }
  }
  return casam.sort((a, b) => b.tamanho - a.tamanho)[0]?.href ?? null;
}
