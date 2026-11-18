"use client";

import { useEffect, useRef } from "react";
import { PistaLuminosa } from "@/components/site/pista-luminosa";

// Mapa do circuito do VeloKart na página inicial: o desenho enviado, em linhas claras, com uma luz
// laranja correndo pelo traçado. É DECORATIVO e independente da cronometragem: não mostra tempos,
// posições nem dados oficiais. Pausa fora da tela e com a aba oculta; parado com movimento reduzido.
export function MapaDoCircuito() {
  const raiz = useRef<HTMLElement>(null);

  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return;
    let visivel = true;
    const aplicar = () => {
      if (!visivel || document.hidden) alvo.setAttribute("data-pausado", "");
      else alvo.removeAttribute("data-pausado");
    };
    const obs =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([e]) => {
              visivel = e.isIntersecting;
              aplicar();
            },
            { threshold: 0.05 },
          )
        : null;
    obs?.observe(alvo);
    document.addEventListener("visibilitychange", aplicar);
    return () => {
      obs?.disconnect();
      document.removeEventListener("visibilitychange", aplicar);
    };
  }, []);

  return (
    <figure ref={raiz} className="gl-pista m-0 flex flex-col gap-2">
      <div
        role="img"
        aria-label="Mapa do circuito do VeloKart. Ilustração decorativa: não mostra tempos nem posições."
        className="mx-auto w-full max-w-[340px]"
      >
        <PistaLuminosa className="block h-auto w-full overflow-visible" />
      </div>
      <figcaption className="text-ink-3 text-center text-xs">
        Ilustração decorativa, sem tempos nem posições.
      </figcaption>
    </figure>
  );
}
