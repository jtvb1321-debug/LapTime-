"use server";

import { revalidatePath } from "next/cache";
import { getSession, ipDaRequisicao } from "@/lib/auth";
import { fotoCorpoValida, salvarApresentacao } from "@/lib/apresentacao-store";
import { excedeuLimite } from "@/lib/limite-tentativas";
import { encontrarPilotoPorId } from "@/lib/pilotos-store";

export type ApresentacaoState = { erro?: string; ok?: boolean; slug?: string };

// O próprio piloto (logado) envia ou troca a foto de macacão e a cor da faixa do vídeo.
export async function atualizarApresentacaoAction(
  _anterior: ApresentacaoState,
  dados: FormData,
): Promise<ApresentacaoState> {
  const sessao = await getSession();
  if (!sessao?.pilotoId) {
    return { erro: "Entre com a conta de um piloto para enviar a foto." };
  }
  if (
    excedeuLimite(
      `apresentacao:${(await ipDaRequisicao()) ?? "?"}`,
      15,
      60 * 60_000,
    )
  ) {
    return { erro: "Muitas tentativas. Aguarde um pouco e tente de novo." };
  }
  const fotoCorpo = String(dados.get("fotoCorpo") ?? "").trim();
  if (!fotoCorpo) return { erro: "Envie a foto de macacão primeiro." };
  if (!fotoCorpoValida(fotoCorpo)) {
    return { erro: "Foto inválida. Envie a foto de novo." };
  }
  const piloto = await encontrarPilotoPorId(sessao.pilotoId);
  if (!piloto) return { erro: "Piloto não encontrado." };
  let salvo = false;
  try {
    salvo = await salvarApresentacao(
      piloto.id,
      fotoCorpo,
      piloto.corAssinatura ?? "#f2f5f7",
    );
  } catch (e) {
    console.error("apresentacao: não foi possível salvar", e);
  }
  if (!salvo) {
    return { erro: "Não foi possível salvar agora. Tente de novo mais tarde." };
  }
  revalidatePath(`/pilotos/${piloto.slug}`);
  return { ok: true, slug: piloto.slug };
}
