"use server";

import { redirect } from "next/navigation";
import {
  abrirBateriaDoSlot,
  adicionarPiloto,
  adicionarPilotosEmLote,
  anularCorrecao,
  armarCaptura,
  cadastrarPilotoNaBateria,
  cancelarCorrida,
  corridaDaClassificacao,
  criarCorrida,
  definirDuracoes,
  definirKart,
  definirResponsavel,
  desvincularSensor,
  encerrarAgora,
  excluirCorrida,
  finalizarCorrida,
  iniciarCorrida,
  inserirPassagemManual,
  invalidarPassagem,
  lerCorrida,
  lerPainel,
  marcarPronta,
  nomearParticipante,
  novaBateriaRapida,
  reabrirPreparacao,
  prepararCorrida,
  pularClassificacao,
  registrarOcorrencia,
  registrarPresenca,
  removerPiloto,
  rotularSensor,
  sortearKarts,
  vincularSensor,
} from "@/lib/cronometragem/corridas-store";
import { executarAcao, textoDoForm } from "@/lib/cronometragem/executar";
import { horaDoDiaParaMs } from "@/lib/cronometragem/horario";
import { ErroNegocio } from "@/lib/operacao/erros";
import { garantirConvite } from "@/lib/operacao/termo-store";
import { diaLocal } from "@/lib/operacao/tempo";
import type { AcaoState } from "@/lib/operacao-actions";

function numeroOpcional(dados: FormData, campo: string, rotulo: string) {
  const bruto = textoDoForm(dados, campo);
  if (!bruto) return undefined;
  if (!/^\d+$/.test(bruto)) {
    throw new ErroNegocio(`${rotulo}: informe só números.`);
  }
  return Number(bruto);
}

export async function criarCorridaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  let id = "";
  const resultado = await executarAcao("sessao.operar", async (ator) => {
    const segundos = numeroOpcional(dados, "tempoMinimo", "Tempo mínimo");
    const espera = numeroOpcional(dados, "esperaFinal", "Espera final");
    id = await criarCorrida(
      {
        nome: textoDoForm(dados, "nome"),
        slotId: textoDoForm(dados, "slotId") || undefined,
        fase:
          textoDoForm(dados, "fase") === "unica" ? "unica" : "classificacao",
        tempoMinimoMs: segundos === undefined ? undefined : segundos * 1000,
        duracaoMin: numeroOpcional(dados, "duracao", "Duração"),
        regraLargada:
          (textoDoForm(dados, "regraLargada") as
            "primeira_passagem" | "largada_da_corrida") || undefined,
        modoEncerramento:
          (textoDoForm(dados, "modoEncerramento") as
            "manual" | "proxima_passagem" | "corte_imediato") || undefined,
        esperaFinalS: espera,
      },
      ator,
    );
  });
  if (resultado.erro) return resultado;
  redirect(`/admin/cronometragem/corridas/${id}`);
}

// Abre a bateria de um horário da agenda e já leva para ela.
export async function abrirBateriaDaAgendaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  let id = "";
  const resultado = await executarAcao("sessao.operar", async (ator) => {
    id = await abrirBateriaDoSlot(textoDoForm(dados, "slotId"), ator);
  });
  if (resultado.erro) return resultado;
  redirect(`/admin/cronometragem/corridas/${id}`);
}

export async function adicionarPilotoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await adicionarPiloto(
      textoDoForm(dados, "corridaId"),
      textoDoForm(dados, "nome"),
      ator,
    );
    return "Piloto adicionado ao grid.";
  });
}

// Vários pilotos de uma vez (um nome por linha).
export async function adicionarPilotosAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    const n = await adicionarPilotosEmLote(
      textoDoForm(dados, "corridaId"),
      String(dados.get("nomes") ?? ""),
      ator,
    );
    return n === 1 ? "1 piloto adicionado." : `${n} pilotos adicionados.`;
  });
}

// Piloto da bateria: um cliente já cadastrado (escolhido na busca) ou um
// cadastro novo feito na hora. Com `vagaId`, ocupa uma vaga aberta da reserva.
export async function cadastrarPilotoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    const r = await cadastrarPilotoNaBateria(
      textoDoForm(dados, "corridaId"),
      {
        clienteId: textoDoForm(dados, "clienteId") || undefined,
        nome: textoDoForm(dados, "nome"),
        telefone: textoDoForm(dados, "telefone"),
        nascimento: textoDoForm(dados, "nascimento"),
        documento: textoDoForm(dados, "documento"),
        vagaId: textoDoForm(dados, "vagaId") || undefined,
      },
      ator,
    );
    const painel = await lerPainel(textoDoForm(dados, "corridaId"));
    // O 1º piloto cadastrado vira o responsável, se ainda não houver um.
    if (
      textoDoForm(dados, "responsavel") === "1" ||
      (painel && !painel.responsavel)
    ) {
      await definirResponsavel(
        textoDoForm(dados, "corridaId"),
        r.clienteId,
        true,
        ator,
      );
    }
    return `${r.nome} entrou na bateria (cadastro nº ${r.numero}). Envie o termo para ele assinar.`;
  });
}

