"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import type { SessionUser } from "@/lib/auth";

export function AdminShell({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);

  // Gaveta no celular: Esc fecha.
  useEffect(() => {
    if (!menuAberto) return;
    const fechar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAberto(false);
    };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [menuAberto]);

  return (
    <div className="bg-bg flex min-h-screen">
      {menuAberto ? (
        <div
          className="bg-ink/40 fixed inset-0 z-30 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      ) : null}

      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:translate-x-0 print:hidden",
          menuAberto ? "translate-x-0" : "-translate-x-full max-lg:invisible",
        )}
      >
        <AdminSidebar
          papel={session.papel}
          onNavigate={() => setMenuAberto(false)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="print:hidden">
          <AdminTopbar
            session={session}
            onAbrirMenu={() => setMenuAberto(true)}
          />
        </div>
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
