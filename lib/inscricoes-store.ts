import { randomUUID } from "node:crypto";
import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio } from "@/lib/operacao/erros";

// Inscrição por etapa + pagamento registrado pelo admin. Regras:
//  - só pilotos do campeonato, em categoria que existe no campeonato, em etapa "agendada";
//  - etapa com valor > 0: nasce "pendente" com pagamento "aguardando"; ao confirmar o pagamento a
//    inscrição fica "confirmada". Etapa gratuita: nasce "confirmada", sem pagamento a receber;
//  - cancelar não apaga: guarda o histórico (e o piloto pode se inscrever de novo).
export type StatusDaInscricao = "pendente" | "confirmada" | "cancelada";
export type StatusDoPagamento = "aguardando" | "confirmado" | "cancelado";
export type MetodoDePagamento = "pix" | "dinheiro" | "cartao";
export const METODOS: MetodoDePagamento[] = ["pix", "dinheiro", "cartao"];

export interface PagamentoDaInscricao {
  id: string;
  valorCentavos: number;
  metodo: MetodoDePagamento | null;
  status: StatusDoPagamento;
  confirmadoEm: string | null;
}

export interface InscricaoCompleta {
  id: string;
  etapaId: string;
  etapaNumero: number;
  etapaNome: string;
  etapaData: string;
  etapaHora: string;
  pilotoId: string;
  pilotoNome: string;
  pilotoNumero: number;
  categoriaId: string;
  status: StatusDaInscricao;
  criadaEm: string;
  pagamento: PagamentoDaInscricao | null;
}

interface LinhaInscricao {
  id: string;
  etapa_id: string;
  etapa_numero: number;
  etapa_nome: string;
  etapa_data: string;
  etapa_hora: string;
  piloto_id: string;
  piloto_nome: string;
  piloto_numero: number;
  categoria_id: string;
  status: StatusDaInscricao;
  criada_em: Date;
  pag_id: string | null;
  pag_valor: number | null;
  pag_metodo: MetodoDePagamento | null;
  pag_status: StatusDoPagamento | null;
  pag_confirmado_em: Date | null;
}

const SELECT = `select i.id, i.etapa_id, e.numero as etapa_numero, e.nome as etapa_nome,
       to_char(e.data, 'YYYY-MM-DD') as etapa_data, to_char(e.hora, 'HH24:MI') as etapa_hora,
       i.piloto_id, coalesce(nullif(trim(p.apelido), ''), p.nome) as piloto_nome,
       p.numero as piloto_numero, i.categoria_id, i.status, i.criada_em,
       g.id as pag_id, g.valor_centavos as pag_valor, g.metodo as pag_metodo,
       g.status as pag_status, g.confirmado_em as pag_confirmado_em
  from inscricao i
  join etapa e on e.id = i.etapa_id
  join piloto p on p.id = i.piloto_id
  left join pagamento g on g.inscricao_id = i.id`;

function deLinha(l: LinhaInscricao): InscricaoCompleta {
  return {
    id: l.id,
    etapaId: l.etapa_id,
    etapaNumero: l.etapa_numero,
    etapaNome: l.etapa_nome,
    etapaData: l.etapa_data,
    etapaHora: l.etapa_hora,
    pilotoId: l.piloto_id,
    pilotoNome: l.piloto_nome,
    pilotoNumero: l.piloto_numero,
    categoriaId: l.categoria_id,
    status: l.status,
    criadaEm: l.criada_em.toISOString(),
    pagamento: l.pag_id
      ? {
          id: l.pag_id,
          valorCentavos: l.pag_valor ?? 0,
          metodo: l.pag_metodo,
          status: l.pag_status ?? "aguardando",
          confirmadoEm: l.pag_confirmado_em?.toISOString() ?? null,
        }
      : null,
  };
}

export async function lerInscricoesDoCampeonato(
  campeonatoId: string,
): Promise<InscricaoCompleta[]> {
  try {
    const linhas = await consultar<LinhaInscricao>(
      `${SELECT} where e.campeonato_id = $1
        order by e.data, e.hora, e.numero, p.numero`,
      [campeonatoId],
    );
    return linhas.map(deLinha);
  } catch {
    return [];
  }
}

export async function lerInscricoesDoPiloto(
  pilotoId: string,
  campeonatoId: string,
): Promise<InscricaoCompleta[]> {
  try {
    const linhas = await consultar<LinhaInscricao>(
      `${SELECT} where i.piloto_id = $1 and e.campeonato_id = $2
        order by e.data, e.hora, e.numero`,
      [pilotoId, campeonatoId],
    );
    return linhas.map(deLinha);
  } catch {
    return [];
  }
}

