// As cores de número/assinatura são escolhidas pelo piloto pensando no
// overlay de transmissão (fundo escuro) — num fundo claro (site), uma cor
// muito clara (o padrão é quase branco) fica ilegível. Troca por um
// fallback escuro quando a cor é quase branca e, nos demais casos, escurece a
// própria cor (mantendo o tom) até o contraste mínimo de 4,5:1 sobre branco.
function canais(hex: string): [number, number, number] | null {
  const limpo = hex.replace("#", "");
  if (limpo.length !== 6) return null;
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return [r, g, b];
}

function luminanciaPercebida(hex: string): number | null {
  const c = canais(hex);
  return c ? (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 : null;
}

// Luminância relativa do WCAG.
function luminanciaWcag([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const CONTRASTE_MINIMO = 4.5;

function comContrasteSobreBranco(hex: string): string {
  let c = canais(hex);
  if (!c) return hex;
  for (let i = 0; i < 30; i += 1) {
    if (1.05 / (luminanciaWcag(c) + 0.05) >= CONTRASTE_MINIMO) break;
    c = [c[0] * 0.92, c[1] * 0.92, c[2] * 0.92];
  }
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

export function corParaFundoClaro(
  hex: string | undefined | null,
  fallbackEscuro: string,
): string {
  if (!hex) return comContrasteSobreBranco(fallbackEscuro);
  const luminancia = luminanciaPercebida(hex);
  if (luminancia === null || luminancia > 0.75)
    return comContrasteSobreBranco(fallbackEscuro);
  return comContrasteSobreBranco(hex);
}
