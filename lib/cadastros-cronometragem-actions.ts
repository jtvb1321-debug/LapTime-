"use server";

import {
  confirmarDecoder,
  criarPareamento,
  esquecerDecoder,
  registrarBase,
  revogarComputador,
} from "@/lib/cronometragem/computadores-store";
import {
  adicionarSensorAoKart,
  removerSensorDoKart,
  salvarKart,
  salvarModeloDeVinculo,
  salvarTransponder,
  type ModeloVinculo,
  type StatusKart,
  type StatusTransponder,
} from "@/lib/cronometragem/cadastros-store";
import { executarAcao, textoDoForm } from "@/lib/cronometragem/executar";
import type { AcaoState } from "@/lib/operacao-actions";

export async function salvarTransponderAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await salvarTransponder(
      textoDoForm(dados, "codigo"),
      {
        rotulo: textoDoForm(dados, "rotulo"),
        modelo: textoDoForm(dados, "modelo"),
        status: textoDoForm(dados, "status") as StatusTransponder,
        observacoes: textoDoForm(dados, "observacoes"),
      },
      ator,
    );
    return "Transponder salvo.";
  });
}

export async function salvarKartAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const id = textoDoForm(dados, "kartId");
    await salvarKart(
      id || null,
      {
        numero: textoDoForm(dados, "numero"),
        apelido: textoDoForm(dados, "apelido"),
        status: textoDoForm(dados, "status") as StatusKart,
        transponderFixo: textoDoForm(dados, "transponderFixo"),
        observacoes: textoDoForm(dados, "observacoes"),
      },
      ator,
    );
    return id ? "Kart atualizado." : "Kart cadastrado.";
  });
}

export async function salvarModeloVinculoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await salvarModeloDeVinculo(
      textoDoForm(dados, "modelo") as ModeloVinculo,
      ator,
    );
    return "Modelo de vínculo salvo.";
  });
}

// Adiciona um sensor novo ao kart (ex.: o sensor antigo deu problema).
export async function adicionarSensorAoKartAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const sensor =
      textoDoForm(dados, "sensor") || textoDoForm(dados, "sensorDigitado");
    const substituir = textoDoForm(dados, "substituir") === "1";
    await adicionarSensorAoKart(
      textoDoForm(dados, "kartId"),
      sensor,
      { substituir, motivo: textoDoForm(dados, "motivo") },
      ator,
    );
    return substituir
      ? "Sensor novo no kart; o anterior saiu de uso (em manutenção)."
      : "Sensor adicionado ao kart.";
  });
}

export async function removerSensorDoKartAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await removerSensorDoKart(
      textoDoForm(dados, "kartId"),
      textoDoForm(dados, "sensor"),
      textoDoForm(dados, "motivo"),
      ator,
    );
    return "Sensor tirado de uso (continua no histórico do kart).";
  });
}

// ---- Computador da pista (agente que vigia o que está ligado) ----

// A assinatura (estado anterior e formulário) é a exigida pelas ações dos
// formulários; esta ação não usa nenhum dos dois.
export async function criarPareamentoAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _anterior: AcaoState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const { codigo } = await criarPareamento(ator);
    return `Código: ${codigo} (vale 15 minutos, uso único).`;
  });
}

export async function registrarBaseAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const n = await registrarBase(textoDoForm(dados, "computadorId"), ator);
    return `Registrado: ${n} dispositivo(s) já ligados. Conecte o decoder agora.`;
  });
}

export async function confirmarDecoderAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await confirmarDecoder(
      textoDoForm(dados, "computadorId"),
      textoDoForm(dados, "chave"),
      textoDoForm(dados, "nome"),
      ator,
    );
    return "Decoder confirmado. Ele será reconhecido sozinho nas próximas vezes.";
  });
}

export async function esquecerDecoderAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await esquecerDecoder(textoDoForm(dados, "chave"), ator);
    return "Perfil do decoder removido.";
  });
}

export async function revogarComputadorAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await revogarComputador(textoDoForm(dados, "computadorId"), ator);
    return "Computador desligado do sistema.";
  });
}
