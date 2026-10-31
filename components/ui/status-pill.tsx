import { clsx } from "clsx";

export type Tone =
  | "ink"
  | "orange"
  | "orange-soft"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONE_CLASSES: Record<Tone, string> = {
  ink: "bg-ink text-white",
  orange: "bg-orange/10 text-orange-ink",
  // "orange-soft" = pendente/atenção: usa a cor de alerta, não a da marca.
  "orange-soft": "bg-warning-bg text-warning",
  neutral: "bg-ink/5 text-ink-2",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
};

export function StatusPill({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function toneParaStatus(status: string): Tone {
  switch (status) {
    case "confirmada":
    case "confirmado":
    case "encerrada":
    case "disponivel":
      return "ink";
    case "aguardando":
    case "grid":
    case "manutencao":
      return "orange-soft";
    case "ao_vivo":
    case "em_andamento":
      return "orange";
    case "cancelada":
    case "cancelado":
      return "neutral";
    default:
      return "neutral";
  }
}
