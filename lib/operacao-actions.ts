"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { consultar } from "@/lib/db/conexao";
import {
  agendarBateria,
  cancelarBateria,
  cancelarReserva,
  criarReserva,
  gerarGrade,
} from "@/lib/operacao/agenda-store";
import {
  abrirCaixa,
  estornarPagamento,
  fecharCaixa,
  FORMAS,
  registrarPagamento,
  registrarSuprimentoOuSangria,
  type FormaPagamento,
} from "@/lib/operacao/caixa-store";
import {
  atualizarCliente,
  criarCliente,
  lerClientePorNumero,
  obterOuCriarCliente,
} from "@/lib/operacao/clientes-store";
import {
  cadastrarPilotoDaReserva,
  removerPilotoDaReserva,
} from "@/lib/operacao/reserva-pilotos-store";
import {
  cancelarConta,
  criarConta,
  FORMAS_CONTA,
  pagarConta,
  type FormaContaPaga,
} from "@/lib/operacao/financeiro-store";
import { publicarTermo, registrarAceite } from "@/lib/operacao/termo-store";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";
import { ehDiaValido, reaisParaCentavos } from "@/lib/operacao/tempo";
import type { Permissao } from "@/lib/permissoes";

export type AcaoState = { erro?: string; ok?: string };

function texto(dados: FormData, campo: string): string {
  return String(dados.get(campo) ?? "").trim();
}

function inteiro(dados: FormData, campo: string): number {
  return Number(texto(dados, campo));
}

function reais(dados: FormData, campo: string, rotulo: string): number {
  const centavos = reaisParaCentavos(texto(dados, campo));
  if (centavos === null) throw new ErroNegocio(`${rotulo}: valor inválido.`);
  return centavos;
}

// Toda ação passa por aqui: confere a permissão (no servidor, nunca só na
// tela), transforma erro de regra em mensagem pro operador e esconde falha
// técnica (que vai pro log do servidor).
async function executar(
  permissao: Permissao,
  fn: (ator: Ator) => Promise<string | void>,
): Promise<AcaoState> {
  const sessao = await exigirPermissao(permissao);
  if (!sessao) return { erro: "Você não tem permissão para esta ação." };
  try {
    const ok = await fn({ usuarioId: sessao.id, ip: await ipDaRequisicao() });
    revalidatePath("/admin/operacao", "layout");
    revalidatePath("/admin/cronometragem", "layout");
    revalidatePath("/horarios");
    return { ok: ok || "Feito." };
  } catch (erro) {
    if (erro instanceof ErroNegocio) return { erro: erro.message };
    console.error("[operacao] falha inesperada:", erro);
    return { erro: "Não foi possível concluir. Tente de novo." };
  }
}

export async function gerarGradeAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("agenda.gerenciar", async (ator) => {
    const criadas = await gerarGrade(
      {
        dia: texto(dados, "dia"),
        primeiraHora: texto(dados, "primeiraHora"),
        ultimaHora: texto(dados, "ultimaHora"),
        intervaloMin: inteiro(dados, "intervaloMin"),
        duracaoMin: inteiro(dados, "duracaoMin"),
        capacidade: inteiro(dados, "capacidade"),
        precoCentavos: reais(dados, "preco", "Preço por piloto"),
      },
      ator,
    );
    return criadas === 0
      ? "Essas baterias já existiam."
      : `${criadas} bateria(s) criada(s).`;
  });
}

export async function reservarAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const dia = texto(dados, "dia");
  const resultado = await executar("agenda.gerenciar", async (ator) => {
    let clienteId = texto(dados, "clienteId");
    if (!clienteId) {
      // Reaproveita o cadastro se já existir o mesmo nome e telefone.
      const novo = await obterOuCriarCliente(
        { nome: texto(dados, "nome"), telefone: texto(dados, "telefone") },
        ator,
      );
      clienteId = novo.id;
    }
    const desconto = texto(dados, "desconto");
    await criarReserva(
      {
        slotId: texto(dados, "slotId"),
        clienteId,
        pilotos: inteiro(dados, "pilotos"),
        descontoCentavos: desconto ? reais(dados, "desconto", "Desconto") : 0,
      },
      ator,
    );
  });
  if (resultado.erro) return resultado;
  redirect(`/admin/operacao/agenda?dia=${ehDiaValido(dia) ? dia : ""}`);
}

