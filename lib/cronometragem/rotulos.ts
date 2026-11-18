import type { EstadoConexao } from "@/lib/cronometragem/decoders-store";
import type { EstadoCorrida } from "@/lib/cronometragem/corridas-store";
import type {
  Diferenca,
  ModoEncerramento,
  RegraLargada,
  Situacao,
  StatusPassagem,
} from "@/lib/cronometragem/motor";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";

// Textos (em português) mostrados nas telas da cronometragem.
export type Tom = "ink" | "orange" | "orange-soft" | "neutral";

export const ESTADO_CORRIDA: Record<
  EstadoCorrida,
  { rotulo: string; tom: Tom }
> = {
  preparada: { rotulo: "Em preparação", tom: "neutral" },
  pronta: { rotulo: "Pronta para iniciar", tom: "orange-soft" },
  em_andamento: { rotulo: "Em andamento", tom: "orange" },
  encerrando: { rotulo: "Encerrando", tom: "orange" },
  finalizada: { rotulo: "Finalizada", tom: "ink" },
  cancelada: { rotulo: "Cancelada", tom: "neutral" },
};

export const ESTADO_CONEXAO: Record<
  EstadoConexao,
  { rotulo: string; tom: Tom }
> = {
  conectado: { rotulo: "Decoder conectado", tom: "ink" },
  decoder_desconectado: {
    rotulo: "Coletor ativo, decoder desconectado",
    tom: "orange",
  },
  coletor_offline: { rotulo: "Coletor offline", tom: "orange" },
  desativado: { rotulo: "Desativado", tom: "neutral" },
};

export const SITUACAO: Record<Situacao, string> = {
  sem_sensor: "Sem sensor",
  aguardando_largada: "Aguardando largada",
  em_pista: "Na pista",
  finalizou: "Finalizou",
  sem_volta: "Sem volta completa",
  nao_largou: "Não largou",
  dns: "DNS (não largou)",
  dnf: "DNF (não terminou)",
  dsq: "DSQ (desclassificado)",
};

export const STATUS_PASSAGEM: Record<
  StatusPassagem,
  { rotulo: string; tom: Tom }
> = {
  largada: { rotulo: "Largada", tom: "ink" },
  volta: { rotulo: "Volta", tom: "ink" },
  volta_final: { rotulo: "Volta final", tom: "ink" },
  duplicada: { rotulo: "Repetida", tom: "orange-soft" },
  antes_da_largada: { rotulo: "Antes da largada", tom: "neutral" },
  depois_do_fim: { rotulo: "Depois do fim", tom: "neutral" },
  apos_bandeira: { rotulo: "Após a bandeira", tom: "neutral" },
  invalidada: { rotulo: "Invalidada", tom: "orange" },
  sem_participante: { rotulo: "Sem piloto", tom: "orange-soft" },
};

export const REGRA_LARGADA: Record<RegraLargada, string> = {
  primeira_passagem: "A primeira leitura é a largada (a volta 1 termina na 2ª)",
  largada_da_corrida: "A volta 1 conta desde o início da corrida",
};

export const MODO_ENCERRAMENTO: Record<ModoEncerramento, string> = {
  manual: "Manual: as passagens valem até o operador finalizar",
  proxima_passagem:
    "Cada piloto termina na próxima passagem após o fim do tempo",
  corte_imediato: "Passagens depois do fim do tempo não contam",
};

export function textoDiferenca(d: Diferenca | null): string {
  if (!d || d.tipo === "lider") return "—";
  if (d.tipo === "tempo") return `+${formatarTempoVolta(d.ms)}`;
  return `+${d.voltas} ${d.voltas === 1 ? "volta" : "voltas"}`;
}

export function nomeDoSensor(codigo: string, rotulo?: string | null): string {
  return rotulo ? `${rotulo} (${codigo})` : codigo;
}
