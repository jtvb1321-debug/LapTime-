"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registrarAuditoria } from "@/lib/audit";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import {
  adicionarLogo,
  ativarCampeonato,
  atualizarDados,
  criarCampeonato,
  definirCategorias,
  definirPilotos,
  definirTracados,
  encerrarCampeonato,
  excluirCampeonato,
  removerLogo,
} from "@/lib/campeonatos-store";
import { salvarEnquadramentoDaImagem } from "@/lib/campeonato-imagem-store";
import {
  atualizarEtapa,
  criarEtapa,
  excluirEtapa,
  type DadosDaEtapa,
} from "@/lib/etapas-store";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { AcaoState } from "@/lib/operacao-actions";
import {
  atualizarTracado,
  criarTracado,
  excluirTracado,
  type DadosDoTracado,
} from "@/lib/tracados-store";

const PERMISSAO = "cadastro.gerenciar" as const;

function texto(dados: FormData, campo: string) {
  return String(dados.get(campo) ?? "");
}

// Roda a operação com permissão, auditoria e mensagem de erro amigável.
async function executar(
  acao: string,
  entidade: string,
  entidadeId: string | null,
  depois: unknown,
  operacao: (usuarioId: string) => Promise<void>,
  caminhos: string[],
  mensagemOk: string,
): Promise<AcaoState> {
  const sessao = await exigirPermissao(PERMISSAO);
  if (!sessao) return { erro: "Você não tem permissão para fazer isso." };
  try {
    await operacao(sessao.id);
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message };
    return {
      erro: "Não foi possível salvar. Tente de novo; se continuar, avise o suporte.",
    };
  }
  await registrarAuditoria({
    usuarioId: sessao.id,
    acao,
    entidade,
    entidadeId,
    depois,
    ip: await ipDaRequisicao(),
  });
  for (const c of caminhos) revalidatePath(c);
  return { ok: mensagemOk };
}

const CAMINHOS = ["/admin/campeonatos", "/", "/admin/pilotos"];

// Passo 1: cria o campeonato (rascunho) e abre o assistente.
export async function criarCampeonatoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const sessao = await exigirPermissao(PERMISSAO);
  if (!sessao) return { erro: "Você não tem permissão para fazer isso." };
  let id: string;
  try {
    id = await criarCampeonato(
      {
        nome: texto(dados, "nome"),
        temporada: texto(dados, "temporada"),
        descricao: texto(dados, "descricao"),
      },
      sessao.id,
    );
  } catch (e) {
    if (e instanceof ErroNegocio) return { erro: e.message };
    return { erro: "Não foi possível criar o campeonato. Tente de novo." };
  }
  await registrarAuditoria({
    usuarioId: sessao.id,
    acao: "campeonato.criar",
    entidade: "campeonato",
    entidadeId: id,
    depois: {
      nome: texto(dados, "nome"),
      temporada: texto(dados, "temporada"),
    },
    ip: await ipDaRequisicao(),
  });
  revalidatePath("/admin/campeonatos");
  redirect(`/admin/campeonatos/${id}`);
}

export async function salvarDadosAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const id = texto(dados, "id");
  const novos = {
    nome: texto(dados, "nome"),
    temporada: texto(dados, "temporada"),
    descricao: texto(dados, "descricao"),
  };
  return executar(
    "campeonato.editar",
    "campeonato",
    id,
    novos,
    () => atualizarDados(id, novos),
    [...CAMINHOS, `/admin/campeonatos/${id}`],
    "Dados salvos.",
  );
}

export async function salvarCategoriasDoCampeonatoAction(
  campeonatoId: string,
  categoriaIds: string[],
): Promise<AcaoState> {
  return executar(
    "campeonato.categorias",
    "campeonato",
    campeonatoId,
    { categoriaIds },
    () => definirCategorias(campeonatoId, categoriaIds),
    [...CAMINHOS, `/admin/campeonatos/${campeonatoId}`],
    "Categorias salvas.",
  );
}

export async function salvarTracadosDoCampeonatoAction(
  campeonatoId: string,
  tracadoIds: string[],
): Promise<AcaoState> {
  return executar(
    "campeonato.tracados",
    "campeonato",
    campeonatoId,
    { tracadoIds },
    () => definirTracados(campeonatoId, tracadoIds),
    [...CAMINHOS, `/admin/campeonatos/${campeonatoId}`, "/campeonato/tracados"],
    "Traçados salvos.",
  );
}

export async function salvarEnquadramentoAction(
  campeonatoId: string,
  enquadramento: string,
  focoY: number,
): Promise<AcaoState> {
  return executar(
    "campeonato.imagem_enquadramento",
    "campeonato",
    campeonatoId,
    { enquadramento, focoY },
    () => salvarEnquadramentoDaImagem(campeonatoId, enquadramento, focoY),
    [...CAMINHOS, `/admin/campeonatos/${campeonatoId}`],
    "Enquadramento salvo.",
  );
}

const CAMINHOS_ETAPA = [
  "/",
  "/campeonato/calendario",
  "/campeonato/tracados",
  "/admin/etapas",
  "/admin/campeonatos",
];

