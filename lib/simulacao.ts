import fs from "node:fs";
import path from "node:path";
import { etapas, substituirDadosDeCorrida } from "@/lib/mock/data";
import {
  BATERIAS_SIMULADAS,
  PILOTOS_SIMULADOS,
  RESULTADOS_SIMULADOS,
  STATUS_ETAPAS_SIMULADO,
} from "@/lib/mock/simulacao-dados";

// Liga/desliga a simulação de demonstração (pilotos, baterias, resultados e
// status das etapas). O estado fica em .data/simulacao.json — sobrevive a
// reinícios do servidor — e é aplicado nos arrays em memória de
// lib/mock/data.ts. Só roda no servidor (usa fs).
const ARQUIVO = path.join(process.cwd(), ".data", "simulacao.json");

type Global = typeof globalThis & { __gridlapSimulacaoLida?: boolean };

function lerArquivo(): boolean {
  try {
    const bruto = fs.readFileSync(ARQUIVO, "utf-8");
    return JSON.parse(bruto)?.ativa === true;
  } catch {
    return false;
  }
}

function aplicar(ativa: boolean) {
  substituirDadosDeCorrida({
    pilotos: ativa ? PILOTOS_SIMULADOS : [],
    baterias: ativa ? BATERIAS_SIMULADAS : [],
    resultados: ativa ? RESULTADOS_SIMULADOS : [],
    simulacaoAtiva: ativa,
  });
  for (const etapa of etapas) {
    const simulado = STATUS_ETAPAS_SIMULADO[etapa.id];
    if (simulado) etapa.status = ativa ? simulado : "agendada";
  }
}

// Aplica o estado salvo uma única vez por processo (chamado no start do
// servidor, ver instrumentation.ts).
export function garantirEstadoSimulacao() {
  const g = globalThis as Global;
  if (g.__gridlapSimulacaoLida) return;
  g.__gridlapSimulacaoLida = true;
  aplicar(lerArquivo());
}

export function definirSimulacao(ativa: boolean) {
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify({ ativa }));
  (globalThis as Global).__gridlapSimulacaoLida = true;
  aplicar(ativa);
}
