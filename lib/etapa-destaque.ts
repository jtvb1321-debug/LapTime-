// Qual etapa a página inicial destaca como "próxima": a primeira agendada; sem nenhuma agendada, a
// primeira da lista. É a mesma regra que a página inicial já usava, agora num só lugar para o
// destaque, o calendário e a pista usarem a mesma etapa. Só leitura: não cria nem altera etapas.
export function escolherProximaEtapa<T extends { status: string }>(
  etapas: T[],
): T | undefined {
  return etapas.find((e) => e.status === "agendada") ?? etapas[0];
}

export const TOM_DO_STATUS = {
  agendada: "neutral",
  em_andamento: "orange",
  encerrada: "ink",
  cancelada: "neutral",
} as const;

export function rotuloDoStatus(status: string): string {
  return status.replace("_", " ");
}
