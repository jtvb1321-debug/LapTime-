import { randomUUID } from "node:crypto";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";
import {
  ehDiaValido,
  hojeEmSaoPaulo,
  limitesDoMes,
  somarMeses,
  somarMesesAoDia,
} from "@/lib/operacao/tempo";

export const CATEGORIAS_CONTA = [
  "Aluguel",
  "Energia",
  "Água",
  "Internet e telefone",
  "Salários e encargos",
  "Manutenção de karts",
  "Combustível e pneus",
  "Impostos e taxas",
  "Marketing",
  "Outros",
] as const;

export type FormaContaPaga =
  "dinheiro" | "pix" | "cartao" | "boleto" | "transferencia";
export const FORMAS_CONTA: readonly FormaContaPaga[] = [
  "dinheiro",
  "pix",
  "cartao",
  "boleto",
  "transferencia",
];

export type SituacaoConta = "aberta" | "vencida" | "paga" | "cancelada";

export interface ContaPagar {
  id: string;
  descricao: string;
  categoria: string;
  fornecedor?: string;
  valorCentavos: number;
  // AAAA-MM-DD
  vencimento: string;
  observacao?: string;
  pagoEm: Date | null;
  pagoForma: FormaContaPaga | null;
  situacao: SituacaoConta;
}

interface LinhaConta {
  id: string;
  descricao: string;
  categoria: string;
  fornecedor: string | null;
  valor_centavos: number;
  vencimento: string;
  observacao: string | null;
  pago_em: Date | null;
  pago_forma: FormaContaPaga | null;
  cancelada_em: Date | null;
}

const COLUNAS_CONTA = `id, descricao, categoria, fornecedor, valor_centavos,
  to_char(vencimento, 'YYYY-MM-DD') as vencimento, observacao, pago_em,
  pago_forma, cancelada_em`;

function contaDeLinha(l: LinhaConta, hoje: string): ContaPagar {
  const situacao: SituacaoConta = l.cancelada_em
    ? "cancelada"
    : l.pago_em
      ? "paga"
      : l.vencimento < hoje
        ? "vencida"
        : "aberta";
  return {
    id: l.id,
    descricao: l.descricao,
    categoria: l.categoria,
    fornecedor: l.fornecedor ?? undefined,
    valorCentavos: l.valor_centavos,
    vencimento: l.vencimento,
    observacao: l.observacao ?? undefined,
    pagoEm: l.pago_em,
    pagoForma: l.pago_forma,
    situacao,
  };
}

