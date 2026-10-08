"use client";

import { clsx } from "clsx";
import { useState } from "react";
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

  return (
    <div className="flex min-h-screen">
      {menuAberto ? (
        <div
          className="bg-ink/40 fixed inset-0 z-30 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      ) : null}

      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 lg:static lg:translate-x-0",
          menuAberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <AdminSidebar onNavigate={() => setMenuAberto(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          session={session}
          onAbrirMenu={() => setMenuAberto(true)}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
