import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";
import { pagamentoDosPilotos } from "@/lib/operacao/pagamento-pilotos";
import { formatarReais } from "@/lib/operacao/tempo";

export type FormaPagamento = "dinheiro" | "pix" | "cartao";
export const FORMAS: readonly FormaPagamento[] = ["dinheiro", "pix", "cartao"];

export interface Caixa {
  id: string;
  abertoEm: Date;
  abertoPor: string | null;
  fundoCentavos: number;
  fechadoEm: Date | null;
  fechadoPor: string | null;
  esperadoDinheiroCentavos: number | null;
  contadoDinheiroCentavos: number | null;
  diferencaCentavos: number | null;
  observacao: string | null;
}

interface LinhaCaixa {
  id: string;
  aberto_em: Date;
  aberto_por: string | null;
  fundo_centavos: number;
  fechado_em: Date | null;
  fechado_por: string | null;
  esperado_dinheiro_centavos: number | null;
  contado_dinheiro_centavos: number | null;
  diferenca_centavos: number | null;
  observacao: string | null;
}

const COLUNAS_CAIXA = `id, aberto_em, aberto_por, fundo_centavos, fechado_em,
  fechado_por, esperado_dinheiro_centavos, contado_dinheiro_centavos,
  diferenca_centavos, observacao`;

function caixaDeLinha(l: LinhaCaixa): Caixa {
  return {
    id: l.id,
    abertoEm: l.aberto_em,
    abertoPor: l.aberto_por,
    fundoCentavos: l.fundo_centavos,
    fechadoEm: l.fechado_em,
    fechadoPor: l.fechado_por,
    esperadoDinheiroCentavos: l.esperado_dinheiro_centavos,
    contadoDinheiroCentavos: l.contado_dinheiro_centavos,
    diferencaCentavos: l.diferenca_centavos,
    observacao: l.observacao,
  };
}

export async function caixaAberto(): Promise<Caixa | null> {
  const linhas = await consultar<LinhaCaixa>(
    `select ${COLUNAS_CAIXA} from caixa where fechado_em is null`,
  );
  return linhas[0] ? caixaDeLinha(linhas[0]) : null;
}

export async function lerCaixa(id: string): Promise<Caixa | null> {
  const linhas = await consultar<LinhaCaixa>(
    `select ${COLUNAS_CAIXA} from caixa where id = $1`,
    [id],
  );
  return linhas[0] ? caixaDeLinha(linhas[0]) : null;
}

export async function caixasFechados(limite = 15): Promise<Caixa[]> {
  const linhas = await consultar<LinhaCaixa>(
    `select ${COLUNAS_CAIXA} from caixa where fechado_em is not null
      order by fechado_em desc limit $1`,
    [limite],
  );
  return linhas.map(caixaDeLinha);
}

function inteiroNaoNegativo(valor: number, mensagem: string): number {
  if (!Number.isInteger(valor) || valor < 0) throw new ErroNegocio(mensagem);
  return valor;
}

function valorPositivo(valor: number): number {
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new ErroNegocio("Informe um valor maior que zero.");
  }
  return valor;
}

export async function abrirCaixa(
  fundoCentavos: number,
  ator: Ator,
): Promise<string> {
  inteiroNaoNegativo(fundoCentavos, "Valor do fundo de troco inválido.");
  return transacao(async (cliente) => {
    const id = `cx-${randomUUID()}`;
    try {
      await cliente.query(
        "insert into caixa (id, aberto_por, fundo_centavos) values ($1, $2, $3)",
        [id, ator.usuarioId, fundoCentavos],
      );
    } catch (erro) {
      if ((erro as { code?: string }).code === "23505") {
        throw new ErroNegocio(
          "Já existe um caixa aberto. Feche-o antes de abrir outro.",
        );
      }
      throw erro;
    }
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "caixa.abrir",
        entidade: "caixa",
        entidadeId: id,
        depois: { fundoCentavos },
      },
      cliente,
    );
    return id;
  });
}

// Trava e devolve o caixa aberto (ou falha: só se recebe com o caixa aberto).
async function travarCaixaAberto(cliente: PoolClient): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    "select id from caixa where fechado_em is null for update",
  );
  if (!rows[0]) throw new ErroNegocio("Abra o caixa antes de lançar valores.");
  return rows[0].id;
}

