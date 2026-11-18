import { clsx } from "clsx";

// Ícones do menu lateral (traço de 24x24, sem biblioteca). A escolha é por
// endereço do item; item sem ícone mostra a inicial do nome. Só apresentação:
// o conjunto de itens e as permissões vêm de lib/admin-nav.ts.
const TRACOS: Record<string, string[]> = {
  painel: ["M4 4h7v7H4z", "M13 4h7v4h-7z", "M13 10h7v10h-7z", "M4 13h7v7H4z"],
  calendario: ["M4 6h16v14H4z", "M4 10h16", "M8 3v4", "M16 3v4"],
  pessoas: [
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6",
    "M16 5.5a3 3 0 0 1 0 5.5",
    "M18 14.3c1.8.8 3 2.5 3 4.7",
  ],
  bandeira: ["M5 21V4", "M5 4h12l-2 4 2 4H5"],
  trofeu: [
    "M8 4h8v5a4 4 0 0 1-8 0z",
    "M8 6H4v1a3 3 0 0 0 3 3",
    "M16 6h4v1a3 3 0 0 1-3 3",
    "M12 13v4",
    "M8 20h8",
  ],
  camadas: ["M12 4 3 9l9 5 9-5z", "M3 14l9 5 9-5"],
  rota: [
    "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6",
  ],
  video: ["M3 6h12v12H3z", "M15 10l6-3v10l-6-3"],
  estrela: [
    "M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2 8 13.7 4 9.8 9.5 9z",
  ],
  usuario: [
    "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8",
  ],
  prancheta: ["M8 4h8v3H8z", "M6 5H5v16h14V5h-1", "M9 12h6", "M9 16h6"],
  cartao: ["M3 6h18v12H3z", "M3 10h18", "M7 15h3"],
  kart: [
    "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
    "M12 12l4-3",
    "M12 7v1",
    "M7 12h1",
    "M16 12h1",
  ],
  sorteio: [
    "M4 7h4l8 10h4",
    "M4 17h4l2-2.5",
    "M14 9.5 16 7h4",
    "M18 5l2 2-2 2",
    "M18 15l2 2-2 2",
  ],
  relogio: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 8v4l3 2"],
  lista: [
    "M8 6h12",
    "M8 12h12",
    "M8 18h12",
    "M4 6h.01",
    "M4 12h.01",
    "M4 18h.01",
  ],
  grafico: ["M4 20h16", "M7 20v-7", "M12 20V6", "M17 20v-10"],
  alerta: ["M12 4 3 20h18z", "M12 10v4", "M12 17h.01"],
  mensagem: ["M4 5h16v11H9l-5 4z"],
  dinheiro: [
    "M3 7h18v10H3z",
    "M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    "M6 10v.01",
    "M18 14v.01",
  ],
  relatorio: ["M7 3h8l4 4v14H7z", "M15 3v4h4", "M10 12h6", "M10 16h6"],
  tendencia: ["M4 17l5-5 4 4 7-8", "M15 8h5v5"],
  recibo: ["M6 3h12v18l-3-2-3 2-3-2-3 2z", "M9 8h6", "M9 12h6"],
  antena: [
    "M12 12a1.5 1.5 0 1 0 0 .01",
    "M8.5 8.5a5 5 0 0 0 0 7",
    "M15.5 8.5a5 5 0 0 1 0 7",
    "M5.6 5.6a9 9 0 0 0 0 12.8",
    "M18.4 5.6a9 9 0 0 1 0 12.8",
  ],
  chip: [
    "M8 8h8v8H8z",
    "M10 4v4",
    "M14 4v4",
    "M10 16v4",
    "M14 16v4",
    "M4 10h4",
    "M4 14h4",
    "M16 10h4",
    "M16 14h4",
  ],
  baixar: ["M12 4v11", "M7 11l5 5 5-5", "M5 20h14"],
  engrenagem: [
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    "M12 3v3",
    "M12 18v3",
    "M3 12h3",
    "M18 12h3",
    "M5.6 5.6l2.1 2.1",
    "M16.3 16.3l2.1 2.1",
    "M18.4 5.6l-2.1 2.1",
    "M7.7 16.3l-2.1 2.1",
  ],
  jogar: ["M8 5l11 7-11 7z"],
  documento: ["M7 3h8l4 4v14H7z", "M15 3v4h4", "M10 11h6", "M10 15h4"],
};

const ICONE_POR_HREF: Record<string, string> = {
  "/": "painel",
  "/admin": "painel",
  "/admin/pista-e-baterias": "bandeira",
  "/admin/balcao": "painel",
  "/admin/operacao/agenda": "calendario",
  "/admin/operacao/clientes": "pessoas",
  "/admin/cronometragem": "bandeira",
  "/admin/cronometragem/pista": "bandeira",
  "/admin/campeonatos": "trofeu",
  "/admin/etapas": "camadas",
  "/admin/categorias": "lista",
  "/admin/tracados": "rota",
  "/admin/video-tracado": "video",
  "/admin/patrocinadores": "estrela",
  "/admin/pilotos": "usuario",
  "/admin/inscricoes": "prancheta",
  "/admin/pagamentos": "cartao",
  "/admin/karts": "kart",
  "/admin/balizamento": "sorteio",
  "/admin/baterias": "relogio",
  "/admin/live-timing": "antena",
  "/admin/resultados": "lista",
  "/admin/pontuacao": "grafico",
  "/admin/punicoes": "alerta",
  "/admin/recursos": "mensagem",
  "/admin/operacao/caixa": "dinheiro",
  "/admin/operacao/relatorio": "relatorio",
  "/admin/operacao/financeiro": "tendencia",
  "/admin/operacao/contas": "recibo",
  "/admin/dashboard": "grafico",
  "/admin/relatorios": "baixar",
  "/admin/configuracoes": "engrenagem",
  "/admin/demonstracao": "jogar",
  "/admin/operacao/termo": "documento",
};

export function IconeDoMenu({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const tracos = TRACOS[ICONE_POR_HREF[href] ?? ""];
  if (!tracos) {
    return (
      <span
        aria-hidden
        className={clsx(
          "font-display flex size-5 shrink-0 items-center justify-center text-sm font-bold",
          className,
        )}
      >
        {label.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx("size-5 shrink-0", className)}
    >
      {tracos.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
