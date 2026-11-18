import Image from "next/image";
import { clsx } from "clsx";

// Logo do Grid Lap em versão clara (public/logo-gridlap-claro.svg), sem fundo: para telas escuras.
// `variant` fica por compatibilidade com quem já usava o logo em texto.
export function Logo({
  className,
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    <Image
      src="/logo-gridlap-claro.svg"
      alt="Grid Lap"
      width={1000}
      height={334}
      unoptimized
      className={clsx("h-12 w-auto", className)}
      priority
    />
  );
}
