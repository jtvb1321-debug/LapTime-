// As cores de número/assinatura são escolhidas pelo piloto pensando no
// overlay de transmissão (fundo escuro) — num fundo claro (site), uma cor
// muito clara (o padrão é quase branco) fica ilegível. Troca por um
// fallback escuro só quando a cor escolhida não teria contraste suficiente.
function luminanciaRelativa(hex: string): number | null {
  const limpo = hex.replace("#", "");
  if (limpo.length !== 6) return null;
  const r = parseInt(limpo.slice(0, 2), 16);
  const g = parseInt(limpo.slice(2, 4), 16);
  const b = parseInt(limpo.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function corParaFundoClaro(
  hex: string | undefined | null,
  fallbackEscuro: string,
): string {
  if (!hex) return fallbackEscuro;
  const luminancia = luminanciaRelativa(hex);
  if (luminancia === null) return fallbackEscuro;
  return luminancia > 0.75 ? fallbackEscuro : hex;
}
