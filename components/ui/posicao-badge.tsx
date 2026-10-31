import { clsx } from "clsx";

const CORES_PODIO: Record<number, string> = {
  1: "bg-orange text-on-orange",
  2: "bg-ink text-white",
  3: "bg-orange-soft text-on-orange",
};

export function PosicaoBadge({ posicao }: { posicao: number }) {
  const cor = CORES_PODIO[posicao];
  if (!cor) return <span className="font-mono">{posicao}º</span>;

  return (
    <span
      className={clsx(
        "inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-semibold",
        cor,
      )}
    >
      {posicao}
    </span>
  );
}