// Inscreve o piloto na etapa. `porAdmin` só muda a mensagem de erro e o registro de quem criou.
export async function inscreverPiloto(
  etapaId: string,
  pilotoId: string,
  criadoPor: string | null,
): Promise<{ inscricaoId: string; gratuita: boolean }> {
  return transacao(async (cliente) => {
    const etapa = (
      await cliente.query(
        `select e.id, e.campeonato_id, e.status, e.nome, e.valor_inscricao_centavos as valor
           from etapa e where e.id = $1`,
        [etapaId],
      )
    ).rows[0] as
      | {
          id: string;
          campeonato_id: string;
          status: string;
          nome: string;
          valor: number;
        }
      | undefined;
    if (!etapa) throw new ErroNegocio("Etapa não encontrada.");
    if (etapa.status !== "agendada") {
      throw new ErroNegocio("Esta etapa não está aberta para inscrições.");
    }
    const piloto = (
      await cliente.query(
        `select p.id, p.categoria_id,
                exists (select 1 from campeonato_piloto cp
                         where cp.campeonato_id = $2 and cp.piloto_id = p.id) as no_campeonato
           from piloto p where p.id = $1`,
        [pilotoId, etapa.campeonato_id],
      )
    ).rows[0] as
      { id: string; categoria_id: string; no_campeonato: boolean } | undefined;
    if (!piloto) throw new ErroNegocio("Piloto não encontrado.");
    if (!piloto.no_campeonato) {
      throw new ErroNegocio("Este piloto não faz parte do campeonato.");
    }
    const cats = (
      await cliente.query(
        "select categoria_id from campeonato_categoria where campeonato_id = $1",
        [etapa.campeonato_id],
      )
    ).rows as { categoria_id: string }[];
    if (
      cats.length > 0 &&
      !cats.some((c) => c.categoria_id === piloto.categoria_id)
    ) {
      throw new ErroNegocio(
        "A categoria deste piloto não participa do campeonato.",
      );
    }

    const gratuita = etapa.valor === 0;
    const statusInicial = gratuita ? "confirmada" : "pendente";
    const existente = (
      await cliente.query(
        "select id, status from inscricao where etapa_id = $1 and piloto_id = $2",
        [etapaId, pilotoId],
      )
    ).rows[0] as { id: string; status: string } | undefined;

    let inscricaoId: string;
    if (existente) {
      if (existente.status !== "cancelada") {
        throw new ErroNegocio("O piloto já está inscrito nesta etapa.");
      }
      inscricaoId = existente.id;
      await cliente.query(
        `update inscricao set status = $2, categoria_id = $3, criado_por = $4,
                criada_em = clock_timestamp() where id = $1`,
        [inscricaoId, statusInicial, piloto.categoria_id, criadoPor],
      );
      await cliente.query("delete from pagamento where inscricao_id = $1", [
        inscricaoId,
      ]);
    } else {
      inscricaoId = `insc-${randomUUID().slice(0, 8)}`;
      await cliente.query(
        `insert into inscricao (id, etapa_id, piloto_id, categoria_id, status, criado_por)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          inscricaoId,
          etapaId,
          pilotoId,
          piloto.categoria_id,
          statusInicial,
          criadoPor,
        ],
      );
    }
    if (!gratuita) {
      await cliente.query(
        `insert into pagamento (id, inscricao_id, valor_centavos, status)
         values ($1, $2, $3, 'aguardando')`,
        [`pag-${randomUUID().slice(0, 8)}`, inscricaoId, etapa.valor],
      );
    }
    return { inscricaoId, gratuita };
  });
}

export async function cancelarInscricao(inscricaoId: string): Promise<void> {
  await transacao(async (cliente) => {
    const l = (
      await cliente.query(
        `select i.status, g.id as pag_id, g.status as pag_status
           from inscricao i left join pagamento g on g.inscricao_id = i.id
          where i.id = $1`,
        [inscricaoId],
      )
    ).rows[0] as
      | { status: string; pag_id: string | null; pag_status: string | null }
      | undefined;
    if (!l) throw new ErroNegocio("Inscrição não encontrada.");
    if (l.status === "cancelada") return;
    if (l.pag_status === "confirmado") {
      throw new ErroNegocio(
        "Este pagamento já foi confirmado. Estorne o pagamento (em Pagamentos) para cancelar a inscrição.",
      );
    }
    await cliente.query(
      "update inscricao set status = 'cancelada' where id = $1",
      [inscricaoId],
    );
    if (l.pag_id) {
      await cliente.query(
        "update pagamento set status = 'cancelado' where id = $1",
        [l.pag_id],
      );
    }
  });
}

export async function confirmarPagamento(
  pagamentoId: string,
  metodo: string,
  usuarioId: string,
): Promise<void> {
  if (!METODOS.includes(metodo as MetodoDePagamento)) {
    throw new ErroNegocio(
      "Escolha a forma de pagamento: Pix, dinheiro ou cartão.",
    );
  }
  await transacao(async (cliente) => {
    const g = (
      await cliente.query(
        `select g.status, g.inscricao_id, i.status as insc_status
           from pagamento g join inscricao i on i.id = g.inscricao_id
          where g.id = $1`,
        [pagamentoId],
      )
    ).rows[0] as
      { status: string; inscricao_id: string; insc_status: string } | undefined;
    if (!g) throw new ErroNegocio("Pagamento não encontrado.");
    if (g.status === "confirmado") {
      throw new ErroNegocio("Este pagamento já está confirmado.");
    }
    if (g.status === "cancelado" || g.insc_status === "cancelada") {
      throw new ErroNegocio("Esta inscrição foi cancelada.");
    }
    await cliente.query(
      `update pagamento set status = 'confirmado', metodo = $2, registrado_por = $3,
              confirmado_em = clock_timestamp() where id = $1`,
      [pagamentoId, metodo, usuarioId],
    );
    await cliente.query(
      "update inscricao set status = 'confirmada' where id = $1",
      [g.inscricao_id],
    );
  });
}

// Estorno: o pagamento confirmado é cancelado e a inscrição também.
export async function estornarPagamento(pagamentoId: string): Promise<void> {
  await transacao(async (cliente) => {
    const g = (
      await cliente.query(
        "select status, inscricao_id from pagamento where id = $1",
        [pagamentoId],
      )
    ).rows[0] as { status: string; inscricao_id: string } | undefined;
    if (!g) throw new ErroNegocio("Pagamento não encontrado.");
    if (g.status !== "confirmado") {
      throw new ErroNegocio("Só um pagamento confirmado pode ser estornado.");
    }
    await cliente.query(
      "update pagamento set status = 'cancelado' where id = $1",
      [pagamentoId],
    );
    await cliente.query(
      "update inscricao set status = 'cancelada' where id = $1",
      [g.inscricao_id],
    );
  });
}
