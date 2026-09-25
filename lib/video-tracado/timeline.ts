// Fonte única de verdade pro tempo de cada cena (em segundos) — usada tanto
// no preview ao vivo quanto na exportação frame a frame, pra garantir que os
// dois processos produzam exatamente a mesma animação.
export const FPS = 30;
export const DURACAO_TOTAL = 54;

// Estrutura em "moldura": começa com uma vista aérea ainda sem o traçado
// desenhado (`visaoAbertaIntro` — encurtada, pra chegar rápido na parte
// interessante) e mergulha (`mergulho`, 2s) direto pro voo por dentro,
// desenhando o traçado pela primeira vez, curva por curva, com os nomes
// aparecendo (`tracadoLuminoso` — ainda mais longa, pra não parecer
// apressado) — só aí, no fim do voo, o traçado fica completo, e a câmera
// sobe de volta pra uma vista aérea mostrando ele pronto, numa transição
// também mais longa (ver `duracaoTransicaoSaida` em cena3d.ts).
export const CENAS = {
  abertura: [0, 1],
  revelacao: [1, 3],
  visaoAbertaIntro: [3, 5],
  mergulho: [5, 7],
  tracadoLuminoso: [7, 37],
  largada: [37, 39],
  sobrevoo: [39, 44],
  visaoAberta: [44, 48],
  visaoFinal: [48, 52],
  encerramento: [52, 54],
} as const satisfies Record<string, [number, number]>;

// Interpola t dentro de [inicio,fim] pra 0..1, com clamp nas pontas — usado
// em todo lugar que precisa saber "quanto dessa cena já passou".
export function progressoNaCena(t: number, cena: [number, number]) {
  const [inicio, fim] = cena;
  if (t <= inicio) return 0;
  if (t >= fim) return 1;
  return (t - inicio) / (fim - inicio);
}

// Facilita curvas de aceleração/desaceleração sem depender do GSAP pra
// funções puras usadas na exportação (que já usa o easing do próprio
// GSAP pra câmera, mas overlays e opacidades usam isto).
export function suavizar(x: number) {
  return x * x * (3 - 2 * x);
}
