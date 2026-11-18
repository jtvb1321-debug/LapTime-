import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { lerModeloDeVinculo } from "@/lib/cronometragem/cadastros-store";
import { obterOuCriarCliente } from "@/lib/operacao/clientes-store";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";
import type { FormaPagamento } from "@/lib/operacao/caixa-store";
import {
  pagamentoDosPilotos,
  type MovimentoDePagamento,
  type PagamentoDoPiloto,
} from "@/lib/operacao/pagamento-pilotos";
import { clientesComTermoValido } from "@/lib/operacao/termo-store";

// Pilotos de uma reserva: quem faz a reserva informa (ou o balcão cadastra) o
// nome de cada piloto, todos com cadastro. Quando a bateria é aberta, esses
// pilotos entram nela; o pagamento é acompanhado piloto a piloto.

export interface PilotoDaReserva {
  id: string;
  reservaId: string;
  clienteId: string;
  numero: number;
  nome: string;
  telefone: string;
  ordem: number;
  pagamento: PagamentoDoPiloto;
  termoValido: boolean;
}

interface LinhaPiloto {
  id: string;
  reserva_id: string;
  cliente_id: string;
  numero: number;
  nome: string;
  telefone: string;
  ordem: number;
}

// Pagamento de cada piloto cadastrado nas reservas (chave = id do piloto da
// reserva). Usado também pela tela da bateria.
export async function pagamentosDasReservas(
  reservaIds: string[],
): Promise<Map<string, PagamentoDoPiloto>> {
  const resultado = new Map<string, PagamentoDoPiloto>();
  if (reservaIds.length === 0) return resultado;
  const [reservas, pilotos, movimentos] = await Promise.all([
    consultar<{ id: string; pilotos: number; valor_centavos: number }>(
      "select id, pilotos, valor_centavos from reserva where id = any($1)",
      [reservaIds],
    ),
    consultar<{ id: string; reserva_id: string; ordem: number }>(
      "select id, reserva_id, ordem from reserva_piloto where reserva_id = any($1)",
      [reservaIds],
    ),
    consultar<{
      id: string;
      reserva_id: string;
      tipo: "pagamento" | "estorno";
      forma: FormaPagamento;
      valor_centavos: number;
      reserva_piloto_id: string | null;
      estorno_de: string | null;
    }>(
      `select id::text as id, reserva_id, tipo, forma, valor_centavos,
              reserva_piloto_id, estorno_de::text as estorno_de
         from caixa_movimento
        where reserva_id = any($1) and tipo in ('pagamento', 'estorno')`,
      [reservaIds],
    ),
  ]);
  for (const r of reservas) {
    const doRodizio: MovimentoDePagamento[] = movimentos
      .filter((m) => m.reserva_id === r.id)
      .map((m) => ({
        id: Number(m.id),
        tipo: m.tipo,
        forma: m.forma,
        valorCentavos: m.valor_centavos,
        pilotoId: m.reserva_piloto_id,
        estornoDe: m.estorno_de === null ? null : Number(m.estorno_de),
      }));
    const porPiloto = pagamentoDosPilotos(
      { valorCentavos: r.valor_centavos, pilotos: r.pilotos },
      pilotos.filter((p) => p.reserva_id === r.id),
      doRodizio,
    );
    for (const [id, pagamento] of porPiloto) resultado.set(id, pagamento);
  }
  return resultado;
}

export async function listarPilotosDasReservas(
  reservaIds: string[],
): Promise<Map<string, PilotoDaReserva[]>> {
  const mapa = new Map<string, PilotoDaReserva[]>();
  if (reservaIds.length === 0) return mapa;
  const linhas = await consultar<LinhaPiloto>(
    `select rp.id, rp.reserva_id, rp.cliente_id, c.numero, c.nome, c.telefone, rp.ordem
       from reserva_piloto rp join cliente c on c.id = rp.cliente_id
      where rp.reserva_id = any($1)
      order by rp.ordem, rp.criado_em`,
    [reservaIds],
  );
  const [pagamentos, comTermo] = await Promise.all([
    pagamentosDasReservas(reservaIds),
    clientesComTermoValido(linhas.map((l) => l.cliente_id)),
  ]);
  for (const l of linhas) {
    const lista = mapa.get(l.reserva_id) ?? [];
    lista.push({
      id: l.id,
      reservaId: l.reserva_id,
      clienteId: l.cliente_id,
      numero: l.numero,
      nome: l.nome,
      telefone: l.telefone,
      ordem: l.ordem,
      pagamento: pagamentos.get(l.id) ?? {
        devidoCentavos: 0,
        pagoCentavos: 0,
        situacao: "a_pagar",
        formas: [],
      },
      termoValido: comTermo.has(l.cliente_id),
    });
    mapa.set(l.reserva_id, lista);
  }
  return mapa;
}