export async function definirResponsavelAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await definirResponsavel(
      textoDoForm(dados, "corridaId"),
      textoDoForm(dados, "clienteId"),
      textoDoForm(dados, "tambemPilota") !== "0",
      ator,
    );
    return "Responsável da bateria definido.";
  });
}

// Gera (ou reaproveita) o link para o piloto assinar o termo.
export async function gerarLinkDoTermoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await garantirConvite(
      textoDoForm(dados, "clienteId"),
      ator,
      textoDoForm(dados, "corridaId") || undefined,
    );
    return "Link gerado.";
  });
}

// Gera os links de todos os pilotos da bateria que ainda não assinaram.
export async function gerarLinksDaBateriaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    const corridaId = textoDoForm(dados, "corridaId");
    const painel = await lerPainel(corridaId);
    if (!painel) throw new ErroNegocio("Bateria não encontrada.");
    let gerados = 0;
    for (const p of painel.grid) {
      if (p.clienteId && p.termo === "pendente") {
        await garantirConvite(p.clienteId, ator, corridaId);
        gerados += 1;
      }
    }
    return gerados
      ? `${gerados} link(s) pronto(s).`
      : "Todos os pilotos já assinaram.";
  });
}

// Sorteia os karts disponíveis entre os pilotos da bateria.
export async function sortearKartsAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    const sorteio = await sortearKarts(
      textoDoForm(dados, "corridaId"),
      { refazer: textoDoForm(dados, "refazer") === "1" },
      ator,
    );
    return `Sorteio feito: ${sorteio.map((s) => `${s.piloto} → kart ${s.kart}`).join("; ")}.`;
  });
}

// Ao final da classificação, cria a corrida (grid pela melhor volta).
export async function prepararCorridaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  let corridaId = "";
  const resultado = await executarAcao("sessao.operar", async (ator) => {
    corridaId = await prepararCorrida(
      textoDoForm(dados, "classificacaoId"),
      { duracaoMin: numeroOpcional(dados, "duracao", "Duração") },
      ator,
    );
  });
  if (resultado.erro) return resultado;
  redirect(`/admin/cronometragem/corridas/${corridaId}`);
}

// Check-in do piloto na recepção.
export async function registrarPresencaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    const presente = textoDoForm(dados, "presente") !== "0";
    await registrarPresenca(textoDoForm(dados, "pilotoId"), presente, ator);
    return presente ? "Presença confirmada." : "Presença desfeita.";
  });
}

// DNS/DNF/DSQ e penalidade em tempo (só quem pode corrigir resultados).
export async function registrarOcorrenciaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("resultado.corrigir", async (ator) => {
    const situacao = textoDoForm(dados, "situacao");
    await registrarOcorrencia(
      textoDoForm(dados, "pilotoId"),
      {
        situacao: situacao === "" ? null : (situacao as "dns" | "dnf" | "dsq"),
        penalidadeS: numeroOpcional(dados, "penalidade", "Penalidade") ?? 0,
        motivo: textoDoForm(dados, "motivo"),
      },
      ator,
    );
    return "Ocorrência registrada.";
  });
}

export async function removerPilotoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await removerPiloto(textoDoForm(dados, "pilotoId"), ator);
    return "Piloto removido.";
  });
}

export async function vincularSensorAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await vincularSensor(
      textoDoForm(dados, "pilotoId"),
      textoDoForm(dados, "sensor"),
      ator,
    );
    return "Sensor vinculado.";
  });
}

export async function desvincularSensorAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await desvincularSensor(textoDoForm(dados, "pilotoId"), ator);
    return "Sensor solto.";
  });
}

export async function definirKartAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    const kartId = textoDoForm(dados, "kartId");
    await definirKart(textoDoForm(dados, "pilotoId"), kartId || null, ator);
    return kartId ? "Kart definido." : "Kart removido.";
  });
}

export async function armarCapturaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    const armar = textoDoForm(dados, "armar") === "1";
    await armarCaptura(textoDoForm(dados, "pilotoId"), armar, ator);
    return armar
      ? "Aguardando: passe o kart pelo sensor."
      : "Captura cancelada.";
  });
}

export async function rotularSensorAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await rotularSensor(
      textoDoForm(dados, "sensor"),
      textoDoForm(dados, "rotulo"),
      ator,
    );
    return "Nome do sensor salvo.";
  });
}

export async function marcarProntaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await marcarPronta(textoDoForm(dados, "corridaId"), ator);
    return "Grid confirmado: corrida pronta para iniciar.";
  });
}

export async function reabrirPreparacaoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await reabrirPreparacao(textoDoForm(dados, "corridaId"), ator);
    return "Corrida de volta à preparação.";
  });
}

