"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { ADMIN_NAV } from "@/lib/admin-nav";

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="border-border bg-surface flex h-full w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r px-4 py-6">
      <Link href="/admin" className="flex items-center gap-2 px-2">
        <Image
          src="/logo-gridlap.webp"
          alt="Grid Lap"
          width={2000}
          height={667}
          className="h-7 w-auto"
          priority
        />
        <span className="text-ink-3 text-sm">admin</span>
      </Link>

      {ADMIN_NAV.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <p className="text-ink-3 px-2 text-xs font-medium tracking-wide uppercase">
            {grupo.titulo}
          </p>
          {grupo.itens.map((item) => {
            const ativo =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={clsx(
                  "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-orange/10 text-orange"
                    : "text-ink-2 hover:bg-ink/5 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
