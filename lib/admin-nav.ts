export interface AdminNavItem {
  href: string;
  label: string;
}

export interface AdminNavGroup {
  titulo: string;
  itens: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { titulo: "Visão geral", itens: [{ href: "/admin", label: "Dashboard" }] },
  {
    titulo: "Campeonato",
    itens: [
      { href: "/admin/campeonatos", label: "Campeonatos" },
      { href: "/admin/etapas", label: "Etapas" },
      { href: "/admin/categorias", label: "Categorias" },
      { href: "/admin/tracados", label: "Traçados" },
      { href: "/admin/video-tracado", label: "Vídeo do traçado" },
      { href: "/admin/patrocinadores", label: "Patrocinadores" },
    ],
  },
  {
    titulo: "Pilotos & inscrições",
    itens: [
      { href: "/admin/pilotos", label: "Pilotos" },
      { href: "/admin/inscricoes", label: "Inscrições" },
      { href: "/admin/pagamentos", label: "Pagamentos" },
    ],
  },
  {
    titulo: "Operação de etapa",
    itens: [
      { href: "/admin/karts", label: "Karts" },
      { href: "/admin/balizamento", label: "Balizamento" },
      { href: "/admin/baterias", label: "Baterias" },
      { href: "/admin/live-timing", label: "Live timing" },
    ],
  },
  {
    titulo: "Resultados",
    itens: [
      { href: "/admin/resultados", label: "Resultados" },
      { href: "/admin/pontuacao", label: "Pontuação" },
      { href: "/admin/punicoes", label: "Punições" },
      { href: "/admin/recursos", label: "Recursos" },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { href: "/admin/relatorios", label: "Relatórios" },
      { href: "/admin/configuracoes", label: "Configurações" },
    ],
  },
];
