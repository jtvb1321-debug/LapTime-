import { clsx } from "clsx";
import { suavizarRota } from "@/lib/tracado3d/curva";
import type { PontoRota } from "@/lib/tracado3d/rota";

// Miniatura 2D (vista de cima) do traçado: leve, sem carregar o modelo 3D.
// A escala é a da própria rota, enquadrada com margem.
export function TracadoMiniatura({
  pontos,
  fechado,
  className,
  comGlow = false,
}: {
  pontos: PontoRota[];
  fechado: boolean;
  className?: string;
  comGlow?: boolean;
}) {
  const trajeto = suavizarRota(pontos, fechado);
  if (trajeto.length < 2) {
    return (
      <svg
        viewBox="0 0 100 60"
        className={clsx("bg-graphite", className)}
        role="img"
        aria-label="Traçado sem pontos suficientes"
      />
    );
  }
  const xs = trajeto.map((p) => p.x);
  const zs = trajeto.map((p) => p.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const largura = Math.max(Math.max(...xs) - minX, 1);
  const altura = Math.max(Math.max(...zs) - minZ, 1);
  const lado = Math.max(largura, altura);
  const margem = lado * 0.12;
  const espessura = lado * 0.035;
  const d =
    trajeto
      .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.z.toFixed(2)}`)
      .join("") + (fechado ? "Z" : "");
  const inicio = trajeto[0];
  return (
    <svg
      viewBox={`${minX - margem} ${minZ - margem} ${largura + margem * 2} ${altura + margem * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className={clsx("bg-graphite", className)}
      role="img"
      aria-label="Traçado visto de cima"
    >
      {comGlow ? (
        <path
          d={d}
          fill="none"
          stroke="#FF5500"
          strokeOpacity={0.25}
          strokeWidth={espessura * 3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={espessura * 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#FF5500"
        strokeWidth={espessura}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={inicio.x}
        cy={inicio.z}
        r={espessura * 1.4}
        fill="#FFFFFF"
        stroke="#15181E"
        strokeWidth={espessura * 0.4}
      />
    </svg>
  );
}
