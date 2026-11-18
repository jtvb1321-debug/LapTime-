"use client";

import { useCallback, useRef, useState } from "react";
import { clsx } from "clsx";
import { Pista3D, type ControlePista3D } from "@/components/tracado/pista-3d";
import type { ResumoDaRota } from "@/lib/tracado3d/cena-pista";
import type { Tracado } from "@/lib/types";

// Traçado sobre o modelo 3D da pista, só para olhar: gira com o mouse/dedo,
// vista de cima e "Visão do piloto" percorrendo a rota.
export function VisualizadorTracado({
  tracado,
  className,
}: {
  tracado: Tracado;
  className?: string;
}) {
  const controle = useRef<ControlePista3D>(null);
  const [visaoPiloto, setVisaoPiloto] = useState(false);
  const [reproduzindo, setReproduzindo] = useState(false);
  const [velocidade, setVelocidade] = useState(30);
  const [resumo, setResumo] = useState<ResumoDaRota | null>(null);
  const aoResumir = useCallback((r: ResumoDaRota) => setResumo(r), []);

  // Rota que sai do asfalto não é reproduzida (a câmera atravessaria o chão).
  const podeAndar = !!resumo && resumo.total > 0 && resumo.invalidos === 0;
  const botao =
    "min-h-11 rounded-md px-3 text-xs font-medium md:min-h-8 disabled:opacity-40";

  return (
    <div className="flex flex-col gap-2">
      <Pista3D
        className={clsx("w-full rounded-md", className)}
        controle={controle}
        pontos={tracado.pontos}
        fechado={tracado.fechado}
        modo="navegar"
        visaoPiloto={visaoPiloto}
        reproduzindo={reproduzindo}
        velocidadeKmh={velocidade}
        onResumo={aoResumir}
        onFim={() => setReproduzindo(false)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={clsx(botao, "bg-graphite hover:bg-graphite/90 text-white")}
          onClick={() => {
            setVisaoPiloto(false);
            setReproduzindo(false);
            controle.current?.enquadrar("topo");
          }}
        >
          Vista superior
        </button>
        <button
          type="button"
          className={clsx(botao, "bg-graphite hover:bg-graphite/90 text-white")}
          onClick={() => {
            setVisaoPiloto(false);
            setReproduzindo(false);
            controle.current?.enquadrar("perspectiva");
          }}
        >
          Perspectiva
        </button>
        <button
          type="button"
          disabled={!podeAndar}
          aria-pressed={reproduzindo}
          className={clsx(
            botao,
            "bg-orange text-on-orange hover:bg-orange-soft",
          )}
          onClick={() => {
            if (!reproduzindo) setVisaoPiloto(true);
            setReproduzindo(!reproduzindo);
          }}
        >
          {reproduzindo ? "Pausar" : "Ver como piloto"}
        </button>
        <label className="text-ink-2 flex items-center gap-2 text-xs">
          Velocidade
          <input
            type="range"
            min={5}
            max={90}
            value={velocidade}
            onChange={(e) => setVelocidade(Number(e.target.value))}
          />
          <span className="text-ink w-14 font-mono">{velocidade} km/h</span>
        </label>
      </div>
    </div>
  );
}
