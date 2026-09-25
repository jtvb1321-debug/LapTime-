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
    <header className="border-border bg-surface flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir menu"
          className="text-ink-2 hover:text-ink hover:bg-ink/5 -ml-1 rounded-md p-1.5 lg:hidden"
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
          className="text-ink-2 hover:text-ink truncate text-sm font-medium"
        >
          ← Voltar ao site
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-ink-2 hidden text-sm sm:inline">
          {session.nome} <span className="text-ink-3">· {session.papel}</span>
        </span>
        <form action={logoutAction}>
          <button className="text-ink-2 hover:text-ink text-sm font-medium">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
