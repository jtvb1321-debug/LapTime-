// Converte o texto de hora que o decoder manda em milissegundos desde 1970.
// Devolve null se não entender (a passagem fica com a hora do coletor).
//   ms      → "1761500000123"
//   s       → "1761500000.123"
//   us      → "1761500000123456"
//   iso     → "2026-10-24T15:55:01.123-03:00"
//   hhmmss  → "15:55:01.123" (hora do dia no relógio DESTE computador)
export function converterTempo(valor, unidade, agora = Date.now()) {
  const v = String(valor).trim();
  switch (unidade) {
    case "ms": {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "s": {
      const n = Number(v);
      return Number.isFinite(n) ? n * 1000 : null;
    }
    case "us": {
      const n = Number(v);
      return Number.isFinite(n) ? n / 1000 : null;
    }
    case "iso": {
      const t = Date.parse(v);
      return Number.isNaN(t) ? null : t;
    }
    case "hhmmss": {
      const m = /^(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?$/.exec(v);
      if (!m) return null;
      const d = new Date(agora);
      const milis = m[4] ? Math.round(Number(`0.${m[4]}`) * 1000) : 0;
      d.setHours(Number(m[1]), Number(m[2]), Number(m[3]), milis);
      let t = d.getTime();
      // Passagem de "ontem" lida logo depois da meia-noite.
      if (t > agora + 60_000) t -= 86_400_000;
      return t;
    }
    default:
      return null;
  }
}
