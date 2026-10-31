"use server";

import { headers } from "next/headers";
import { ipDaRequisicao } from "@/lib/auth";
import { excedeuLimite } from "@/lib/limite-tentativas";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { AcaoState } from "@/lib/operacao-actions";
import { assinarPorConvite } from "@/lib/operacao/termo-store";

// Ação pública (sem login): quem tem o link assina o termo. Para não servir de
// alvo de tentativas em massa, limita as tentativas por IP e por link.
const JANELA_MS = 10 * 60_000;
const MAXIMO_POR_IP = 20;
const MAXIMO_POR_LINK = 8;
export async function assinarTermoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const token = String(dados.get("token") ?? "");
  const ip = await ipDaRequisicao();
  if (
    excedeuLimite(`ip:${ip ?? "?"}`, MAXIMO_POR_IP, JANELA_MS) ||
    excedeuLimite(`token:${token}`, MAXIMO_POR_LINK, JANELA_MS)
  ) {
    return {
      erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    };
  }
  try {
    if (dados.get("leu") !== "1") {
      throw new ErroNegocio("Marque que leu e concorda com o termo.");
    }
    const versao = Number(dados.get("termoVersao"));
    if (!Number.isInteger(versao)) throw new ErroNegocio("Link inválido.");
    await assinarPorConvite(
      token,
      {
        assinante: String(dados.get("assinante") ?? ""),
        documento: String(dados.get("documento") ?? ""),
        porMenor: dados.get("porMenor") === "1",
        assinaturaPng: String(dados.get("assinatura") ?? ""),
        termoVersao: versao,
      },
      { ip, userAgent: (await headers()).get("user-agent") },
    );
    return { ok: "Termo assinado. Obrigado!" };
  } catch (erro) {
    if (erro instanceof ErroNegocio) return { erro: erro.message };
    console.error("[termo] falha ao registrar a assinatura:", erro);
    return { erro: "Não foi possível registrar agora. Tente de novo." };
  }
}
