import type { PontoTracado } from "@/lib/types";
import {
  segmentarTracado,
  segmentosParaCaminhoSvg,
} from "@/lib/tracado-vetorial";

// Converte a sequência de pontos clicados num path SVG "vetorizado": retas
// de verdade nos trechos retos e arcos de círculo (raio único, transição
// suave) nas curvas, em vez de uma curva que passa exatamente por cada
// ponto bruto e carrega qualquer tremor do clique manual — ver
// lib/tracado-vetorial.ts pro algoritmo (simplificação + arredondamento de
// cantos).
export function pontosParaCurvaSuave(
  pontos: PontoTracado[],
  fechado: boolean,
): string {
  if (pontos.length < 2) return "";
  return segmentosParaCaminhoSvg(segmentarTracado(pontos, fechado), fechado);
}
