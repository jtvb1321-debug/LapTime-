"use server";

import { executarAuditado } from "@/lib/acao-auditada";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { AcaoState } from "@/lib/operacao-actions";
import type { ConfigDePontuacao } from "@/lib/pontuacao-campeonato";
import {
  anularPunicao,
  criarPunicao,
  criarRecurso,
  decidirRecurso,
  forcarAtualizacaoDaClassificacao,
  salvarPontuacao,
  type DadosDaPunicao,
} from "@/lib/resultados-campeonato-store";

const CAMINHOS = [
  "/admin/pontuacao",
  "/admin/resultados",
  "/admin/punicoes",
  "/admin/recursos",
  "/admin/pilotos",
  "/campeonato/classificacao",
  "/campeonato/resultados",
  "/area-do-piloto",
  "/",
];

// A classificação gravada nos pilotos é refeita depois de qualquer mudança que mexa nos pontos.
async function refazer() {
  await forcarAtualizacaoDaClassificacao();
}

export async function salvarPontuacaoAction(
  campeonatoId: string,
  cfg: ConfigDePontuacao,
): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "cadastro.gerenciar",
      acao: "pontuacao.salvar",
      entidade: "campeonato",
      entidadeId: campeonatoId,
      depois: cfg,
      caminhos: CAMINHOS,
      mensagemOk: "Tabela de pontos salva e classificação recalculada.",
    },
    async ({ usuarioId }) => {
      await salvarPontuacao(campeonatoId, cfg, usuarioId);
      await refazer();
    },
  );
}

export async function criarPunicaoAction(
  campeonatoId: string,
  dados: DadosDaPunicao,
): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "cadastro.gerenciar",
      acao: "punicao.criar",
      entidade: "campeonato",
      entidadeId: campeonatoId,
      depois: dados,
      caminhos: CAMINHOS,
      mensagemOk: "Punição registrada e classificação recalculada.",
    },
    async ({ usuarioId }) => {
      await criarPunicao(campeonatoId, dados, usuarioId);
      await refazer();
    },
  );
}

export async function anularPunicaoAction(id: string): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "cadastro.gerenciar",
      acao: "punicao.anular",
      entidade: "punicao_campeonato",
      entidadeId: id,
      caminhos: CAMINHOS,
      mensagemOk: "Punição anulada e classificação recalculada.",
    },
    async ({ usuarioId }) => {
      await anularPunicao(id, usuarioId);
      await refazer();
    },
  );
}

// O piloto abre o recurso no campeonato ativo; o piloto vem da sessão, nunca do formulário.
export async function criarRecursoAction(
  etapaId: string | null,
  texto: string,
): Promise<AcaoState> {
  return executarAuditado(
    {
      comoPiloto: true,
      acao: "recurso.criar",
      entidade: "recurso",
      entidadeId: null,
      depois: { etapaId },
      caminhos: CAMINHOS,
      mensagemOk: "Recurso enviado. A organização vai responder aqui.",
    },
    async ({ pilotoId }) => {
      if (!pilotoId) throw new ErroNegocio("Esta conta não é de um piloto.");
      const ativo = await lerCampeonatoAtivo();
      if (!ativo) throw new ErroNegocio("Não há campeonato ativo.");
      await criarRecurso(pilotoId, ativo.id, etapaId, texto);
    },
  );
}

export async function decidirRecursoAction(
  id: string,
  decisao: string,
  parecer: string,
): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "cadastro.gerenciar",
      acao: "recurso.decidir",
      entidade: "recurso",
      entidadeId: id,
      depois: { decisao },
      caminhos: CAMINHOS,
      mensagemOk: "Decisão registrada.",
    },
    async ({ usuarioId }) => {
      await decidirRecurso(id, decisao, parecer, usuarioId);
    },
  );
}

export async function recalcularClassificacaoAction(): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "cadastro.gerenciar",
      acao: "classificacao.recalcular",
      entidade: "campeonato",
      entidadeId: null,
      caminhos: CAMINHOS,
      mensagemOk: "Classificação recalculada.",
    },
    async () => {
      await refazer();
    },
  );
}
