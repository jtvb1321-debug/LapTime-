"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { controlarDemoCorrida, type AcaoDemo } from "@/lib/demo-corrida";

const ACOES: readonly AcaoDemo[] = [
  "grid",
  "iniciar",
  "pausar",
  "retomar",
  "encerrar",
  "padrao",
  "ligar",
  "desligar",
  "velocidade-1",
  "velocidade-2",
  "velocidade-4",
];

// Botões da central de demonstração (Grid, Iniciar, Pausar, Encerrar...).
export async function controlarDemoAction(acao: string) {
  const session = await exigirPermissao("simulacao.alternar");
  if (!session) return;
  if (!ACOES.includes(acao as AcaoDemo)) return;

  controlarDemoCorrida(acao as AcaoDemo);
  await registrarAuditoria({
    usuarioId: session.id,
    acao: "simulacao.corrida",
    entidade: "simulacao",
    depois: { acao },
    ip: await ipDaRequisicao(),
  });
  revalidatePath("/", "layout");
}
