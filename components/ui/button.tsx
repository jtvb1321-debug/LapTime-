import { clsx } from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger";

// primary: ação principal (laranja da marca, texto grafite por contraste AA);
// dark: ação forte sem destaque de marca; secondary/ghost: ações de apoio.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-orange text-on-orange hover:bg-orange-strong active:bg-orange-strong",
  dark: "bg-graphite text-white hover:bg-graphite-2",
  secondary:
    "bg-surface text-ink border border-border-strong hover:border-orange hover:text-orange-ink",
  ghost: "text-ink-2 hover:text-orange-ink hover:bg-orange/10",
  danger: "bg-danger text-white hover:bg-danger/90",
};

// Alvo de toque de 44 px no celular/tablet; compacto no computador.
const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors md:min-h-9 disabled:opacity-50 disabled:pointer-events-none aria-busy:cursor-progress focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-strong";

// carregando: só apresentação (giro + aria-busy); quem chama decide se também
// desabilita o botão, como já fazia antes.
export function Button({
  variant = "primary",
  className,
  carregando,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  carregando?: boolean;
}) {
  return (
    <button
      className={clsx(BASE, VARIANT_CLASSES[variant], className)}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando ? <span className="gl-giro" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(BASE, VARIANT_CLASSES[variant], className)}
    >
      {children}
    </Link>
  );
}
