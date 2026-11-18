import {
  CIRCUITO_ALTURA,
  CIRCUITO_LARGURA,
  CIRCUITO_TRACADO,
} from "@/components/site/circuito-pista";

// Desenho do circuito do VeloKart com uma luz laranja correndo pelo traçado (como a linha de
// pista dos sites de cronometragem). Só CSS (`.gl-pista-*`); decorativo.
export function PistaLuminosa({
  className,
  opacidade = 0.82,
}: {
  className?: string;
  opacidade?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${CIRCUITO_LARGURA} ${CIRCUITO_ALTURA}`}
      className={className}
      focusable="false"
      aria-hidden="true"
    >
      <image
        href="/circuito-velokart.png"
        width={CIRCUITO_LARGURA}
        height={CIRCUITO_ALTURA}
        opacity={opacidade}
      />
      <path
        d={CIRCUITO_TRACADO}
        pathLength={1}
        className="gl-pista-luz gl-pista-luz--cauda"
      />
      <path
        d={CIRCUITO_TRACADO}
        pathLength={1}
        className="gl-pista-luz gl-pista-luz--cabeca"
      />
    </svg>
  );
}
