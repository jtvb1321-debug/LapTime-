"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Modal reutilizável (sem Radix/Headless UI). Fecha no Esc ou clicando fora; o
// clique dentro do painel não propaga pro overlay. O foco vai para dentro ao
// abrir, fica preso no painel (Tab e Shift+Tab) e volta ao elemento que abriu
// o modal quando ele fecha.
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
  rotulo,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  // Nome acessível do modal (leitores de tela). Sem ele, o painel é só "diálogo".
  rotulo?: string;
}) {
  const painel = useRef<HTMLDivElement>(null);
  // Sempre a versão mais recente de onClose, sem refazer o efeito a cada render
  // (o foco só é movido quando o modal abre).
  const aoFechar = useRef(onClose);
  useEffect(() => {
    aoFechar.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const anterior = document.activeElement as HTMLElement | null;
    const foco = () =>
      Array.from(painel.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? []);

    // Primeiro campo/botão do painel; se não houver, o próprio painel.
    (foco()[0] ?? painel.current)?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        aoFechar.current();
        return;
      }
      if (evento.key !== "Tab") return;
      const itens = foco();
      if (itens.length === 0) {
        evento.preventDefault();
        painel.current?.focus();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const ativo = document.activeElement;
      if (evento.shiftKey && (ativo === primeiro || ativo === painel.current)) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && ativo === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      // Devolve o foco a quem abriu o modal (se ele ainda está na página).
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="bg-graphite/60 fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        tabIndex={-1}
        onClick={(evento) => evento.stopPropagation()}
        className={clsx(
          "border-border bg-surface max-h-[85vh] w-full overflow-y-auto rounded-xl border p-6 shadow-[var(--sombra-elevada)] outline-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
