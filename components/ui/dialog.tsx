"use client";

import { useEffect } from "react";
import { clsx } from "clsx";

// Não existe nenhum modal/dialog reutilizável no projeto ainda — este é o
// primeiro, construído do zero (sem Radix/Headless UI instalados). Fecha no
// Esc ou clicando fora; o clique dentro do painel não propaga pro overlay.
//
// Largura do painel é 100% de quem chama (className, default max-w-md) —
// nunca combinar um max-w daqui com outro do lado de fora: são duas classes
// Tailwind de mesma especificidade competindo pela mesma propriedade, e quem
// "ganha" depende da ordem no stylesheet gerado, não da ordem no className
// (mesmo problema já visto no tamanho da logo de patrocinador).
export function Dialog({
  open,
  onClose,
  children,
  className = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(evento) => evento.stopPropagation()}
        className={clsx(
          "border-border bg-surface max-h-[85vh] w-full overflow-y-auto rounded-lg border p-6 shadow-xl",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
