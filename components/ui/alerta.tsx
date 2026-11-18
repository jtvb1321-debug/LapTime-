import { clsx } from "clsx";

export type NivelAlerta = "info" | "sucesso" | "atencao" | "erro";

// Cores de texto usam as variantes escuras (contraste AA); a cor "-fill" só
// pinta a borda lateral. O nível também aparece no ícone, então a informação
// não depende só da cor.
const NIVEIS: Record<
  NivelAlerta,
  { caixa: string; icone: string; papel: "status" | "alert" }
> = {
  info: {
    caixa: "bg-info-bg text-info border-info-fill",
    icone: "i",
    papel: "status",
  },
  sucesso: {
    caixa: "bg-success-bg text-success border-success-fill",
    icone: "✓",
    papel: "status",
  },
  atencao: {
    caixa: "bg-warning-bg text-warning border-warning-fill",
    icone: "!",
    papel: "status",
  },
  erro: {
    caixa: "bg-danger-bg text-danger border-danger-fill",
    icone: "×",
    papel: "alert",
  },
};

// Aviso operacional com quatro níveis. Só apresentação.
export function Alerta({
  nivel = "info",
  titulo,
  children,
  className,
}: {
  nivel?: NivelAlerta;
  titulo?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const n = NIVEIS[nivel];
  return (
    <div
      role={n.papel}
      className={clsx(
        "flex items-start gap-3 rounded-lg border-l-4 px-4 py-3 text-sm",
        n.caixa,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="font-display mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold"
      >
        {n.icone}
      </span>
      <div className="min-w-0">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        {children ? (
          <div className={titulo ? "mt-0.5" : ""}>{children}</div>
        ) : null}
      </div>
    </div>
  );
}
