import type { PoolClient } from "pg";
import { consultar } from "@/lib/db/conexao";

// Trilha de auditoria (tabela audit_log, somente de inclusão — o banco
// recusa UPDATE e DELETE). Registre aqui toda ação crítica, com valores
// antes/depois e o motivo quando houver.
export interface EventoAuditoria {
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
  motivo?: string | null;
  ip?: string | null;
}

function json(valor: unknown): string | null {
  return valor === undefined ? null : JSON.stringify(valor);
}

// Passe `cliente` para gravar a auditoria na MESMA transação da operação
// (o registro some junto se a operação for desfeita).
export async function registrarAuditoria(
  evento: EventoAuditoria,
  cliente?: PoolClient,
) {
  const texto = `insert into audit_log (usuario_id, acao, entidade, entidade_id, antes, depois, motivo, ip)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`;
  const parametros = [
    evento.usuarioId ?? null,
    evento.acao,
    evento.entidade,
    evento.entidadeId ?? null,
    json(evento.antes),
    json(evento.depois),
    evento.motivo ?? null,
    evento.ip ?? null,
  ];
  if (cliente) await cliente.query(texto, parametros);
  else await consultar(texto, parametros);
}