export async function iniciarCorridaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("prova.iniciar_encerrar", async (ator) => {
    await iniciarCorrida(textoDoForm(dados, "corridaId"), ator);
    return "Corrida iniciada.";
  });
}

export async function encerrarAgoraAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("prova.iniciar_encerrar", async (ator) => {
    await encerrarAgora(textoDoForm(dados, "corridaId"), ator);
    return "Bandeira dada: corrida encerrando.";
  });
}

export async function finalizarCorridaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const corridaId = textoDoForm(dados, "corridaId");
  const resultado = await executarAcao(
    "prova.iniciar_encerrar",
    async (ator) => {
      await finalizarCorrida(corridaId, ator);
      return "Bateria finalizada e resultado publicado.";
    },
  );
  if (resultado.erro) return resultado;
  // Terminou a classificação: a corrida já foi gerada, então leva para ela.
  const corrida = await lerCorrida(corridaId);
  if (corrida?.fase === "classificacao") {
    const proxima = await corridaDaClassificacao(corridaId);
    if (proxima) redirect(`/admin/cronometragem/corridas/${proxima}`);
  }
  return resultado;
}

// Pula a classificação e vai direto para a corrida.
export async function pularClassificacaoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  let proxima: string | null = null;
  const resultado = await executarAcao("sessao.operar", async (ator) => {
    proxima = await pularClassificacao(textoDoForm(dados, "corridaId"), ator);
  });
  if (resultado.erro) return resultado;
  if (proxima) redirect(`/admin/cronometragem/corridas/${proxima}`);
  return { ok: "Classificação pulada." };
}

// Edita o tempo da fase e (na classificação) o tempo planejado da corrida.
export async function definirDuracoesAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await definirDuracoes(
      textoDoForm(dados, "corridaId"),
      {
        duracaoMin: numeroOpcional(dados, "duracao", "Duração"),
        duracaoCorridaMin: numeroOpcional(
          dados,
          "duracaoCorrida",
          "Duração da corrida",
        ),
      },
      ator,
    );
    return "Tempos salvos.";
  });
}

export async function cancelarCorridaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("prova.iniciar_encerrar", async (ator) => {
    await cancelarCorrida(
      textoDoForm(dados, "corridaId"),
      textoDoForm(dados, "motivo"),
      ator,
    );
    return "Corrida cancelada.";
  });
}

export async function excluirCorridaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const resultado = await executarAcao("sessao.operar", async (ator) => {
    await excluirCorrida(textoDoForm(dados, "corridaId"), ator);
  });
  if (resultado.erro) return resultado;
  redirect("/admin/cronometragem/corridas");
}

// Correções administrativas (nunca alteram a passagem original).
export async function invalidarPassagemAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("resultado.corrigir", async (ator) => {
    await invalidarPassagem(
      textoDoForm(dados, "corridaId"),
      textoDoForm(dados, "passagemId"),
      textoDoForm(dados, "motivo"),
      ator,
    );
    return "Passagem invalidada (o registro original foi mantido).";
  });
}

export async function inserirPassagemAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("resultado.corrigir", async (ator) => {
    const corridaId = textoDoForm(dados, "corridaId");
    const corrida = await lerCorrida(corridaId);
    if (!corrida?.iniciadaEm) {
      throw new ErroNegocio("A corrida ainda não começou.");
    }
    const instante = horaDoDiaParaMs(
      diaLocal(corrida.iniciadaEm),
      textoDoForm(dados, "hora"),
    );
    if (instante === null) {
      throw new ErroNegocio("Horário inválido (use HH:MM:SS ou HH:MM:SS.mmm).");
    }
    await inserirPassagemManual(
      corridaId,
      textoDoForm(dados, "pilotoId"),
      instante,
      textoDoForm(dados, "motivo"),
      ator,
    );
    return "Passagem manual registrada.";
  });
}

export async function anularCorrecaoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("resultado.corrigir", async (ator) => {
    await anularCorrecao(
      textoDoForm(dados, "correcaoId"),
      textoDoForm(dados, "motivo"),
      ator,
    );
    return "Correção anulada.";
  });
}

// Dá o nome ao piloto de um kart (digitado ou escolhido na lista da bateria).
export async function nomearParticipanteAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("sessao.operar", async (ator) => {
    await nomearParticipante(
      textoDoForm(dados, "participanteId"),
      {
        nome: textoDoForm(dados, "nome"),
        pendenteId: textoDoForm(dados, "pendenteId") || undefined,
      },
      ator,
    );
    return "Nome do piloto salvo.";
  });
}

// "Nova bateria" com um clique: repete as regras da última e abre a tela.
export async function novaBateriaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  let id = "";
  const resultado = await executarAcao("sessao.operar", async (ator) => {
    // Padrão: bateria com classificação e corrida. "0" = corrida única.
    id = await novaBateriaRapida(ator, {
      duasFases: textoDoForm(dados, "duasFases") !== "0",
    });
  });
  if (resultado.erro) return resultado;
  redirect(`/admin/cronometragem/corridas/${id}`);
}