export async function salvarEtapaAction(
  campeonatoId: string,
  etapaId: string | null,
  dados: DadosDaEtapa,
): Promise<AcaoState> {
  return executar(
    etapaId ? "etapa.editar" : "etapa.criar",
    "etapa",
    etapaId,
    { campeonatoId, nome: dados.nome, data: dados.data, hora: dados.hora },
    async () => {
      if (etapaId) await atualizarEtapa(etapaId, dados);
      else await criarEtapa(campeonatoId, dados);
    },
    [...CAMINHOS_ETAPA, `/admin/campeonatos/${campeonatoId}`],
    etapaId ? "Etapa atualizada." : "Etapa adicionada ao calendário.",
  );
}

export async function excluirEtapaAction(
  campeonatoId: string,
  etapaId: string,
): Promise<AcaoState> {
  return executar(
    "etapa.excluir",
    "etapa",
    etapaId,
    { campeonatoId },
    () => excluirEtapa(etapaId),
    [...CAMINHOS_ETAPA, `/admin/campeonatos/${campeonatoId}`],
    "Etapa excluída.",
  );
}

export async function salvarPilotosDoCampeonatoAction(
  campeonatoId: string,
  pilotoIds: string[],
): Promise<AcaoState> {
  return executar(
    "campeonato.pilotos",
    "campeonato",
    campeonatoId,
    { quantidade: pilotoIds.length },
    () => definirPilotos(campeonatoId, pilotoIds),
    [...CAMINHOS, `/admin/campeonatos/${campeonatoId}`],
    "Pilotos do campeonato salvos.",
  );
}

export async function adicionarLogoAction(
  campeonatoId: string,
  nome: string,
  logo: string,
): Promise<AcaoState> {
  return executar(
    "campeonato.logo_adicionar",
    "campeonato",
    campeonatoId,
    { nome, tamanho: logo.length },
    () => adicionarLogo(campeonatoId, nome, logo),
    [...CAMINHOS, `/admin/campeonatos/${campeonatoId}`],
    "Logo adicionado.",
  );
}

export async function removerLogoAction(
  campeonatoId: string,
  logoId: string,
): Promise<AcaoState> {
  return executar(
    "campeonato.logo_remover",
    "campeonato",
    campeonatoId,
    { logoId },
    () => removerLogo(campeonatoId, logoId),
    [...CAMINHOS, `/admin/campeonatos/${campeonatoId}`],
    "Logo removido.",
  );
}

export async function ativarCampeonatoAction(
  campeonatoId: string,
): Promise<AcaoState> {
  return executar(
    "campeonato.ativar",
    "campeonato",
    campeonatoId,
    null,
    () => ativarCampeonato(campeonatoId),
    [...CAMINHOS, `/admin/campeonatos/${campeonatoId}`, "/campeonato/tracados"],
    "Campeonato ativado. Ele já aparece no site.",
  );
}

export async function encerrarCampeonatoAction(
  campeonatoId: string,
): Promise<AcaoState> {
  return executar(
    "campeonato.encerrar",
    "campeonato",
    campeonatoId,
    null,
    () => encerrarCampeonato(campeonatoId),
    [...CAMINHOS, `/admin/campeonatos/${campeonatoId}`],
    "Campeonato encerrado.",
  );
}

export async function excluirCampeonatoAction(
  campeonatoId: string,
): Promise<AcaoState> {
  const r = await executar(
    "campeonato.excluir",
    "campeonato",
    campeonatoId,
    null,
    () => excluirCampeonato(campeonatoId),
    CAMINHOS,
    "Campeonato excluído.",
  );
  if (r.ok) redirect("/admin/campeonatos");
  return r;
}

// ---- Biblioteca de traçados ---------------------------------------------------------------

const CAMINHOS_TRACADO = [
  "/admin/tracados",
  "/admin/campeonatos",
  "/campeonato/tracados",
  "/campeonato/calendario",
  "/admin/video-tracado",
];

export async function salvarTracadoAction(
  id: string | null,
  dados: DadosDoTracado,
): Promise<AcaoState> {
  return executar(
    id ? "tracado.editar" : "tracado.criar",
    "tracado",
    id,
    {
      nome: dados.nome,
      pontos: Array.isArray(dados.pontos) ? dados.pontos.length : 0,
    },
    async () => {
      if (id) await atualizarTracado(id, dados);
      else await criarTracado(dados);
    },
    CAMINHOS_TRACADO,
    id ? "Traçado atualizado." : "Traçado criado.",
  );
}

export async function excluirTracadoAction(id: string): Promise<AcaoState> {
  return executar(
    "tracado.excluir",
    "tracado",
    id,
    null,
    () => excluirTracado(id),
    CAMINHOS_TRACADO,
    "Traçado excluído.",
  );
}

// Leva para o banco os traçados que já estavam desenhados neste navegador (formato antigo).
export async function importarTracadosAction(
  lista: DadosDoTracado[],
): Promise<AcaoState> {
  if (!Array.isArray(lista) || lista.length === 0 || lista.length > 50) {
    return { erro: "Nada para importar." };
  }
  return executar(
    "tracado.importar",
    "tracado",
    null,
    { quantidade: lista.length },
    async () => {
      for (const t of lista) await criarTracado(t);
    },
    CAMINHOS_TRACADO,
    `${lista.length} traçado(s) importado(s).`,
  );
}
