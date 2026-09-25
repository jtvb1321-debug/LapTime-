import { clsx } from "clsx";

type Tone = "ink" | "orange" | "orange-soft" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  ink: "bg-ink text-white",
  orange: "bg-orange/10 text-orange",
  "orange-soft": "bg-orange-soft/10 text-orange-soft",
  neutral: "bg-ink/5 text-ink-2",
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
