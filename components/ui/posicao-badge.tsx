import { clsx } from "clsx";

const CORES_PODIO: Record<number, string> = {
  1: "bg-orange text-on-orange",
  2: "bg-ink text-white",
  3: "bg-orange-soft text-on-orange",
};

export function PosicaoBadge({ posicao }: { posicao: number }) {
  const cor = CORES_PODIO[posicao];
  if (!cor)
    return <span className="font-display font-semibold">{posicao}º</span>;

  return (
    <span
      className={clsx(
        "font-display inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
        cor,
      )}
    >
      {posicao}
    </span>
  );
}
