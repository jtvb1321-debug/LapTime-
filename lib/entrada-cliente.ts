export type ResultadoEntrada = "ok" | "negado" | "erro";

export interface OpcoesEntrada {
  fetcher?: typeof fetch;
  minimoMs?: number;
  limiteMs?: number;
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Confirma a sessão no servidor (e apaga o cookie da animação) enquanto a
// animação corre. Resolve só depois do tempo mínimo da animação, sem atraso
// extra: se a resposta demorar mais, a animação espera por ela; se falhar ou
// passar do limite, devolve "erro" para a tela oferecer nova tentativa.
export async function confirmarEntrada({
  fetcher = fetch,
  minimoMs = 1500,
  limiteMs = 12_000,
}: OpcoesEntrada = {}): Promise<ResultadoEntrada> {
  const controle = new AbortController();
  const corte = setTimeout(() => controle.abort(), limiteMs);
  const resposta = (async (): Promise<ResultadoEntrada> => {
    try {
      const r = await fetcher("/api/entrada", {
        method: "POST",
        cache: "no-store",
        signal: controle.signal,
      });
      if (r.status === 401 || r.status === 403) return "negado";
      return r.ok ? "ok" : "erro";
    } catch {
      return "erro";
    } finally {
      clearTimeout(corte);
    }
  })();
  const [resultado] = await Promise.all([resposta, esperar(minimoMs)]);
  return resultado;
}