// Cadastra um piloto da reserva (cliente já cadastrado ou cadastro novo). Se a
// bateria da agenda já foi aberta na cronometragem, o piloto ocupa uma vaga dela.
export async function cadastrarPilotoDaReserva(
  reservaId: string,
  dados: {
    clienteId?: string;
    nome?: string;
    telefone?: string;
    nascimento?: string;
    documento?: string;
  },
  ator: Ator,
): Promise<{ clienteId: string; numero: number; nome: string }> {
  const alvo = await obterOuCriarCliente(dados, ator);
  const modelo = await lerModeloDeVinculo();
  await transacao(async (cliente) => {
    const { rows: reservas } = await cliente.query<{
      slot_id: string;
      pilotos: number;
      status: string;
    }>(
      "select slot_id, pilotos, status from reserva where id = $1 for update",
      [reservaId],
    );
    const reserva = reservas[0];
    if (!reserva) throw new ErroNegocio("Reserva não encontrada.");
    if (reserva.status !== "reservada") {
      throw new ErroNegocio("Esta reserva está cancelada.");
    }
    const { rows: atuais } = await cliente.query<{
      cliente_id: string;
      ordem: number;
    }>("select cliente_id, ordem from reserva_piloto where reserva_id = $1", [
      reservaId,
    ]);
    if (atuais.some((a) => a.cliente_id === alvo.id)) {
      throw new ErroNegocio(`${alvo.nome} já está nesta reserva.`);
    }
    if (atuais.length >= reserva.pilotos) {
      throw new ErroNegocio(
        `Os ${reserva.pilotos} pilotos desta reserva já foram cadastrados.`,
      );
    }
    const ordem = atuais.reduce((m, a) => Math.max(m, a.ordem), 0) + 1;
    const id = `rpil-${randomUUID()}`;
    await cliente.query(
      `insert into reserva_piloto (id, reserva_id, cliente_id, ordem, criado_por)
       values ($1, $2, $3, $4, $5)`,
      [id, reservaId, alvo.id, ordem, ator.usuarioId],
    );
    await ocuparVagaNaBateria(
      cliente,
      reserva.slot_id,
      reservaId,
      alvo,
      modelo,
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "reserva.piloto_cadastrar",
        entidade: "reserva_piloto",
        entidadeId: id,
        depois: { reservaId, clienteId: alvo.id, nome: alvo.nome },
      },
      cliente,
    );
  });
  return { clienteId: alvo.id, numero: alvo.numero, nome: alvo.nome };
}

// Se a bateria da agenda já está aberta (e não começou), o piloto entra na vaga.
async function ocuparVagaNaBateria(
  cliente: PoolClient,
  slotId: string,
  reservaId: string,
  piloto: { id: string; nome: string },
  modelo: string,
): Promise<void> {
  const { rows: corridas } = await cliente.query<{ id: string }>(
    `select id from corrida
      where slot_id = $1 and fase <> 'corrida' and estado in ('preparada', 'pronta')
      order by criado_em limit 1 for update`,
    [slotId],
  );
  if (!corridas[0]) return;
  const { rows: vaga } = await cliente.query<{ id: string }>(
    `select id from corrida_piloto
      where corrida_id = $1 and reserva_id = $2 and cliente_id is null
      order by criado_em, id limit 1 for update`,
    [corridas[0].id, reservaId],
  );
  if (vaga[0]) {
    await cliente.query(
      "update corrida_piloto set nome = $2, cliente_id = $3 where id = $1",
      [vaga[0].id, piloto.nome, piloto.id],
    );
  } else {
    await cliente.query(
      `insert into corrida_piloto (id, corrida_id, nome, cliente_id, reserva_id, modelo_vinculo)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        `cpiloto-${randomUUID()}`,
        corridas[0].id,
        piloto.nome,
        piloto.id,
        reservaId,
        modelo,
      ],
    );
  }
  await cliente.query(
    "update corrida set estado = 'preparada' where id = $1 and estado = 'pronta'",
    [corridas[0].id],
  );
}

export async function removerPilotoDaReserva(
  reservaPilotoId: string,
  ator: Ator,
): Promise<void> {
  const modelo = await lerModeloDeVinculo();
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<{
      id: string;
      reserva_id: string;
      cliente_id: string;
      nome: string;
      slot_id: string;
    }>(
      `select rp.id, rp.reserva_id, rp.cliente_id, c.nome, r.slot_id
         from reserva_piloto rp
         join cliente c on c.id = rp.cliente_id
         join reserva r on r.id = rp.reserva_id
        where rp.id = $1 for update of rp`,
      [reservaPilotoId],
    );
    const rp = rows[0];
    if (!rp) throw new ErroNegocio("Piloto não encontrado na reserva.");
    const { rowCount: pago } = await cliente.query(
      "select 1 from caixa_movimento where reserva_piloto_id = $1 limit 1",
      [reservaPilotoId],
    );
    if (pago) {
      throw new ErroNegocio(
        "Este piloto tem pagamento lançado. Estorne o pagamento antes de tirá-lo.",
      );
    }
    const { rows: naBateria } = await cliente.query<{
      id: string;
      corrida_id: string;
      estado: string;
    }>(
      `select p.id, p.corrida_id, c.estado
         from corrida_piloto p join corrida c on c.id = p.corrida_id
        where p.reserva_id = $1 and p.cliente_id = $2`,
      [rp.reserva_id, rp.cliente_id],
    );
    if (naBateria.some((p) => !["preparada", "pronta"].includes(p.estado))) {
      throw new ErroNegocio(
        "A bateria já começou: não dá para tirar o piloto.",
      );
    }
    // O lugar volta a ser uma vaga aberta da reserva.
    for (const p of naBateria) {
      await cliente.query("delete from corrida_piloto where id = $1", [p.id]);
      await cliente.query(
        `insert into corrida_piloto (id, corrida_id, nome, reserva_id, modelo_vinculo)
         values ($1, $2, $3, $4, $5)`,
        [
          `cpiloto-${randomUUID()}`,
          p.corrida_id,
          "Vaga",
          rp.reserva_id,
          modelo,
        ],
      );
    }
    await cliente.query("delete from reserva_piloto where id = $1", [rp.id]);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "reserva.piloto_remover",
        entidade: "reserva_piloto",
        entidadeId: rp.id,
        antes: {
          reservaId: rp.reserva_id,
          clienteId: rp.cliente_id,
          nome: rp.nome,
        },
      },
      cliente,
    );
  });
}
