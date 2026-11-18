"use server";

import { redirect } from "next/navigation";
import { executarAcao, textoDoForm } from "@/lib/cronometragem/executar";
import { obterOuCriarCliente } from "@/lib/operacao/clientes-store";
import { garantirConvite, situacaoDoTermo } from "@/lib/operacao/termo-store";
import type { AcaoState } from "@/lib/operacao-actions";

// Aba Termos: cadastra o piloto (ou reaproveita o cadastro de mesmo nome e telefone), deixa o link
// e o QR do termo prontos e abre a busca já nesse piloto. Mesma permissão de quem monta a bateria
// (sessao.operar).
export async function cadastrarPilotoParaTermoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  let numero = 0;
  const resultado = await executarAcao("sessao.operar", async (ator) => {
    const piloto = await obterOuCriarCliente(
      {
        nome: textoDoForm(dados, "nome"),
        apelido: textoDoForm(dados, "apelido"),
        telefone: textoDoForm(dados, "telefone"),
      },
      ator,
    );
    numero = piloto.numero;
    if ((await situacaoDoTermo(piloto.id)).situacao !== "valido") {
      await garantirConvite(piloto.id, ator);
    }
  });
  if (resultado.erro) return resultado;
  redirect(`/admin/cronometragem/termos?q=${numero}`);
}
