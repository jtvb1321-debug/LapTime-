import { clsx } from "clsx";
import { corBadgeCategoria } from "@/lib/categoria-cor";

export function CategoriaBadge({
  nome,
  categoriaId,
  className,
}: {
  nome: string;
  categoriaId: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        corBadgeCategoria(categoriaId),
        className,
      )}
    >
      {nome}
    </span>
  );
}
