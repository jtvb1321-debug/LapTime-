import { clsx } from "clsx";

function iniciaisDoNome(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export function Avatar({
  nome,
  avatarUrl,
  tamanho = "md",
  className,
}: {
  nome: string;
  avatarUrl?: string;
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensao = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-16 w-16 text-lg",
  }[tamanho];

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar vindo de URL externa/upload futuro, sem domínio fixo pra otimizar ainda
      <img
        src={avatarUrl}
        alt={nome}
        className={clsx(
          "shrink-0 rounded-full object-cover",
          dimensao,
          className,
        )}
      />
    );
  }

  return (
    <span
      className={clsx(
        "bg-ink/5 text-ink-2 inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold",
        dimensao,
        className,
      )}
      aria-hidden
    >
      {iniciaisDoNome(nome)}
    </span>
  );
}
