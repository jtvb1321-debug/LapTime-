import Image from "next/image";
import { clsx } from "clsx";

// Logo oficial do Grid Lap (public/logo-gridlap.webp). Sempre sobre um fundo
// branco, para valer tanto em tela clara quanto escura; `variant` fica por
// compatibilidade com quem já usava o logo em texto.
export function Logo({
  className,
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    <Image
      src="/logo-gridlap.webp"
      alt="Grid Lap"
      width={2000}
      height={667}
      className={clsx("h-12 w-auto rounded bg-white p-0.5", className)}
      priority
    />
  );
}
