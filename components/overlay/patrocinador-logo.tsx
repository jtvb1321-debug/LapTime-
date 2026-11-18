import { clsx } from "clsx";

// Usado no admin (fundo claro) e nos overlays de transmissão (fundo escuro).
// Sem logoUrl cadastrada, mostra o nome do patrocinador como selo — igual ao
// fallback de iniciais do Avatar, com a variante de cor certa pro contexto.
//
// Com logo, ela aparece igual à logo do Grid Lap no mesmo overlay: sem
// nenhum fundo atrás, só a imagem (com transparência, se ela tiver) numa
// altura fixa e largura livre — quem chama passa className com a altura
// (ex.: "h-14 w-auto"), igual faria com um <Image> comum. A imagem não tem
// nenhuma classe de tamanho própria além de "object-contain": tê-las (como
// h-full/w-auto fixos) fazia essas classes competirem com o className
// recebido pela mesma propriedade CSS, e o Tailwind não resolve esse
// empate pela ordem em que aparecem no JSX — o resultado era a logo
// ignorando o tamanho pedido e "explodindo" o layout.
export function PatrocinadorLogo({
  nome,
  logoUrl,
  variant = "light",
  className,
}: {
  nome: string;
  logoUrl?: string | null;
  variant?: "light" | "dark";
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo vindo do cadastro, sem domínio fixo pra otimizar
      <img
        src={logoUrl}
        alt={nome}
        className={clsx("object-contain", className)}
      />
    );
  }

  return (
    <span
      className={clsx(
        "flex items-center justify-center rounded px-2 text-[10px] font-bold tracking-wide whitespace-nowrap uppercase",
        variant === "dark"
          ? "bg-white/10 text-white/70"
          : "bg-ink/5 text-ink-2",
        className,
      )}
    >
      {nome}
    </span>
  );
}
