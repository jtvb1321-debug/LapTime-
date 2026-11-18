import clsx from "clsx";
import { corTextoCategoria } from "@/lib/categoria-cor";

// Nome da categoria na cor dela (Master azul, Intermediária amarela, Rookie verde, Sênior branca,
// Feminina rosa), para reconhecer a categoria de relance em qualquer tela.
export function NomeCategoria({
  categoriaId,
  children,
  className,
}: {
  categoriaId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx(corTextoCategoria(categoriaId), className)}>
      {children}
    </span>
  );
}
