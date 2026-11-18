"use client";

import { usePathname } from "next/navigation";
import { PistaLuminosa } from "@/components/site/pista-luminosa";
import { useEffect, useRef } from "react";

// Linguagem do fundo: noite quase preta com o mapa do circuito do VeloKart ao fundo e uma luz
// laranja correndo pelo traçado. Tudo decorativo, atrás do conteúdo e sem clique.

// Cronometragem e baterias ao vivo: o fundo fica parado para não competir com a operação.
function modoDoFundo(caminho: string): "completo" | "leve" {
  return caminho.startsWith("/admin/cronometragem") ? "leve" : "completo";
}

export function FundoAnimado() {
  const caminho = usePathname() ?? "";
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return;
    const atualizar = () => {
      if (document.hidden) alvo.setAttribute("data-pausado", "");
      else alvo.removeAttribute("data-pausado");
    };
    atualizar();
    document.addEventListener("visibilitychange", atualizar);
    return () => document.removeEventListener("visibilitychange", atualizar);
  }, []);

  return (
    <div
      ref={raiz}
      aria-hidden="true"
      className="gl-fundo"
      data-modo={modoDoFundo(caminho)}
    >
      <div className="gl-fundo__grade" />

      {/* Mapa do circuito do VeloKart, apagado, ao fundo (decorativo). */}
      <PistaLuminosa className="gl-fundo__mapa" opacidade={0.2} />

      <div className="gl-fundo__vinheta" />
    </div>
  );
}
