"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { limparDemoCorrida } from "@/lib/demo-corrida";
import { simulacaoEstaAtiva } from "@/lib/mock/data";
import { definirSimulacao } from "@/lib/simulacao";

// Botões "Simular dados" / "Limpar simulação" do painel admin.
export async function definirSimulacaoAction(formData: FormData) {
  const session = await exigirPermissao("simulacao.alternar");
  if (!session) return;

  const ativar = formData.get("ativa") === "1";
  const antes = simulacaoEstaAtiva();
  definirSimulacao(ativar);
  limparDemoCorrida();
  await registrarAuditoria({
    usuarioId: session.id,
    acao: "simulacao.alternar",
    entidade: "simulacao",
    antes: { ativa: antes },
    depois: { ativa: ativar },
    ip: await ipDaRequisicao(),
  });
  revalidatePath("/", "layout");
}
