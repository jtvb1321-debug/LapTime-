import { clsx } from "clsx";
import { FundoAnimado } from "@/components/ui/fundo-animado";

// Moldura escura das áreas públicas e do painel: aplica os tokens do canvas escuro e a camada de
// fundo animada atrás do conteúdo. Só apresentação: não muda rota, dado nem comportamento.
export function CanvasEscuro({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("gl-canvas relative isolate min-h-screen", className)}>
      <FundoAnimado />
      {children}
    </div>
  );
}
