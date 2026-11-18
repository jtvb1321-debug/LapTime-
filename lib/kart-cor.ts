// Paleta fixa só para diferenciar os números de kart visualmente (não é a
// paleta semântica do site) — cicla por posição, igual às fichas de sorteio
// usadas na cronometragem. Compartilhada entre o balizamento e os painéis
// que mostram o kart de cada piloto (dashboard, live timing).
const PALETA_KART = [
  "bg-ink text-white",
  "bg-pink-400 text-ink",
  "bg-blue-600 text-white",
  "border-border-strong bg-white text-ink border",
  "bg-teal-400 text-ink",
  "bg-amber-400 text-ink",
  "bg-slate-700 text-white",
  "bg-emerald-500 text-ink",
  "bg-purple-400 text-ink",
  "bg-red-400 text-ink",
];

export function corDoKart(numero: number) {
  if (!Number.isFinite(numero) || numero <= 0) return "bg-ink/5 text-ink-3";
  return PALETA_KART[(numero - 1) % PALETA_KART.length];
}