// Agendar uma bateria num passo só (horário criado na hora, se não existir).
export async function agendarBateriaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  const dia = texto(dados, "dia");
  const resultado = await executar("agenda.gerenciar", async (ator) => {
    const responsavel = await obterOuCriarCliente(
      {
        nome: texto(dados, "nome"),
        telefone: texto(dados, "telefone"),
      },
      ator,
    );
    const preco = texto(dados, "preco");
    await agendarBateria(
      {
        dia,
        hora: texto(dados, "hora"),
        clienteId: responsavel.id,
        pilotos: inteiro(dados, "pilotos"),
        precoCentavos: preco
          ? reais(dados, "preco", "Preço por piloto")
          : undefined,
      },
      ator,
    );
  });
  if (resultado.erro) return resultado;
  redirect(`/admin/operacao/agenda?dia=${ehDiaValido(dia) ? dia : ""}`);
}

export async function cancelarReservaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("agenda.gerenciar", async (ator) => {
    await cancelarReserva(
      texto(dados, "reservaId"),
      texto(dados, "motivo"),
      ator,
    );
    return "Reserva cancelada.";
  });
}

export async function cancelarBateriaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("agenda.gerenciar", async (ator) => {
    await cancelarBateria(texto(dados, "slotId"), ator);
    return "Bateria cancelada.";
  });
}

export async function criarClienteAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("cliente.gerenciar", async (ator) => {
    const nome = texto(dados, "nome");
    const telefone = texto(dados, "telefone");
    // Mesmo nome e telefone de um cadastro existente: avisa em vez de criar um
    // segundo cadastro (o número de cadastro é o mesmo para o cliente todo).
    const digitos = telefone.replace(/\D/g, "");
    const [igual] = digitos
      ? await consultar<{ numero: number }>(
          `select numero from cliente
            where telefone_digitos = $1 and lower(nome) = lower($2) limit 1`,
          [digitos, nome.trim()],
        )
      : [];
    if (igual) {
      throw new ErroNegocio(
        `Esse cliente já está cadastrado (cadastro nº ${igual.numero}). Busque pelo nome na lista.`,
      );
    }
    await criarCliente(
      {
        nome,
        telefone,
        email: texto(dados, "email"),
        documento: texto(dados, "documento"),
        nascimento: texto(dados, "nascimento"),
      },
      ator,
    );
    return "Cliente cadastrado.";
  });
}

export async function abrirCaixaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("caixa.operar", async (ator) => {
    const fundo = texto(dados, "fundo")
      ? reais(dados, "fundo", "Fundo de troco")
      : 0;
    await abrirCaixa(fundo, ator);
    return "Caixa aberto.";
  });
}

export async function pagamentoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("caixa.operar", async (ator) => {
    const forma = texto(dados, "forma") as FormaPagamento;
    if (!FORMAS.includes(forma)) {
      throw new ErroNegocio("Escolha a forma de pagamento.");
    }
    await registrarPagamento(
      {
        reservaId: texto(dados, "reservaId"),
        forma,
        valorCentavos: reais(dados, "valor", "Valor"),
        reservaPilotoId: texto(dados, "reservaPilotoId") || undefined,
      },
      ator,
    );
    return "Pagamento registrado.";
  });
}

// Pilotos da reserva: cada um com cadastro, para a bateria e o termo.
export async function cadastrarPilotoDaReservaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("agenda.gerenciar", async (ator) => {
    let clienteId = texto(dados, "clienteId");
    const numero = texto(dados, "numeroCadastro");
    if (!clienteId && numero) {
      const achado = /^\d{1,9}$/.test(numero)
        ? await lerClientePorNumero(Number(numero))
        : null;
      if (!achado) throw new ErroNegocio("Não há cadastro com esse número.");
      clienteId = achado.id;
    }
    const r = await cadastrarPilotoDaReserva(
      texto(dados, "reservaId"),
      {
        clienteId: clienteId || undefined,
        nome: texto(dados, "nome"),
        telefone: texto(dados, "telefone"),
        nascimento: texto(dados, "nascimento"),
      },
      ator,
    );
    return `${r.nome} cadastrado (nº ${r.numero}).`;
  });
}

