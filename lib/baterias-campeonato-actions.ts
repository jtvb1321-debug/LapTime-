"use server";

import { executarAuditado } from "@/lib/acao-auditada";
import { ipDaRequisicao } from "@/lib/auth";
import {
  criarBateriasDaEtapa,
  excluirBateriaDoCampeonato,
  sincronizarPilotosDaBateria,
} from "@/lib/baterias-campeonato-store";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { AcaoState } from "@/lib/operacao-actions";

const CAMINHOS = [
  "/admin/baterias",
  "/admin/balizamento",
  "/admin/live-timing",
  "/admin/cronometragem/pista",
];

// Cria uma bateria (classificação + corrida) para cada categoria com inscritos confirmados.
export async function criarBateriasDaEtapaAction(
  etapaId: string,
): Promise<AcaoState> {
  let criadas = 0;
  let semInscritos = false;
  const r = await executarAuditado(
    {
      permissao: "sessao.operar",
      acao: "bateria_campeonato.criar",
      entidade: "etapa",
      entidadeId: etapaId,
      caminhos: CAMINHOS,
      mensagemOk: "",
    },
    async ({ usuarioId }) => {
      const res = await criarBateriasDaEtapa(etapaId, {
        usuarioId,
        ip: await ipDaRequisicao(),
      });
      criadas = res.criadas;
      semInscritos = res.semInscritos;
      if (semInscritos) {
        throw new ErroNegocio(
          "Nenhum piloto tem inscrição confirmada nesta etapa. Confirme os pagamentos em Inscrições primeiro.",
        );
      }
    },
  );
  if (r.erro) return r;
  return {
    ok:
      criadas === 0
        ? "Todas as categorias com inscritos já têm bateria."
        : `${criadas} bateria(s) criada(s). Prepare karts e sensores na cronometragem.`,
  };
}

export async function sincronizarPilotosDaBateriaAction(
  bateriaId: string,
): Promise<AcaoState> {
  let novos = 0;
  const r = await executarAuditado(
    {
      permissao: "sessao.operar",
      acao: "bateria_campeonato.sincronizar",
      entidade: "bateria_campeonato",
      entidadeId: bateriaId,
      caminhos: CAMINHOS,
      mensagemOk: "",
    },
    async ({ usuarioId }) => {
      novos = await sincronizarPilotosDaBateria(bateriaId, {
        usuarioId,
        ip: await ipDaRequisicao(),
      });
    },
  );
  if (r.erro) return r;
  return {
    ok:
      novos === 0
        ? "Nenhum inscrito novo para acrescentar."
        : `${novos} piloto(s) acrescentado(s) à bateria.`,
  };
}

export async function excluirBateriaDoCampeonatoAction(
  bateriaId: string,
): Promise<AcaoState> {
  return executarAuditado(
    {
      permissao: "sessao.operar",
      acao: "bateria_campeonato.excluir",
      entidade: "bateria_campeonato",
      entidadeId: bateriaId,
      caminhos: CAMINHOS,
      mensagemOk: "Bateria excluída.",
    },
    async ({ usuarioId }) =>
      excluirBateriaDoCampeonato(bateriaId, {
        usuarioId,
        ip: await ipDaRequisicao(),
      }),
  );
}