// Cria a conta; com `repetirMeses` > 1 cria uma por mês (mesmo dia).
export async function criarConta(
  dados: {
    descricao: string;
    categoria: string;
    fornecedor?: string;
    valorCentavos: number;
    vencimento: string;
    repetirMeses?: number;
    observacao?: string;
  },
  ator: Ator,
): Promise<number> {
  const descricao = dados.descricao.trim();
  if (descricao.length < 3) throw new ErroNegocio("Descreva a conta.");
  if (!(CATEGORIAS_CONTA as readonly string[]).includes(dados.categoria)) {
    throw new ErroNegocio("Escolha a categoria.");
  }
  if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0) {
    throw new ErroNegocio("Informe um valor maior que zero.");
  }
  if (!ehDiaValido(dados.vencimento)) {
    throw new ErroNegocio("Informe a data de vencimento.");
  }
  const repeticoes = dados.repetirMeses ?? 1;
  if (!Number.isInteger(repeticoes) || repeticoes < 1 || repeticoes > 24) {
    throw new ErroNegocio("Repetir de 1 a 24 meses.");
  }

  return transacao(async (cliente) => {
    for (let i = 0; i < repeticoes; i++) {
      const id = `conta-${randomUUID()}`;
      const nome =
        repeticoes > 1 ? `${descricao} (${i + 1}/${repeticoes})` : descricao;
      const vencimento = somarMesesAoDia(dados.vencimento, i);
      await cliente.query(
        `insert into conta_pagar (id, descricao, categoria, fornecedor, valor_centavos, vencimento, observacao, criada_por)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          nome,
          dados.categoria,
          dados.fornecedor?.trim() || null,
          dados.valorCentavos,
          vencimento,
          dados.observacao?.trim() || null,
          ator.usuarioId,
        ],
      );
      await registrarAuditoria(
        {
          usuarioId: ator.usuarioId,
          ip: ator.ip,
          acao: "conta.criar",
          entidade: "conta_pagar",
          entidadeId: id,
          depois: {
            descricao: nome,
            valorCentavos: dados.valorCentavos,
            vencimento,
          },
        },
        cliente,
      );
    }
    return repeticoes;
  });
}

export async function pagarConta(
  id: string,
  forma: FormaContaPaga,
  ator: Ator,
): Promise<void> {
  if (!FORMAS_CONTA.includes(forma)) {
    throw new ErroNegocio("Escolha a forma de pagamento.");
  }
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<LinhaConta>(
      `select ${COLUNAS_CONTA} from conta_pagar where id = $1 for update`,
      [id],
    );
    if (!rows[0]) throw new ErroNegocio("Conta não encontrada.");
    if (rows[0].cancelada_em)
      throw new ErroNegocio("Esta conta foi cancelada.");
    if (rows[0].pago_em) throw new ErroNegocio("Esta conta já foi paga.");
    await cliente.query(
      "update conta_pagar set pago_em = now(), pago_forma = $2, pago_por = $3 where id = $1",
      [id, forma, ator.usuarioId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "conta.pagar",
        entidade: "conta_pagar",
        entidadeId: id,
        depois: { forma, valorCentavos: rows[0].valor_centavos },
      },
      cliente,
    );
  });
}

export async function cancelarConta(
  id: string,
  motivo: string,
  ator: Ator,
): Promise<void> {
  const texto = motivo.trim();
  if (texto.length < 3) throw new ErroNegocio("Informe o motivo.");
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<LinhaConta>(
      `select ${COLUNAS_CONTA} from conta_pagar where id = $1 for update`,
      [id],
    );
    if (!rows[0]) throw new ErroNegocio("Conta não encontrada.");
    if (rows[0].cancelada_em) throw new ErroNegocio("Conta já cancelada.");
    if (rows[0].pago_em) {
      throw new ErroNegocio("Conta já paga não pode ser cancelada.");
    }
    await cliente.query(
      `update conta_pagar set cancelada_em = now(), cancelada_por = $2,
              motivo_cancelamento = $3 where id = $1`,
      [id, ator.usuarioId, texto],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "conta.cancelar",
        entidade: "conta_pagar",
        entidadeId: id,
        motivo: texto,
      },
      cliente,
    );
  });
}

// Contas com vencimento no mês + as vencidas em aberto de meses anteriores.
export async function listarContas(mes: string): Promise<ContaPagar[]> {
  const hoje = hojeEmSaoPaulo();
  const inicio = `${mes}-01`;
  const fim = `${somarMeses(mes, 1)}-01`;
  const linhas = await consultar<LinhaConta>(
    `select ${COLUNAS_CONTA} from conta_pagar
      where (vencimento >= $1::date and vencimento < $2::date)
         or (vencimento < $1::date and pago_em is null and cancelada_em is null)
      order by vencimento, descricao`,
    [inicio, fim],
  );
  return linhas.map((l) => contaDeLinha(l, hoje));
}

export interface FluxoDoMes {
  mes: string;
  entradas: {
    totalCentavos: number;
    dinheiro: number;
    pix: number;
    cartao: number;
    // dia (AAAA-MM-DD) → líquido recebido
    porDia: { dia: string; centavos: number }[];
  };
  saidasPagas: {
    totalCentavos: number;
    porCategoria: { categoria: string; centavos: number }[];
  };
  resultadoCentavos: number;
  aPagarNoMes: { quantidade: number; centavos: number };
  atrasadas: { quantidade: number; centavos: number };
}

export async function fluxoDoMes(mes: string): Promise<FluxoDoMes> {
  const { inicio, fim } = limitesDoMes(mes);
  const primeiro = `${mes}-01`;
  const proximo = `${somarMeses(mes, 1)}-01`;
  const hoje = hojeEmSaoPaulo();

  const entradas = await consultar<{
    dia: string;
    forma: string;
    total: number;
  }>(
    `select to_char(criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as dia,
            forma,
            sum(case when tipo = 'pagamento' then valor_centavos
                     else -valor_centavos end)::int as total
       from caixa_movimento
      where tipo in ('pagamento', 'estorno')
        and criado_em >= $1 and criado_em < $2
      group by 1, 2 order by 1`,
    [inicio, fim],
  );
  const porForma = { dinheiro: 0, pix: 0, cartao: 0 };
  const porDia = new Map<string, number>();
  for (const e of entradas) {
    porForma[e.forma as keyof typeof porForma] += e.total;
    porDia.set(e.dia, (porDia.get(e.dia) ?? 0) + e.total);
  }
  const totalEntradas = porForma.dinheiro + porForma.pix + porForma.cartao;

  const saidas = await consultar<{ categoria: string; total: number }>(
    `select categoria, sum(valor_centavos)::int as total from conta_pagar
      where pago_em >= $1 and pago_em < $2 group by categoria order by total desc`,
    [inicio, fim],
  );
  const totalSaidas = saidas.reduce((t, s) => t + s.total, 0);

  const [aPagar] = await consultar<{ n: number; total: number }>(
    `select count(*)::int as n, coalesce(sum(valor_centavos), 0)::int as total
       from conta_pagar
      where pago_em is null and cancelada_em is null
        and vencimento >= $1::date and vencimento < $2::date`,
    [primeiro, proximo],
  );
  const [atrasadas] = await consultar<{ n: number; total: number }>(
    `select count(*)::int as n, coalesce(sum(valor_centavos), 0)::int as total
       from conta_pagar
      where pago_em is null and cancelada_em is null and vencimento < $1::date`,
    [hoje],
  );

  return {
    mes,
    entradas: {
      totalCentavos: totalEntradas,
      ...porForma,
      porDia: [...porDia.entries()].map(([dia, centavos]) => ({
        dia,
        centavos,
      })),
    },
    saidasPagas: {
      totalCentavos: totalSaidas,
      porCategoria: saidas.map((s) => ({
        categoria: s.categoria,
        centavos: s.total,
      })),
    },
    resultadoCentavos: totalEntradas - totalSaidas,
    aPagarNoMes: { quantidade: aPagar.n, centavos: aPagar.total },
    atrasadas: { quantidade: atrasadas.n, centavos: atrasadas.total },
  };
}
