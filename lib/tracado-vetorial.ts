import type { PontoTracado } from "@/lib/types";

// Transforma uma sequência de pontos clicados à mão (com todo o tremor e
// irregularidade natural de um traço manual) num traçado "vetorizado":
// trechos retos de verdade + cantos com curvatura de raio único e contínua
// (arcos de círculo), no mesmo espírito de como um kartódromo de verdade é
// desenhado em CAD — em vez de uma curva que passa exatamente por cada
// ponto bruto (o que preserva qualquer ruído do clique).
//
// Duas etapas:
//   1. Simplificação (Ramer–Douglas–Peucker): remove pontos que não mudam
//      a forma geral, colapsando trechos quase-retos numa reta de verdade.
//   2. Arredondamento de cantos: em cada vértice que sobrou, substitui o
//      "bico" por um arco de círculo tangente às duas retas adjacentes —
//      transição suave (contínua na tangente) e com raio consistente.

function distanciaPontoSegmento(
  p: PontoTracado,
  a: PontoTracado,
  b: PontoTracado,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comprimentoQuadrado = dx * dx + dy * dy;
  if (comprimentoQuadrado === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimentoQuadrado;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function simplificarAberto(
  pontos: PontoTracado[],
  tolerancia: number,
): PontoTracado[] {
  if (pontos.length < 3) return pontos;
  const inicio = pontos[0];
  const fim = pontos[pontos.length - 1];
  let indiceMax = 0;
  let distMax = 0;
  for (let i = 1; i < pontos.length - 1; i++) {
    const d = distanciaPontoSegmento(pontos[i], inicio, fim);
    if (d > distMax) {
      distMax = d;
      indiceMax = i;
    }
  }
  if (distMax <= tolerancia) return [inicio, fim];
  const esquerda = simplificarAberto(pontos.slice(0, indiceMax + 1), tolerancia);
  const direita = simplificarAberto(pontos.slice(indiceMax), tolerancia);
  return [...esquerda.slice(0, -1), ...direita];
}

// RDP é definido pra caminhos abertos (precisa de duas "pontas"). Um loop
// fechado não tem ponta natural, então cortamos ele em duas metades pelos
// dois pontos mais distantes entre si, simplificamos cada metade como um
// caminho aberto, e juntamos de volta.
function simplificarFechado(
  pontos: PontoTracado[],
  tolerancia: number,
): PontoTracado[] {
  if (pontos.length < 4) return pontos;
  let a = 0;
  let b = 1;
  let maiorDist = 0;
  for (let i = 0; i < pontos.length; i++) {
    for (let j = i + 1; j < pontos.length; j++) {
      const d = Math.hypot(pontos[i].x - pontos[j].x, pontos[i].y - pontos[j].y);
      if (d > maiorDist) {
        maiorDist = d;
        a = i;
        b = j;
      }
    }
  }
  const metade1 = pontos.slice(a, b + 1);
  const metade2 = [...pontos.slice(b), ...pontos.slice(0, a + 1)];
  const s1 = simplificarAberto(metade1, tolerancia);
  const s2 = simplificarAberto(metade2, tolerancia);
  return [...s1.slice(0, -1), ...s2.slice(0, -1)];
}

// Suavização leve (tipo Laplaciano) antes de simplificar: puxa cada ponto
// um pouco em direção à média dos vizinhos. RDP só decide "manter ou
// remover" um ponto — não corrige a posição dos que ficam, então um ponto
// clicado com a mão um pouco fora do lugar (mas não o bastante pra ser
// removido) ainda carrega esse tremor. Isso resolve isso antes da
// simplificação, deixando o RDP simplificar ainda melhor (as retas ficam
// mais retas de verdade) sem mudar o formato geral do traçado.
function suavizarPontos(
  pontos: PontoTracado[],
  fechado: boolean,
  intensidade: number,
  iteracoes: number,
): PontoTracado[] {
  let atual = pontos;
  const n = pontos.length;
  for (let iter = 0; iter < iteracoes; iter++) {
    const proximo: PontoTracado[] = [];
    for (let i = 0; i < n; i++) {
      if (!fechado && (i === 0 || i === n - 1)) {
        proximo.push(atual[i]);
        continue;
      }
      const anterior = atual[(i - 1 + n) % n];
      const seguinte = atual[(i + 1) % n];
      const medioX = (anterior.x + seguinte.x) / 2;
      const medioY = (anterior.y + seguinte.y) / 2;
      proximo.push({
        x: atual[i].x + (medioX - atual[i].x) * intensidade,
        y: atual[i].y + (medioY - atual[i].y) * intensidade,
      });
    }
    atual = proximo;
  }
  return atual;
}

function calcularEnvergadura(pontos: PontoTracado[]): number {
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  return Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    1,
  );
}

function normalizarAnguloCurto(angulo: number): number {
  let a = angulo % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface SegmentoReta {
  tipo: "reta";
  de: PontoTracado;
  para: PontoTracado;
}

export interface SegmentoArco {
  tipo: "arco";
  de: PontoTracado;
  para: PontoTracado;
  centro: PontoTracado;
  raio: number;
  anguloInicial: number;
  // Delta angular "pelo caminho curto" de anguloInicial até o ângulo final
  // (sempre menor que π em módulo) — já resolve o sentido do giro, então
  // tanto o path SVG quanto a versão em pontos densos usam o mesmo valor.
  deltaAngular: number;
}

export type SegmentoTracado = SegmentoReta | SegmentoArco;

const TOLERANCIA_SIMPLIFICACAO_RELATIVA = 0.008;
const RAIO_MAXIMO_RELATIVO = 0.12;
const RAIO_MINIMO_RELATIVO = 0.02;
const ANGULO_MINIMO_PARA_ARCO = (2 * Math.PI) / 180; // abaixo disso, já é reta
const MARGEM_USO_DO_SEGMENTO = 0.94; // fração do trecho reto que o filete pode ocupar

// Converte os pontos brutos (clicados à mão) numa lista de segmentos
// retos/arcos "vetorizados". `fechado` decide se o traçado fecha em loop
// (uma pista) ou fica aberto (preview enquanto ainda está sendo clicado).
export function segmentarTracado(
  pontosBrutos: PontoTracado[],
  fechado: boolean,
): SegmentoTracado[] {
  if (pontosBrutos.length < 2) return [];

  const envergadura = calcularEnvergadura(pontosBrutos);
  const suavizados = suavizarPontos(pontosBrutos, fechado, 0.25, 2);
  const tolerancia = envergadura * TOLERANCIA_SIMPLIFICACAO_RELATIVA;
  const pontos = fechado
    ? simplificarFechado(suavizados, tolerancia)
    : simplificarAberto(suavizados, tolerancia);

  const n = pontos.length;
  if (n < 3) {
    const segmentos: SegmentoTracado[] = [];
    for (let i = 0; i < n - 1; i++) {
      segmentos.push({ tipo: "reta", de: pontos[i], para: pontos[i + 1] });
    }
    if (fechado && n === 2) {
      segmentos.push({ tipo: "reta", de: pontos[1], para: pontos[0] });
    }
    return segmentos;
  }

  const raioMaximo = envergadura * RAIO_MAXIMO_RELATIVO;
  const raioMinimo = envergadura * RAIO_MINIMO_RELATIVO;

  interface Filete {
    tangenteEntrada: PontoTracado;
    tangenteSaida: PontoTracado;
    centro: PontoTracado;
    raio: number;
    anguloEntrada: number;
    deltaAngular: number;
  }

  const filetes = new Map<number, Filete>();
  const indiceInicial = fechado ? 0 : 1;
  const indiceFinal = fechado ? n - 1 : n - 2;

  for (let i = indiceInicial; i <= indiceFinal; i++) {
    const anterior = pontos[(i - 1 + n) % n];
    const atual = pontos[i];
    const proximo = pontos[(i + 1) % n];

    const vetorEntrada = { x: anterior.x - atual.x, y: anterior.y - atual.y };
    const vetorSaida = { x: proximo.x - atual.x, y: proximo.y - atual.y };
    const distEntrada = Math.hypot(vetorEntrada.x, vetorEntrada.y);
    const distSaida = Math.hypot(vetorSaida.x, vetorSaida.y);
    if (distEntrada < 1e-6 || distSaida < 1e-6) continue;

    const dirEntrada = { x: vetorEntrada.x / distEntrada, y: vetorEntrada.y / distEntrada };
    const dirSaida = { x: vetorSaida.x / distSaida, y: vetorSaida.y / distSaida };

    const cosAngulo = Math.max(
      -1,
      Math.min(1, dirEntrada.x * dirSaida.x + dirEntrada.y * dirSaida.y),
    );
    const anguloEntreVetores = Math.acos(cosAngulo); // 0..π (π = já é reta)
    if (Math.PI - anguloEntreVetores < ANGULO_MINIMO_PARA_ARCO) continue;

    const raio = Math.min(
      raioMaximo,
      (distEntrada / 2) * MARGEM_USO_DO_SEGMENTO,
      (distSaida / 2) * MARGEM_USO_DO_SEGMENTO,
    );
    if (raio < raioMinimo * 0.3) continue;

    const distanciaTangente = raio / Math.tan(anguloEntreVetores / 2);
    const tangenteEntrada = {
      x: atual.x + dirEntrada.x * distanciaTangente,
      y: atual.y + dirEntrada.y * distanciaTangente,
    };
    const tangenteSaida = {
      x: atual.x + dirSaida.x * distanciaTangente,
      y: atual.y + dirSaida.y * distanciaTangente,
    };

    const bissetriz = { x: dirEntrada.x + dirSaida.x, y: dirEntrada.y + dirSaida.y };
    const magBissetriz = Math.hypot(bissetriz.x, bissetriz.y);
    if (magBissetriz < 1e-6) continue;
    const distanciaCentro = raio / Math.sin(anguloEntreVetores / 2);
    const centro = {
      x: atual.x + (bissetriz.x / magBissetriz) * distanciaCentro,
      y: atual.y + (bissetriz.y / magBissetriz) * distanciaCentro,
    };

    const anguloEntrada = Math.atan2(
      tangenteEntrada.y - centro.y,
      tangenteEntrada.x - centro.x,
    );
    const anguloSaida = Math.atan2(
      tangenteSaida.y - centro.y,
      tangenteSaida.x - centro.x,
    );

    filetes.set(i, {
      tangenteEntrada,
      tangenteSaida,
      centro,
      raio,
      anguloEntrada,
      deltaAngular: normalizarAnguloCurto(anguloSaida - anguloEntrada),
    });
  }

  const segmentos: SegmentoTracado[] = [];
  function emitirReta(de: PontoTracado, para: PontoTracado) {
    if (Math.hypot(para.x - de.x, para.y - de.y) > 1e-6) {
      segmentos.push({ tipo: "reta", de, para });
    }
  }
  function emitirFilete(filete: Filete) {
    segmentos.push({
      tipo: "arco",
      de: filete.tangenteEntrada,
      para: filete.tangenteSaida,
      centro: filete.centro,
      raio: filete.raio,
      anguloInicial: filete.anguloEntrada,
      deltaAngular: filete.deltaAngular,
    });
  }

  if (fechado) {
    let cursor = filetes.get(n - 1)?.tangenteSaida ?? pontos[n - 1];
    for (let i = 0; i < n; i++) {
      const filete = filetes.get(i);
      const chegada = filete ? filete.tangenteEntrada : pontos[i];
      emitirReta(cursor, chegada);
      if (filete) {
        emitirFilete(filete);
        cursor = filete.tangenteSaida;
      } else {
        cursor = pontos[i];
      }
    }
  } else {
    let cursor = pontos[0];
    for (let i = 1; i < n - 1; i++) {
      const filete = filetes.get(i);
      const chegada = filete ? filete.tangenteEntrada : pontos[i];
      emitirReta(cursor, chegada);
      if (filete) {
        emitirFilete(filete);
        cursor = filete.tangenteSaida;
      } else {
        cursor = pontos[i];
      }
    }
    emitirReta(cursor, pontos[n - 1]);
  }

  return segmentos;
}

// Path SVG (M/L/A) equivalente aos segmentos — retas de verdade e arcos de
// círculo de verdade, não uma aproximação por curva Bézier.
export function segmentosParaCaminhoSvg(
  segmentos: SegmentoTracado[],
  fechado: boolean,
): string {
  if (segmentos.length === 0) return "";
  const inicio = segmentos[0].de;
  let d = `M ${inicio.x} ${inicio.y}`;
  for (const segmento of segmentos) {
    if (segmento.tipo === "reta") {
      d += ` L ${segmento.para.x} ${segmento.para.y}`;
    } else {
      const sweep = segmento.deltaAngular > 0 ? 1 : 0;
      d += ` A ${segmento.raio} ${segmento.raio} 0 0 ${sweep} ${segmento.para.x} ${segmento.para.y}`;
    }
  }
  if (fechado) d += " Z";
  return d;
}

// Amostragem densa dos mesmos segmentos em pontos {x,y} — usada pra
// alimentar a extrusão 3D (que trabalha com uma spline por pontos, não com
// primitivas de reta/arco diretamente), mantendo o mesmo desenho
// vetorizado também na cena 3D.
export function segmentosParaPontosDensos(
  segmentos: SegmentoTracado[],
  pontosPorUnidade = 0.35,
): PontoTracado[] {
  const pontos: PontoTracado[] = [];
  function adicionar(p: PontoTracado) {
    const ultimo = pontos[pontos.length - 1];
    if (!ultimo || Math.hypot(ultimo.x - p.x, ultimo.y - p.y) > 1e-6) {
      pontos.push(p);
    }
  }
  for (const segmento of segmentos) {
    if (segmento.tipo === "reta") {
      adicionar(segmento.de);
      adicionar(segmento.para);
    } else {
      const comprimentoArco = Math.abs(segmento.deltaAngular) * segmento.raio;
      const numPontos = Math.max(4, Math.ceil(comprimentoArco * pontosPorUnidade));
      for (let i = 0; i <= numPontos; i++) {
        const angulo =
          segmento.anguloInicial + (segmento.deltaAngular * i) / numPontos;
        adicionar({
          x: segmento.centro.x + Math.cos(angulo) * segmento.raio,
          y: segmento.centro.y + Math.sin(angulo) * segmento.raio,
        });
      }
    }
  }
  return pontos;
}
