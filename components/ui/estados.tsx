import { clsx } from "clsx";

// Estados padrão de tela: vazio e carregando. Só apresentação.

export function EstadoVazio({
  titulo,
  children,
  acao,
  className,
}: {
  titulo: string;
  children?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "border-border bg-surface rounded-lg border border-dashed px-5 py-10 text-center",
        className,
      )}
    >
      <p className="text-ink text-sm font-semibold">{titulo}</p>
      {children ? (
        <p className="text-ink-2 mx-auto mt-1 max-w-md text-sm">{children}</p>
      ) : null}
      {acao ? <div className="mt-4 flex justify-center">{acao}</div> : null}
    </div>
  );
}

export function Carregando({
  texto = "Carregando",
  className,
}: {
  texto?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "text-ink-2 flex items-center justify-center gap-2 py-8 text-sm",
        className,
      )}
    >
      <span className="gl-giro" aria-hidden="true" />
      {texto}…
    </div>
  );
}

// Bloco cinza animado no lugar do conteúdo que ainda carrega.
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={clsx("gl-esqueleto h-4", className)} />
  );
}
