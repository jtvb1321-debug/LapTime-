// Cada categoria tem uma cor própria — como as divisões de uma liga — pra dar
// vida ao site e facilitar reconhecer a categoria de relance nas listas,
// cards e selos. É uma paleta própria pra identificação visual, separada da
// paleta semântica principal do site (preto = ação/estrutura, roxo = ao vivo/
// energia).
const CORES_BADGE: Record<string, string> = {
  "cat-rookie": "bg-indigo-500/10 text-indigo-600",
  "cat-intermediaria": "bg-teal-500/10 text-teal-700",
  "cat-master": "bg-orange/10 text-orange-ink",
};

const CORES_SOLIDA: Record<string, string> = {
  "cat-rookie": "bg-indigo-500",
  "cat-intermediaria": "bg-teal-500",
  "cat-master": "bg-orange",
};

export function corBadgeCategoria(categoriaId: string) {
  return CORES_BADGE[categoriaId] ?? "bg-ink/5 text-ink-2";
}

export function corSolidaCategoria(categoriaId: string) {
  return CORES_SOLIDA[categoriaId] ?? "bg-ink-3";
}
