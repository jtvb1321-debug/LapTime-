import { pode, type Permissao } from "@/lib/permissoes";
import type { PapelUsuario } from "@/lib/types";

export interface AdminNavItem {
  href: string;
  label: string;
  // Só aparece pra quem tem esta permissão.
  permissao?: Permissao;
  // Ou pra quem tem qualquer uma destas.
  qualquer?: Permissao[];
  // Subtítulo dentro do grupo (só organização visual; não muda a URL).
  secao?: string;
}

export interface AdminNavGroup {
  titulo: string;
  itens: AdminNavItem[];
  // Papéis que não veem o grupo (ex.: a recepção não opera campeonato).
  ocultoPara?: PapelUsuario[];
  // true = os itens ficam soltos no menu (sem título nem abrir/fechar).
  fixo?: boolean;
}

const SEM_RECEPCAO: PapelUsuario[] = ["recepcao"];

// Sete grupos. Mover um item de lugar NÃO muda quem pode abri-lo: a visibilidade
// vem das mesmas permissões de antes, e as páginas continuam validando no
// servidor. A matriz por perfil está em tests/navegacao.test.ts.
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    titulo: "Operação",
    fixo: true,
    itens: [
      {
        href: "/admin/balcao",
        label: "Visão do dia",
        qualquer: ["cronometragem.ver", "agenda.gerenciar"],
      },
      {
        href: "/admin/operacao/agenda",
        label: "Agenda",
        permissao: "agenda.gerenciar",
      },
      {
        href: "/admin/operacao/clientes",
        label: "Clientes",
        permissao: "cliente.gerenciar",
      },
    ],
  },
  {
    titulo: "Cronometragem",
    fixo: true,
    itens: [
      {
        href: "/admin/cronometragem",
        label: "Baterias e provas",
        permissao: "cronometragem.ver",
      },
    ],
  },
  {
    titulo: "Campeonato",
    ocultoPara: SEM_RECEPCAO,
    itens: [
      { href: "/admin/campeonatos", label: "Campeonatos", secao: "Estrutura" },
      { href: "/admin/etapas", label: "Etapas", secao: "Estrutura" },
      { href: "/admin/categorias", label: "Categorias", secao: "Estrutura" },
      { href: "/admin/tracados", label: "Traçados", secao: "Estrutura" },
      {
        href: "/admin/video-tracado",
        label: "Vídeo do traçado",
        secao: "Estrutura",
      },
      {
        href: "/admin/patrocinadores",
        label: "Patrocinadores",
        secao: "Estrutura",
      },
      { href: "/admin/pilotos", label: "Pilotos", secao: "Participantes" },
      {
        href: "/admin/inscricoes",
        label: "Inscrições",
        secao: "Participantes",
      },
      {
        href: "/admin/pagamentos",
        label: "Pagamentos",
        secao: "Participantes",
      },
      { href: "/admin/karts", label: "Karts do campeonato", secao: "Provas" },
      { href: "/admin/balizamento", label: "Balizamento", secao: "Provas" },
      {
        href: "/admin/baterias",
        label: "Baterias do campeonato",
        secao: "Provas",
      },
      { href: "/admin/live-timing", label: "Live timing", secao: "Provas" },
      {
        href: "/admin/resultados",
        label: "Resultados",
        secao: "Classificação",
      },
      { href: "/admin/pontuacao", label: "Pontuação", secao: "Classificação" },
      { href: "/admin/punicoes", label: "Punições", secao: "Classificação" },
      { href: "/admin/recursos", label: "Recursos", secao: "Classificação" },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      {
        href: "/admin/operacao/caixa",
        label: "Caixa",
        permissao: "caixa.operar",
      },
      {
        href: "/admin/operacao/relatorio",
        label: "Relatório do dia",
        permissao: "financeiro.gerenciar",
      },
      {
        href: "/admin/operacao/financeiro",
        label: "Fluxo de caixa",
        permissao: "financeiro.gerenciar",
      },
      {
        href: "/admin/operacao/contas",
        label: "Contas a pagar",
        permissao: "financeiro.gerenciar",
      },
    ],
  },
  {
    titulo: "Equipamentos",
    ocultoPara: SEM_RECEPCAO,
    itens: [
      {
        href: "/admin/cronometragem/equipamentos",
        label: "Decoder e agente",
        permissao: "cronometragem.ver",
      },
      {
        href: "/admin/cronometragem/karts",
        label: "Karts",
        permissao: "cronometragem.ver",
      },
      {
        href: "/admin/cronometragem/transponders",
        label: "Transponders",
        permissao: "cronometragem.ver",
      },
    ],
  },
  {
    titulo: "Relatórios",
    ocultoPara: SEM_RECEPCAO,
    itens: [
      {
        href: "/admin/dashboard",
        label: "Painel gerencial",
        qualquer: ["relatorio.consultar", "painel.acessar"],
      },
      { href: "/admin/relatorios", label: "Relatórios do campeonato" },
    ],
  },
  {
    titulo: "Configurações",
    ocultoPara: SEM_RECEPCAO,
    itens: [
      { href: "/admin/configuracoes", label: "Campeonato e imagem" },
      {
        href: "/admin/operacao/termo",
        label: "Termo de responsabilidade",
        permissao: "termo.editar",
      },
    ],
  },
];

// Menu que um perfil enxerga: grupos permitidos, com só os itens permitidos.
export function menuParaPapel(papel: PapelUsuario): AdminNavGroup[] {
  // Quem não acessa o painel não tem menu (o layout já o redireciona).
  if (!pode(papel, "painel.acessar")) return [];
  return ADMIN_NAV.filter((g) => !g.ocultoPara?.includes(papel))
    .map((g) => ({
      ...g,
      itens: g.itens.filter((i) => {
        if (i.permissao) return pode(papel, i.permissao);
        if (i.qualquer) return i.qualquer.some((p) => pode(papel, p));
        return true;
      }),
    }))
    .filter((g) => g.itens.length > 0);
}
