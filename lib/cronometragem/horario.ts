import { instanteLocal } from "@/lib/operacao/tempo";

// "15:42:07" ou "15:42:07.350" (horário de Brasília) num dia AAAA-MM-DD →
// milissegundos desde 1970; null se o texto não for um horário válido.
export function horaDoDiaParaMs(dia: string, texto: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:[.,](\d{1,3}))?$/.exec(
    texto.trim(),
  );
  if (!m) return null;
  const base = instanteLocal(dia, `${m[1]}:${m[2]}`).getTime();
  if (Number.isNaN(base)) return null;
  const milis = m[4] ? Number(m[4].padEnd(3, "0")) : 0;
  return base + Number(m[3]) * 1000 + milis;
}
