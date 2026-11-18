import { CatmullRomCurve3, Vector3 } from "three";
import { comprimentoDaRota, type PontoRota } from "./rota";

// Trajetória usada por tudo (desenho, distância, validação do asfalto e
// câmera). Com 3+ pontos distintos vira uma spline Catmull–Rom centrípeta que
// passa pelos pontos, amostrada a cada ~25 cm; com 2 pontos é reta. A
// parametrização centrípeta evita laços e excessos com pontos desiguais.
export function suavizarRota(
  pontos: PontoRota[],
  fechado = false,
): PontoRota[] {
  const controles = pontos.filter(
    (p, i) =>
      i === 0 ||
      Math.hypot(p.x - pontos[i - 1].x, p.z - pontos[i - 1].z) > 1e-4,
  );
  if (
    fechado &&
    controles.length > 1 &&
    Math.hypot(
      controles[0].x - controles[controles.length - 1].x,
      controles[0].z - controles[controles.length - 1].z,
    ) < 1e-4
  ) {
    controles.pop();
  }
  if (controles.length < 3) return controles.map((p) => ({ ...p }));

  const curva = new CatmullRomCurve3(
    controles.map((p) => new Vector3(p.x, 0, p.z)),
    fechado,
    "centripetal",
  );
  curva.arcLengthDivisions = Math.max(200, controles.length * 32);
  const quantidade = Math.min(
    40000,
    Math.max(32, Math.ceil(comprimentoDaRota(controles, fechado) / 0.25)),
  );
  const amostras = curva
    .getSpacedPoints(quantidade)
    .map((p) => ({ x: p.x, z: p.z }));
  if (fechado) amostras.pop();
  return amostras;
}