// O pagamento atribuído a um piloto não pode passar do que ele ainda deve
// (a parte dele na reserva, já descontado o que foi pago).
async function exigirValorDoPiloto(
  cliente: PoolClient,
  reservaId: string,
  reservaPilotoId: string,
  valorCentavos: number,
): Promise<void> {
  const { rows: pilotos } = await cliente.query<{ id: string; ordem: number }>(
    "select id, ordem from reserva_piloto where reserva_id = $1",
    [reservaId],
  );
  if (!pilotos.some((p) => p.id === reservaPilotoId)) {
    throw new ErroNegocio("Esse piloto não faz parte desta reserva.");
  }
  const { rows: reservas } = await cliente.query<{
    pilotos: number;
    valor_centavos: number;
  }>("select pilotos, valor_centavos from reserva where id = $1", [reservaId]);
  const { rows: movs } = await cliente.query<{
    id: string;
    tipo: "pagamento" | "estorno";
    forma: FormaPagamento;
    valor_centavos: number;
    reserva_piloto_id: string | null;
    estorno_de: string | null;
  }>(
    `select id::text as id, tipo, forma, valor_centavos, reserva_piloto_id,
            estorno_de::text as estorno_de
       from caixa_movimento where reserva_id = $1 and tipo in ('pagamento', 'estorno')`,
    [reservaId],
  );
  const situacao = pagamentoDosPilotos(
    { valorCentavos: reservas[0].valor_centavos, pilotos: reservas[0].pilotos },
    pilotos,
    movs.map((m) => ({
      id: Number(m.id),
      tipo: m.tipo,
      forma: m.forma,
      valorCentavos: m.valor_centavos,
      pilotoId: m.reserva_piloto_id,
      estornoDe: m.estorno_de === null ? null : Number(m.estorno_de),
    })),
  ).get(reservaPilotoId);
  const falta = (situacao?.devidoCentavos ?? 0) - (situacao?.pagoCentavos ?? 0);
  if (falta <= 0) throw new ErroNegocio("Este piloto já está pago.");
  if (valorCentavos > falta) {
    throw new ErroNegocio(
      `Este piloto deve ${formatarReais(falta)}. Lance só o que falta dele.`,
    );
  }
}

export async function registrarPagamento(
  dados: {
    reservaId: string;
    forma: FormaPagamento;
    valorCentavos: number;
    // Piloto da reserva a quem o pagamento é atribuído (opcional).
    reservaPilotoId?: string;
  },
  ator: Ator,
): Promise<number> {
  if (!FORMAS.includes(dados.forma)) {
    throw new ErroNegocio("Forma de pagamento inválida.");
  }
  valorPositivo(dados.valorCentavos);

  return transacao(async (cliente) => {
    const caixaId = await travarCaixaAberto(cliente);
    const { rows } = await cliente.query<{
      status: string;
      valor_centavos: number;
    }>("select status, valor_centavos from reserva where id = $1 for update", [
      dados.reservaId,
    ]);
    const reserva = rows[0];
    if (!reserva) throw new ErroNegocio("Reserva não encontrada.");
    if (reserva.status !== "reservada") {
      throw new ErroNegocio("Esta reserva está cancelada.");
    }
    const pago = await cliente.query<{ pago: number }>(
      `select coalesce(sum(case when tipo = 'pagamento' then valor_centavos
                                else -valor_centavos end), 0)::int as pago
         from caixa_movimento where reserva_id = $1`,
      [dados.reservaId],
    );
    const saldo = reserva.valor_centavos - pago.rows[0].pago;
    if (saldo <= 0) throw new ErroNegocio("Esta reserva já está paga.");
    if (dados.valorCentavos > saldo) {
      throw new ErroNegocio(
        "O valor é maior que o saldo da reserva. Lance só o que falta pagar.",
      );
    }

    if (dados.reservaPilotoId) {
      await exigirValorDoPiloto(
        cliente,
        dados.reservaId,
        dados.reservaPilotoId,
        dados.valorCentavos,
      );
    }
    const mov = await cliente.query<{ id: string }>(
      `insert into caixa_movimento (caixa_id, tipo, forma, valor_centavos, reserva_id, criado_por, reserva_piloto_id)
       values ($1, 'pagamento', $2, $3, $4, $5, $6) returning id`,
      [
        caixaId,
        dados.forma,
        dados.valorCentavos,
        dados.reservaId,
        ator.usuarioId,
        dados.reservaPilotoId ?? null,
      ],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "caixa.pagamento",
        entidade: "caixa_movimento",
        entidadeId: mov.rows[0].id,
        depois: { ...dados, caixaId },
      },
      cliente,
    );
    return Number(mov.rows[0].id);
  });
}

