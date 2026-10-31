// Decoder de mentira para testar o caminho inteiro (coletor → sistema → tela)
// sem equipamento. Os códigos começam com "SIM" pra nunca se confundirem com
// transponders reais.
//
//   "transponders": ["SIM1001", "SIM1002"]   // opcional
//   "voltaMs": 45000                          // tempo médio de volta
//   "aceleracao": 1                           // 10 = dez vezes mais rápido
export const driver = {
  id: "simulador",
  nome: "Simulador (testes, sem equipamento)",
  portasComuns: [],

  reconhece() {
    return false;
  },

  async iniciar(config, ctx) {
    const codigos = config.transponders ?? [
      "SIM1001",
      "SIM1002",
      "SIM1003",
      "SIM1004",
    ];
    const base = (config.voltaMs ?? 45_000) / (config.aceleracao ?? 1);
    const timers = new Set();
    let parado = false;

    const agendar = (codigo, ritmo) => {
      const atraso = ritmo * (0.95 + Math.random() * 0.1);
      const t = setTimeout(() => {
        timers.delete(t);
        if (parado) return;
        ctx.emitir({
          transponder: codigo,
          instanteMs: Date.now(),
          forca: 90 + Math.floor(Math.random() * 20),
          bruto: "simulado",
        });
        agendar(codigo, ritmo);
      }, atraso);
      timers.add(t);
    };

    ctx.conectado(true);
    ctx.log(
      `simulando ${codigos.length} transponders (volta ~${Math.round(base / 1000)}s).`,
    );
    codigos.forEach((codigo, i) => {
      // Cada kart com um ritmo um pouco diferente e largada escalonada.
      const ritmo = base * (1 + i * 0.015);
      const t = setTimeout(() => {
        timers.delete(t);
        if (parado) return;
        ctx.emitir({
          transponder: codigo,
          instanteMs: Date.now(),
          bruto: "simulado",
        });
        agendar(codigo, ritmo);
      }, i * 700);
      timers.add(t);
    });

    return {
      parar() {
        parado = true;
        for (const t of timers) clearTimeout(t);
      },
    };
  },
};
