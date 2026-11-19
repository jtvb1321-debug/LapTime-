"use server";

import { executarAuditado } from "@/lib/acao-auditada";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { AcaoState } from "@/lib/operacao-actions";
import {
  cancelarInscricao,
  confirmarPagamento,
  estornarPagamento,
  inscreverPiloto,
} from "@/lib/inscricoes-store";
import { consultar } from "@/lib/db/conexao";

const CAMINHOS = [
  "/admin/inscricoes",
  "/admin/pagamentos",
  "/inscricao",
  "/area-do-piloto",
];

// O piloto se inscreve sozinho: o piloto vem da sessão, nunca do formulário.
export async function inscreverMeAction(etapaId: string): Promise<AcaoState> {
  let gratuita = false;
  const r = await executarAuditado(
    {
      comoPiloto: true,
      acao: "inscricao.criar",
      entidade: "etapa",
      entidadeId: etapaId,
      caminhos: CAMINHOS,
      mensagemOk: "Inscrição feita!",
    },
    async ({ pilotoId }) => {
      if (!pilotoId) throw new ErroNegocio("Esta conta não é de um piloto.");
      gratuita = (await inscreverPiloto(etapaId, pilotoId, pilotoId)).gratuita;
    },
  );
  if (r.ok) {
    return {
      ok: gratuita
        ? "Inscrição confirmada!"
        : "Inscrição feita! Falta o pagamento: combine com a organização.",
    };
  }
  return r;
}

export async function inscreverPilotoAction(
  etapaId: string,
  pilotoId: string,
): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "cadastro.gerenciar",
      acao: "inscricao.criar_admin",
      entidade: "etapa",
      entidadeId: etapaId,
      depois: { pilotoId },
      caminhos: CAMINHOS,
      mensagemOk: "Piloto inscrito.",
    },
    async ({ usuarioId }) => {
      await inscreverPiloto(etapaId, pilotoId, usuarioId);
    },
  );
}

export async function cancelarInscricaoAction(
  inscricaoId: string,
): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "cadastro.gerenciar",
      acao: "inscricao.cancelar",
      entidade: "inscricao",
      entidadeId: inscricaoId,
      caminhos: CAMINHOS,
      mensagemOk: "Inscrição cancelada.",
    },
    () => cancelarInscricao(inscricaoId),
  );
}

// O piloto só cancela a PRÓPRIA inscrição (e só se o pagamento ainda não foi confirmado).
export async function cancelarMinhaInscricaoAction(
  inscricaoId: string,
): Promise<AcaoState> {
  return executarAuditado(
    {
      comoPiloto: true,
      acao: "inscricao.cancelar_piloto",
      entidade: "inscricao",
      entidadeId: inscricaoId,
      caminhos: CAMINHOS,
      mensagemOk: "Inscrição cancelada.",
    },
    async ({ pilotoId }) => {
      const [dona] = await consultar<{ piloto_id: string }>(
        "select piloto_id from inscricao where id = $1",
        [inscricaoId],
      );
      if (!dona || dona.piloto_id !== pilotoId) {
        throw new ErroNegocio("Inscrição não encontrada.");
      }
      await cancelarInscricao(inscricaoId);
    },
  );
}

export async function confirmarPagamentoAction(
  pagamentoId: string,
  metodo: string,
): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "cadastro.gerenciar",
      acao: "pagamento.confirmar",
      entidade: "pagamento",
      entidadeId: pagamentoId,
      depois: { metodo },
      caminhos: CAMINHOS,
      mensagemOk: "Pagamento confirmado.",
    },
    ({ usuarioId }) => confirmarPagamento(pagamentoId, metodo, usuarioId),
  );
}

export async function estornarPagamentoAction(
  pagamentoId: string,
): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "caixa.estornar",
      acao: "pagamento.estornar",
      entidade: "pagamento",
      entidadeId: pagamentoId,
      caminhos: CAMINHOS,
      mensagemOk: "Pagamento estornado e inscrição cancelada.",
    },
    () => estornarPagamento(pagamentoId),
  );
}