// Estorno vai pro caixa ABERTO de hoje (o original pode estar em caixa já
// fechado — o fechamento antigo nunca é alterado).
export async function estornarPagamento(
  dados: { movimentoId: number; motivo: string },
  ator: Ator,
): Promise<void> {
  const motivo = dados.motivo.trim();
  if (motivo.length < 3) throw new ErroNegocio("Informe o motivo do estorno.");

  await transacao(async (cliente) => {
    const caixaId = await travarCaixaAberto(cliente);
    const { rows } = await cliente.query<{
      tipo: string;
      forma: FormaPagamento;
      valor_centavos: number;
      reserva_id: string | null;
    }>(
      `select tipo, forma, valor_centavos, reserva_id
         from caixa_movimento where id = $1`,
      [dados.movimentoId],
    );
    const original = rows[0];
    if (!original || original.tipo !== "pagamento") {
      throw new ErroNegocio("Pagamento não encontrado.");
    }
    try {
      await cliente.query(
        `insert into caixa_movimento (caixa_id, tipo, forma, valor_centavos, reserva_id, estorno_de, descricao, criado_por)
         values ($1, 'estorno', $2, $3, $4, $5, $6, $7)`,
        [
          caixaId,
          original.forma,
          original.valor_centavos,
          original.reserva_id,
          dados.movimentoId,
          motivo,
          ator.usuarioId,
        ],
      );
    } catch (erro) {
      if ((erro as { code?: string }).code === "23505") {
        throw new ErroNegocio("Este pagamento já foi estornado.");
      }
      throw erro;
    }
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "caixa.estorno",
        entidade: "caixa_movimento",
        entidadeId: String(dados.movimentoId),
        antes: original,
        motivo,
      },
      cliente,
    );
  });
}

export interface ResumoCaixa {
  caixa: Caixa;
  // Recebido líquido (pagamentos − estornos) por forma.
  recebido: Record<FormaPagamento, number>;
  totalRecebido: number;
  suprimentos: number;
  sangrias: number;
  // Dinheiro que deve estar na gaveta: fundo + dinheiro líquido + suprimentos − sangrias.
  esperadoDinheiro: number;
}

async function resumir(
  caixa: Caixa,
  cliente?: PoolClient,
): Promise<ResumoCaixa> {
  const texto = `select tipo, forma, sum(valor_centavos)::int as total
       from caixa_movimento where caixa_id = $1 group by tipo, forma`;
  type Linha = { tipo: string; forma: FormaPagamento; total: number };
  const rows = cliente
    ? (await cliente.query<Linha>(texto, [caixa.id])).rows
    : await consultar<Linha>(texto, [caixa.id]);
  const recebido: Record<FormaPagamento, number> = {
    dinheiro: 0,
    pix: 0,
    cartao: 0,
  };
  let suprimentos = 0;
  let sangrias = 0;
  for (const r of rows) {
    if (r.tipo === "pagamento") recebido[r.forma] += r.total;
    else if (r.tipo === "estorno") recebido[r.forma] -= r.total;
    else if (r.tipo === "suprimento") suprimentos += r.total;
    else sangrias += r.total;
  }
  return {
    caixa,
    recebido,
    totalRecebido: recebido.dinheiro + recebido.pix + recebido.cartao,
    suprimentos,
    sangrias,
    esperadoDinheiro:
      caixa.fundoCentavos + recebido.dinheiro + suprimentos - sangrias,
  };
}

export async function resumoDoCaixa(caixa: Caixa): Promise<ResumoCaixa> {
  return resumir(caixa);
}

// Suprimento (entra dinheiro) e sangria (sai dinheiro) — sempre em dinheiro.
export async function registrarSuprimentoOuSangria(
  dados: {
    tipo: "suprimento" | "sangria";
    valorCentavos: number;
    descricao: string;
  },
  ator: Ator,
): Promise<void> {
  valorPositivo(dados.valorCentavos);
  const descricao = dados.descricao.trim();
  if (descricao.length < 3) throw new ErroNegocio("Informe o motivo.");

  await transacao(async (cliente) => {
    const caixaId = await travarCaixaAberto(cliente);
    if (dados.tipo === "sangria") {
      const caixa = await cliente.query<LinhaCaixa>(
        `select ${COLUNAS_CAIXA} from caixa where id = $1`,
        [caixaId],
      );
      const resumo = await resumir(caixaDeLinha(caixa.rows[0]), cliente);
      if (dados.valorCentavos > resumo.esperadoDinheiro) {
        throw new ErroNegocio(
          "A sangria é maior que o dinheiro que há no caixa.",
        );
      }
    }
    const mov = await cliente.query<{ id: string }>(
      `insert into caixa_movimento (caixa_id, tipo, forma, valor_centavos, descricao, criado_por)
       values ($1, $2, 'dinheiro', $3, $4, $5) returning id`,
      [caixaId, dados.tipo, dados.valorCentavos, descricao, ator.usuarioId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: `caixa.${dados.tipo}`,
        entidade: "caixa_movimento",
        entidadeId: mov.rows[0].id,
        depois: { valorCentavos: dados.valorCentavos, descricao },
      },
      cliente,
    );
  });
}

