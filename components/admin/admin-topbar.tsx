import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

export function AdminTopbar(_props: { session: SessionUser }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/admin/balcao"
          aria-label="Grid Lap: visão do dia"
          className="flex shrink-0 items-center gap-2"
        >
          <Image
            src="/logo-gridlap-claro.svg"
            alt=""
            width={1000}
            height={334}
            unoptimized
            className="h-8 w-auto"
            priority
          />
          <span className="hidden text-sm text-white/60 sm:inline">painel</span>
        </Link>
        <Link
          href="/"
          className="flex min-h-11 items-center truncate text-sm font-medium text-white/80 hover:text-white md:min-h-9"
        >
          ← Voltar ao site
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <form action={logoutAction}>
          <button className="min-h-11 rounded-md px-2 text-sm font-medium text-white/80 hover:text-white md:min-h-9">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
