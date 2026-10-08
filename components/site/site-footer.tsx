import Image from "next/image";
import { campeonato } from "@/lib/mock/data";

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10">
        <Image
          src="/logo-gridlap.webp"
          alt="Grid Lap"
          width={2000}
          height={667}
          className="h-auto w-full max-w-xs"
        />
        <div className="text-ink-2 flex w-full flex-col gap-2 text-center text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()}
            {campeonato
              ? ` ${campeonato.nome} — temporada ${campeonato.temporada}`
              : " Grid Lap"}
          </p>
          <p>Painel de TV disponível em /tv</p>
        </div>
      </div>
    </footer>
  );
}
