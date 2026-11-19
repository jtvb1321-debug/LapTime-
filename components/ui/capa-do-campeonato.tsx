import { clsx } from "clsx";

export type EnquadramentoDaCapa = "inteira" | "preencher";

// Capa do campeonato, igual no site e na prévia do painel (o que se vê lá é o que sai aqui).
//  - "inteira" (padrão): a imagem aparece completa, na proporção dela, sem cortar nada.
//  - "preencher": faixa panorâmica 16:7 que corta as sobras; `focoY` (0 topo … 100 base) escolhe
//    qual parte da imagem fica visível.
export function CapaDoCampeonato({
  src,
  alt,
  enquadramento = "inteira",
  focoY = 50,
  className,
}: {
  src: string;
  alt: string;
  enquadramento?: EnquadramentoDaCapa;
  focoY?: number;
  className?: string;
}) {
  const foco = Math.min(100, Math.max(0, focoY));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={
        enquadramento === "preencher"
          ? { objectPosition: `50% ${foco}%` }
          : undefined
      }
      className={clsx(
        "border-border w-full rounded-lg border",
        enquadramento === "preencher"
          ? "aspect-[16/7] object-cover"
          : "mx-auto h-auto max-h-[80vh] object-contain",
        className,
      )}
    />
  );
}
