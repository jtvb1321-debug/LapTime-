import { comprimentoDaRota, posicaoNaRota, type PontoRota } from "./rota";

export interface PoseDoPiloto {
  posicao: { x: number; y: number; z: number };
  alvo: { x: number; y: number; z: number };
}

// Câmera em primeira pessoa na altura do piloto, olhando 4 m adiante para
// antecipar as curvas.
export function poseDoPiloto(
  pontos: PontoRota[],
  fechado: boolean,
  distancia: number,
  total = comprimentoDaRota(pontos, fechado),
): PoseDoPiloto | null {
  if (total === 0) return null;
  const atual = fechado
    ? ((distancia % total) + total) % total
    : Math.max(0, Math.min(distancia, total));
  const ponto = posicaoNaRota(pontos, fechado, atual);
  const adiante = posicaoNaRota(
    pontos,
    fechado,
    fechado
      ? (atual + Math.min(4, total / 4)) % total
      : Math.min(atual + 4, total),
  );
  if (!ponto || !adiante) return null;
  const dx = adiante.x - ponto.x;
  const dz = adiante.z - ponto.z;
  const comprimento = Math.hypot(dx, dz);
  const frenteX =
    comprimento > 0.001 ? dx / comprimento : Math.sin(ponto.angulo);
  const frenteZ =
    comprimento > 0.001 ? dz / comprimento : Math.cos(ponto.angulo);
  return {
    posicao: {
      x: ponto.x - Math.sin(ponto.angulo) * 0.35,
      y: 1.25,
      z: ponto.z - Math.cos(ponto.angulo) * 0.35,
    },
    alvo: { x: ponto.x + frenteX * 8, y: 1, z: ponto.z + frenteZ * 8 },
  };
}
