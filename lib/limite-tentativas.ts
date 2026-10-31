// Limite simples de tentativas por chave (IP, link, código...) numa janela de
// tempo, na memória do servidor. Serve de freio para endpoints públicos; não
// substitui um limite no proxy quando houver mais de uma instância.
const tentativas = new Map<string, number[]>();

export function excedeuLimite(
  chave: string,
  maximo: number,
  janelaMs: number,
): boolean {
  const agora = Date.now();
  const recentes = (tentativas.get(chave) ?? []).filter(
    (t) => agora - t < janelaMs,
  );
  recentes.push(agora);
  tentativas.set(chave, recentes);
  if (tentativas.size > 5000) {
    for (const [k, v] of tentativas) {
      if (v.every((t) => agora - t >= janelaMs)) tentativas.delete(k);
    }
  }
  return recentes.length > maximo;
}
