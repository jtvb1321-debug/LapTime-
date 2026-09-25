"use client";

import { useEffect, useRef } from "react";
import { CenaTracado3D } from "@/lib/video-tracado/cena3d";
import { DURACAO_TOTAL } from "@/lib/video-tracado/timeline";
import type { CurvaNomeada, PontoTracado, SentidoProva } from "@/lib/types";

// Mesma cena 3D cinematográfica da ferramenta de vídeo (câmera em órbita,
// linha se desenhando com brilho), só que rodando ao vivo na página pública
// em vez de virar um MP4 — pensada pro traçado ampliado (clique no card).
const COR_PRIMARIA = "#6d28d9";
const COR_SECUNDARIA = "#4c1d95";
const COR_FUNDO = "#ffffff";

export function TracadoCena3D({
  pontos,
  linhaChegada,
  sentido,
  curvas,
  className,
}: {
  pontos: PontoTracado[];
  linhaChegada?: PontoTracado;
  sentido?: SentidoProva;
  curvas?: CurvaNomeada[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay || pontos.length < 2) return;

    const largura = container.clientWidth || 640;
    const altura = container.clientHeight || 320;
    const cena = new CenaTracado3D(
      {
        trackName: "",
        category: "",
        battery: "",
        startText: "",
        trackLength: "",
        primaryColor: COR_PRIMARIA,
        secondaryColor: COR_SECUNDARIA,
        background: COR_FUNDO,
        trackPoints: pontos,
        finishPoint: linhaChegada,
        direction: sentido,
        curvas,
      },
      largura,
      altura,
      false,
    );
    overlay.width = largura;
    overlay.height = altura;
    container.replaceChildren(cena.canvas, overlay);
    cena.canvas.className = "absolute inset-0 h-full w-full";

    let tempo = 0;
    let ultimo = 0;
    let quadroId = 0;
    function quadro(agora: number) {
      if (!ultimo) ultimo = agora;
      tempo = (tempo + (agora - ultimo) / 1000) % DURACAO_TOTAL;
      ultimo = agora;
      cena.definirTempo(tempo);
      cena.renderizar();
      const ctx = overlay!.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, overlay!.width, overlay!.height);
        cena.desenharExtras(ctx, tempo, overlay!.width, overlay!.height);
      }
      quadroId = requestAnimationFrame(quadro);
    }
    quadroId = requestAnimationFrame(quadro);

    const observador = new ResizeObserver(() => {
      const l = container.clientWidth;
      const a = container.clientHeight;
      if (l > 0 && a > 0) {
        cena.redimensionar(l, a);
        overlay.width = l;
        overlay.height = a;
      }
    });
    observador.observe(container);

    return () => {
      cancelAnimationFrame(quadroId);
      observador.disconnect();
      cena.descartar();
    };
  }, [pontos, linhaChegada, sentido, curvas]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", overflow: "hidden", background: COR_FUNDO }}
    >
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