export async function removerPilotoDaReservaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("agenda.gerenciar", async (ator) => {
    await removerPilotoDaReserva(texto(dados, "reservaPilotoId"), ator);
    return "Piloto tirado da reserva.";
  });
}

export async function suprimentoOuSangriaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("caixa.operar", async (ator) => {
    const tipo = texto(dados, "tipo");
    if (tipo !== "suprimento" && tipo !== "sangria") {
      throw new ErroNegocio("Escolha suprimento ou sangria.");
    }
    await registrarSuprimentoOuSangria(
      {
        tipo,
        valorCentavos: reais(dados, "valor", "Valor"),
        descricao: texto(dados, "descricao"),
      },
      ator,
    );
    return tipo === "sangria"
      ? "Sangria registrada."
      : "Suprimento registrado.";
  });
}

export async function estornarAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("caixa.estornar", async (ator) => {
    await estornarPagamento(
      {
        movimentoId: inteiro(dados, "movimentoId"),
        motivo: texto(dados, "motivo"),
      },
      ator,
    );
    return "Pagamento estornado.";
  });
}

export async function fecharCaixaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("caixa.operar", async (ator) => {
    await fecharCaixa(
      {
        caixaId: texto(dados, "caixaId"),
        contadoCentavos: reais(dados, "contado", "Dinheiro contado"),
        observacao: texto(dados, "observacao"),
      },
      ator,
    );
    return "Caixa fechado.";
  });
}

export async function atualizarClienteAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("cliente.gerenciar", async (ator) => {
    await atualizarCliente(
      texto(dados, "clienteId"),
      {
        telefone: texto(dados, "telefone"),
        email: texto(dados, "email"),
        documento: texto(dados, "documento"),
        nascimento: texto(dados, "nascimento"),
      },
      ator,
    );
    return "Dados atualizados.";
  });
}

export async function registrarAceiteAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("cliente.gerenciar", async (ator) => {
    if (dados.get("leu") !== "on") {
      throw new ErroNegocio(
        "Confirme que o cliente leu e concordou com o termo.",
      );
    }
    await registrarAceite(
      {
        clienteId: texto(dados, "clienteId"),
        assinante: texto(dados, "assinante"),
        porMenor: dados.get("porMenor") === "on",
      },
      ator,
    );
    return "Termo registrado.";
  });
}

export async function publicarTermoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("termo.editar", async (ator) => {
    const termo = await publicarTermo(texto(dados, "texto"), ator);
    return `Versão ${termo.versao} publicada. Todos os clientes vão precisar assinar de novo.`;
  });
}

export async function criarContaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("financeiro.gerenciar", async (ator) => {
    const criadas = await criarConta(
      {
        descricao: texto(dados, "descricao"),
        categoria: texto(dados, "categoria"),
        fornecedor: texto(dados, "fornecedor"),
        valorCentavos: reais(dados, "valor", "Valor"),
        vencimento: texto(dados, "vencimento"),
        repetirMeses: texto(dados, "repetirMeses")
          ? inteiro(dados, "repetirMeses")
          : 1,
        observacao: texto(dados, "observacao"),
      },
      ator,
    );
    return criadas === 1 ? "Conta lançada." : `${criadas} contas lançadas.`;
  });
}

export async function pagarContaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("financeiro.gerenciar", async (ator) => {
    const forma = texto(dados, "forma") as FormaContaPaga;
    if (!FORMAS_CONTA.includes(forma)) {
      throw new ErroNegocio("Escolha como a conta foi paga.");
    }
    await pagarConta(texto(dados, "contaId"), forma, ator);
    return "Conta marcada como paga.";
  });
}

export async function cancelarContaAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executar("financeiro.gerenciar", async (ator) => {
    await cancelarConta(texto(dados, "contaId"), texto(dados, "motivo"), ator);
    return "Conta cancelada.";
  });
}
