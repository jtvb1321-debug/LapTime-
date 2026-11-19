import { clsx } from "clsx";
import { ESTADOS_BRASIL } from "@/lib/estados-brasil";

// Bandeira oficial do estado em formato de botão (círculo com brilho). Os arquivos ficam em
// public/bandeiras/<UF>.svg (Wikimedia Commons, domínio público — ver LEIA-ME.txt lá). É só
// identificação visual: a sigla/nome continua sendo a informação do cadastro.
export function BandeiraUf({
  uf,
  className,
}: {
  uf: string | null | undefined;
  className?: string;
}) {
  const sigla = (uf ?? "").toUpperCase();
  if (!ESTADOS_BRASIL.some((e) => e.sigla === sigla)) return null;
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "relative inline-block size-6 shrink-0 overflow-hidden rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] ring-1 ring-white/25",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:bg-[radial-gradient(circle_at_32%_26%,rgba(255,255,255,0.5),rgba(255,255,255,0)_46%),radial-gradient(circle_at_70%_85%,rgba(0,0,0,0.25),rgba(0,0,0,0)_55%)] after:content-['']",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático, já leve e cacheado */}
      <img
        src={`/bandeiras/${sigla}.svg`}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="size-full object-cover"
      />
    </span>
  );
}
