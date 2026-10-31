import Link from "next/link";
import { logoutAction } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

export function AdminTopbar({
  session,
  onAbrirMenu,
}: {
  session: SessionUser;
  onAbrirMenu?: () => void;
}) {
  return (
    <header className="bg-graphite border-orange flex h-14 shrink-0 items-center justify-between gap-3 border-b-2 px-4 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir menu"
          className="-ml-1 flex size-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <Link
          href="/"
          className="flex min-h-11 items-center truncate text-sm font-medium text-white/80 hover:text-white md:min-h-9"
        >
          ← Voltar ao site
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-sm text-white/80 sm:inline">
          {session.nome}{" "}
          <span className="text-white/60">· {session.papel}</span>
        </span>
        <form action={logoutAction}>
          <button className="min-h-11 rounded-md px-2 text-sm font-medium text-white/80 hover:text-white md:min-h-9">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
