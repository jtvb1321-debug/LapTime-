import { consultar } from "@/lib/db/conexao";
import type { Caixa, FormaPagamento } from "@/lib/operacao/caixa-store";
import { lerCaixa } from "@/lib/operacao/caixa-store";
import { limitesDoDia } from "@/lib/operacao/tempo";

export interface RelatorioDoDia {
  dia: string;
  // Recebido líquido (pagamentos − estornos) por forma.
  recebido: Record<FormaPagamento, number>;
  totalRecebido: number;
  pagamentos: { quantidade: number; centavos: number };
  estornos: { quantidade: number; centavos: number };
  suprimentosCentavos: number;
  sangriasCentavos: number;
  reservas: {
    ativas: number;
    canceladas: number;
    pilotos: number;
    valorCentavos: number;
  };
  baterias: { total: number; capacidade: number };
  porOperador: { operador: string; recebidoCentavos: number }[];
  caixasFechados: Caixa[];
}

const ZERO_FORMAS = (): Record<FormaPagamento, number> => ({
  dinheiro: 0,
  pix: 0,
  cartao: 0,
});

export async function relatorioDoDia(dia: string): Promise<RelatorioDoDia> {
  const { inicio, fim } = limitesDoDia(dia);

  const movimentos = await consultar<{
    tipo: string;
    forma: FormaPagamento;
    total: number;
    n: number;
  }>(
    `select tipo, forma, sum(valor_centavos)::int as total, count(*)::int as n
       from caixa_movimento
      where criado_em >= $1 and criado_em < $2 group by tipo, forma`,
    [inicio, fim],
  );
  const recebido = ZERO_FORMAS();
  const pagamentos = { quantidade: 0, centavos: 0 };
  const estornos = { quantidade: 0, centavos: 0 };
  let suprimentosCentavos = 0;
  let sangriasCentavos = 0;
  for (const m of movimentos) {
    if (m.tipo === "pagamento") {
      recebido[m.forma] += m.total;
      pagamentos.quantidade += m.n;
      pagamentos.centavos += m.total;
    } else if (m.tipo === "estorno") {
      recebido[m.forma] -= m.total;
      estornos.quantidade += m.n;
      estornos.centavos += m.total;
    } else if (m.tipo === "suprimento") suprimentosCentavos += m.total;
    else sangriasCentavos += m.total;
  }

  const [reservas] = await consultar<{
    ativas: number;
    canceladas: number;
    pilotos: number;
    valor: number;
  }>(
    `select count(*) filter (where r.status = 'reservada')::int as ativas,
            count(*) filter (where r.status = 'cancelada')::int as canceladas,
            coalesce(sum(r.pilotos) filter (where r.status = 'reservada'), 0)::int as pilotos,
            coalesce(sum(r.valor_centavos) filter (where r.status = 'reservada'), 0)::int as valor
       from reserva r join bateria_slot s on s.id = r.slot_id
      where s.inicio >= $1 and s.inicio < $2`,
    [inicio, fim],
  );
  const [baterias] = await consultar<{ total: number; capacidade: number }>(
    `select count(*)::int as total, coalesce(sum(capacidade), 0)::int as capacidade
       from bateria_slot
      where inicio >= $1 and inicio < $2 and cancelada_em is null`,
    [inicio, fim],
  );

  const operadores = await consultar<{ operador: string; total: number }>(
    `select coalesce(p.nome, m.criado_por, 'desconhecido') as operador,
            sum(case when m.tipo = 'pagamento' then m.valor_centavos
                     else -m.valor_centavos end)::int as total
       from caixa_movimento m left join perfil p on p.id = m.criado_por
      where m.criado_em >= $1 and m.criado_em < $2
        and m.tipo in ('pagamento', 'estorno')
      group by 1 order by total desc`,
    [inicio, fim],
  );

  const fechados = await consultar<{ id: string }>(
    `select id from caixa where fechado_em >= $1 and fechado_em < $2
      order by fechado_em`,
    [inicio, fim],
  );
  const caixasFechados: Caixa[] = [];
  for (const { id } of fechados) {
    const caixa = await lerCaixa(id);
    if (caixa) caixasFechados.push(caixa);
  }

  return {
    dia,
    recebido,
    totalRecebido: recebido.dinheiro + recebido.pix + recebido.cartao,
    pagamentos,
    estornos,
    suprimentosCentavos,
    sangriasCentavos,
    reservas: {
      ativas: reservas.ativas,
      canceladas: reservas.canceladas,
      pilotos: reservas.pilotos,
      valorCentavos: reservas.valor,
    },
    baterias,
    porOperador: operadores.map((o) => ({
      operador: o.operador,
      recebidoCentavos: o.total,
    })),
    caixasFechados,
  };
}

export interface PagamentoDaReserva {
  id: number;
  tipo: "pagamento" | "estorno";
  forma: FormaPagamento;
  valorCentavos: number;
  criadoEm: Date;
}

// Pagamentos e estornos de uma reserva, em ordem (pro recibo).
export async function lerPagamentosDaReserva(
  reservaId: string,
): Promise<PagamentoDaReserva[]> {
  const linhas = await consultar<{
    id: string;
    tipo: "pagamento" | "estorno";
    forma: FormaPagamento;
    valor_centavos: number;
    criado_em: Date;
  }>(
    `select id, tipo, forma, valor_centavos, criado_em from caixa_movimento
      where reserva_id = $1 order by id`,
    [reservaId],
  );
  return linhas.map((l) => ({
    id: Number(l.id),
    tipo: l.tipo,
    forma: l.forma,
    valorCentavos: l.valor_centavos,
    criadoEm: l.criado_em,
  }));
}
