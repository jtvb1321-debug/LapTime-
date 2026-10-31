"use server";

import {
  alternarDecoder,
  criarDecoder,
  renovarToken,
} from "@/lib/cronometragem/decoders-store";
import { executarAcao, textoDoForm } from "@/lib/cronometragem/executar";
import type { AcaoState } from "@/lib/operacao-actions";

export async function criarDecoderAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const { token } = await criarDecoder(
      {
        nome: textoDoForm(dados, "nome"),
        driver: textoDoForm(dados, "driver"),
        endereco: textoDoForm(dados, "endereco"),
      },
      ator,
    );
    return `Decoder criado. Token (aparece só agora, copie): ${token}`;
  });
}

export async function renovarTokenAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const token = await renovarToken(textoDoForm(dados, "decoderId"), ator);
    return `Novo token (o anterior deixou de valer; copie agora): ${token}`;
  });
}

export async function alternarDecoderAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const ativo = textoDoForm(dados, "ativo") === "1";
    await alternarDecoder(textoDoForm(dados, "decoderId"), ativo, ator);
    return ativo ? "Decoder ativado." : "Decoder desativado.";
  });
}
