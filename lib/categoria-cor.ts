// Cada categoria tem uma cor própria — como as divisões de uma liga — pra dar
// vida ao site e facilitar reconhecer a categoria de relance nas listas,
// cards e selos: Master azul, Intermediária amarela, Rookie verde, Sênior
// branca e Feminina rosa. É uma paleta própria pra identificação visual,
// separada da paleta semântica principal do site.
const CORES_BADGE: Record<string, string> = {
  "cat-master": "bg-blue-500/15 text-blue-400",
  "cat-intermediaria": "bg-yellow-400/15 text-yellow-300",
  "cat-rookie": "bg-green-500/15 text-green-400",
  "cat-senior": "bg-white/15 text-white",
  "cat-feminina": "bg-pink-500/15 text-pink-400",
};

const CORES_SOLIDA: Record<string, string> = {
  "cat-master": "bg-blue-500",
  "cat-intermediaria": "bg-yellow-400",
  "cat-rookie": "bg-green-500",
  "cat-senior": "bg-white",
  "cat-feminina": "bg-pink-500",
};

// Só a cor do texto (para o nome da categoria).
const CORES_TEXTO: Record<string, string> = {
  "cat-master": "text-blue-400",
  "cat-intermediaria": "text-yellow-300",
  "cat-rookie": "text-green-400",
  "cat-senior": "text-white",
  "cat-feminina": "text-pink-400",
};

export function corBadgeCategoria(categoriaId: string) {
  return CORES_BADGE[categoriaId] ?? "bg-ink/5 text-ink-2";
}

export function corSolidaCategoria(categoriaId: string) {
  return CORES_SOLIDA[categoriaId] ?? "bg-ink-3";
}

export function corTextoCategoria(categoriaId: string) {
  return CORES_TEXTO[categoriaId] ?? "text-ink";
}
