"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { LogoCarregando } from "@/components/ui/logo-carregando";

const COOKIE = "gl_abertura";
// Duração total da animação (em CSS: começa a sair em 3,1 s e termina em 3,6 s).
const FIM_MS = 3700;

export function AberturaCliente() {
  const [pular, setPular] = useState(false);
  const [fim, setFim] = useState(false);

  useEffect(() => {
    // Lembra só nesta sessão do navegador (cookie sem validade); não guarda nenhum dado.
    document.cookie = `${COOKIE}=1; path=/; SameSite=Lax`;
    const encerrar = () => setPular(true);
    const opcoes = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", encerrar, opcoes);
    window.addEventListener("keydown", encerrar, { once: true });
    window.addEventListener("wheel", encerrar, opcoes);
    window.addEventListener("touchstart", encerrar, opcoes);
    const t = setTimeout(() => setFim(true), FIM_MS);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", encerrar);
      window.removeEventListener("keydown", encerrar);
      window.removeEventListener("wheel", encerrar);
      window.removeEventListener("touchstart", encerrar);
    };
  }, []);

  useEffect(() => {
    if (!pular) return;
    const t = setTimeout(() => setFim(true), 320);
    return () => clearTimeout(t);
  }, [pular]);

  if (fim) return null;

  return (
    <div
      aria-hidden="true"
      className={clsx("gl-abertura", pular && "gl-abertura--pular")}
    >
      <div className="gl-abertura__centro">
        <LogoCarregando />
      </div>
      <p className="gl-abertura__dica">Toque para entrar</p>
    </div>
  );
}