export async function fecharCaixa(
  dados: {
    caixaId: string;
    contadoCentavos: number;
    observacao?: string;
  },
  ator: Ator,
): Promise<ResumoCaixa> {
  inteiroNaoNegativo(dados.contadoCentavos, "Informe o dinheiro contado.");
  const observacao = dados.observacao?.trim() || null;

  return transacao(async (cliente) => {
    const { rows } = await cliente.query<LinhaCaixa>(
      `select ${COLUNAS_CAIXA} from caixa where id = $1 for update`,
      [dados.caixaId],
    );
    if (!rows[0]) throw new ErroNegocio("Caixa não encontrado.");
    if (rows[0].fechado_em) throw new ErroNegocio("Este caixa já foi fechado.");

    const resumo = await resumir(caixaDeLinha(rows[0]), cliente);
    const diferenca = dados.contadoCentavos - resumo.esperadoDinheiro;
    if (diferenca !== 0 && !observacao) {
      throw new ErroNegocio(
        "O dinheiro contado não bate com o esperado. Explique a diferença em observação.",
      );
    }

    const fechado = await cliente.query<LinhaCaixa>(
      `update caixa set fechado_em = now(), fechado_por = $2,
              esperado_dinheiro_centavos = $3, contado_dinheiro_centavos = $4,
              diferenca_centavos = $5, observacao = $6
        where id = $1 returning ${COLUNAS_CAIXA}`,
      [
        dados.caixaId,
        ator.usuarioId,
        resumo.esperadoDinheiro,
        dados.contadoCentavos,
        diferenca,
        observacao,
      ],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "caixa.fechar",
        entidade: "caixa",
        entidadeId: dados.caixaId,
        depois: {
          esperadoDinheiro: resumo.esperadoDinheiro,
          contado: dados.contadoCentavos,
          diferenca,
          recebido: resumo.recebido,
        },
        motivo: observacao,
      },
      cliente,
    );
    return { ...resumo, caixa: caixaDeLinha(fechado.rows[0]) };
  });
}

export interface MovimentoDoCaixa {
  id: number;
  tipo: "pagamento" | "estorno" | "suprimento" | "sangria";
  forma: FormaPagamento;
  valorCentavos: number;
  reservaId: string | null;
  clienteNome: string | null;
  estornoDe: number | null;
  estornado: boolean;
  descricao: string | null;
  criadoEm: Date;
}

export async function lerMovimentos(
  caixaId: string,
): Promise<MovimentoDoCaixa[]> {
  const linhas = await consultar<{
    id: string;
    tipo: MovimentoDoCaixa["tipo"];
    forma: FormaPagamento;
    valor_centavos: number;
    reserva_id: string | null;
    cliente_nome: string | null;
    estorno_de: string | null;
    estornado: boolean;
    descricao: string | null;
    criado_em: Date;
  }>(
    `select m.id, m.tipo, m.forma, m.valor_centavos, m.reserva_id,
            c.nome as cliente_nome, m.estorno_de, m.descricao, m.criado_em,
            exists (select 1 from caixa_movimento e where e.estorno_de = m.id)
              as estornado
       from caixa_movimento m
       left join reserva r on r.id = m.reserva_id
       left join cliente c on c.id = r.cliente_id
      where m.caixa_id = $1
      order by m.id desc`,
    [caixaId],
  );
  return linhas.map((l) => ({
    id: Number(l.id),
    tipo: l.tipo,
    forma: l.forma,
    valorCentavos: l.valor_centavos,
    reservaId: l.reserva_id,
    clienteNome: l.cliente_nome,
    estornoDe: l.estorno_de === null ? null : Number(l.estorno_de),
    estornado: l.estornado,
    descricao: l.descricao,
    criadoEm: l.criado_em,
  }));
}
