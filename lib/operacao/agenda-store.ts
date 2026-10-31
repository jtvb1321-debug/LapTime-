import { randomUUID } from "node:crypto";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";
import {
  ehDiaValido,
  ehHoraValida,
  instanteLocal,
  limitesDoDia,
} from "@/lib/operacao/tempo";

export interface ReservaDoSlot {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  pilotos: number;
  valorCentavos: number;
  pagoCentavos: number;
  status: "reservada" | "cancelada";
}

export interface SlotDoDia {
  id: string;
  inicio: Date;
  duracaoMin: number;
  capacidade: number;
  precoCentavos: number;
  cancelada: boolean;
  ocupadas: number;
  reservas: ReservaDoSlot[];
}

// Pago líquido de uma reserva: pagamentos − estornos.
const PAGO_SQL = `coalesce((select sum(case when m.tipo = 'pagamento'
                                            then m.valor_centavos
                                            else -m.valor_centavos end)
                              from caixa_movimento m
                             where m.reserva_id = r.id), 0)::int`;

export interface ParametrosGrade {
  dia: string;
  primeiraHora: string;
  ultimaHora: string;
  intervaloMin: number;
  duracaoMin: number;
  capacidade: number;
  precoCentavos: number;
}

// Cria as baterias do dia (uma a cada `intervaloMin`). Horários que já
// existem são mantidos como estão. Devolve quantas foram criadas.
export async function gerarGrade(
  p: ParametrosGrade,
  ator: Ator,
): Promise<number> {
  if (!ehDiaValido(p.dia)) throw new ErroNegocio("Dia inválido.");
  if (!ehHoraValida(p.primeiraHora) || !ehHoraValida(p.ultimaHora)) {
    throw new ErroNegocio("Horário inválido (use HH:MM).");
  }
  if (p.ultimaHora < p.primeiraHora) {
    throw new ErroNegocio("A última bateria não pode ser antes da primeira.");
  }
  if (
    !Number.isInteger(p.intervaloMin) ||
    p.intervaloMin < 5 ||
    p.intervaloMin > 240
  ) {
    throw new ErroNegocio("Intervalo entre baterias: de 5 a 240 minutos.");
  }
  if (
    !Number.isInteger(p.duracaoMin) ||
    p.duracaoMin < 1 ||
    p.duracaoMin > 120
  ) {
    throw new ErroNegocio("Duração da bateria: de 1 a 120 minutos.");
  }
  if (
    !Number.isInteger(p.capacidade) ||
    p.capacidade < 1 ||
    p.capacidade > 60
  ) {
    throw new ErroNegocio("Quantidade de karts: de 1 a 60.");
  }
  if (!Number.isInteger(p.precoCentavos) || p.precoCentavos < 0) {
    throw new ErroNegocio("Preço inválido.");
  }

  const primeira = instanteLocal(p.dia, p.primeiraHora).getTime();
  const ultima = instanteLocal(p.dia, p.ultimaHora).getTime();
  const horarios: Date[] = [];
  for (let t = primeira; t <= ultima; t += p.intervaloMin * 60_000) {
    horarios.push(new Date(t));
  }
  if (horarios.length > 60) {
    throw new ErroNegocio("Muitas baterias de uma vez (máximo 60 por dia).");
  }

  return transacao(async (cliente) => {
    let criadas = 0;
    for (const inicio of horarios) {
      const r = await cliente.query(
        `insert into bateria_slot (id, inicio, duracao_min, capacidade, preco_centavos)
         values ($1, $2, $3, $4, $5) on conflict (inicio) do nothing`,
        [
          `bat-${randomUUID()}`,
          inicio,
          p.duracaoMin,
          p.capacidade,
          p.precoCentavos,
        ],
      );
      criadas += r.rowCount ?? 0;
    }
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "agenda.gerar_grade",
        entidade: "bateria_slot",
        entidadeId: p.dia,
        depois: { ...p, criadas },
      },
      cliente,
    );
    return criadas;
  });
}

interface LinhaSlot {
  id: string;
  inicio: Date;
  duracao_min: number;
  capacidade: number;
  preco_centavos: number;
  cancelada_em: Date | null;
  ocupadas: number;
}

const SLOTS_SQL = `
  select s.id, s.inicio, s.duracao_min, s.capacidade, s.preco_centavos,
         s.cancelada_em,
         coalesce((select sum(r.pilotos) from reserva r
                    where r.slot_id = s.id and r.status = 'reservada'), 0)::int
           as ocupadas
    from bateria_slot s
   where s.inicio >= $1 and s.inicio < $2
   order by s.inicio`;

function slotDeLinha(l: LinhaSlot, reservas: ReservaDoSlot[]): SlotDoDia {
  return {
    id: l.id,
    inicio: l.inicio,
    duracaoMin: l.duracao_min,
    capacidade: l.capacidade,
    precoCentavos: l.preco_centavos,
    cancelada: l.cancelada_em !== null,
    ocupadas: l.ocupadas,
    reservas,
  };
}

// Agenda completa do dia, com as reservas (uso do balcão).
export async function lerAgendaDoDia(dia: string): Promise<SlotDoDia[]> {
  if (!ehDiaValido(dia)) return [];
  const { inicio, fim } = limitesDoDia(dia);
  const slots = await consultar<LinhaSlot>(SLOTS_SQL, [inicio, fim]);
  if (slots.length === 0) return [];

  const reservas = await consultar<{
    id: string;
    slot_id: string;
    cliente_id: string;
    cliente_nome: string;
    telefone: string;
    pilotos: number;
    valor_centavos: number;
    pago: number;
    status: "reservada" | "cancelada";
  }>(
    `select r.id, r.slot_id, r.cliente_id, c.nome as cliente_nome, c.telefone,
            r.pilotos, r.valor_centavos, ${PAGO_SQL} as pago, r.status
       from reserva r join cliente c on c.id = r.cliente_id
      where r.slot_id = any($1)
      order by r.criado_em`,
    [slots.map((s) => s.id)],
  );

  return slots.map((s) =>
    slotDeLinha(
      s,
      reservas
        .filter((r) => r.slot_id === s.id)
        .map((r) => ({
          id: r.id,
          clienteId: r.cliente_id,
          clienteNome: r.cliente_nome,
          telefone: r.telefone,
          pilotos: r.pilotos,
          valorCentavos: r.valor_centavos,
          pagoCentavos: r.pago,
          status: r.status,
        })),
    ),
  );
}

// Versão pública: só horário, preço e vagas — nenhum dado de cliente.
export interface HorarioPublico {
  inicio: Date;
  duracaoMin: number;
  precoCentavos: number;
  vagas: number;
}

export async function lerHorariosPublicos(
  dia: string,
): Promise<HorarioPublico[]> {
  if (!ehDiaValido(dia)) return [];
  const { inicio, fim } = limitesDoDia(dia);
  const slots = await consultar<LinhaSlot>(SLOTS_SQL, [inicio, fim]);
  const agora = Date.now();
  return slots
    .filter((s) => s.cancelada_em === null)
    .filter((s) => s.inicio.getTime() + s.duracao_min * 60_000 > agora)
    .map((s) => ({
      inicio: s.inicio,
      duracaoMin: s.duracao_min,
      precoCentavos: s.preco_centavos,
      vagas: Math.max(0, s.capacidade - s.ocupadas),
    }));
}

export interface ReservaCompleta extends ReservaDoSlot {
  slotId: string;
  inicio: Date;
  descontoCentavos: number;
}

export async function lerReserva(id: string): Promise<ReservaCompleta | null> {
  const linhas = await consultar<{
    id: string;
    slot_id: string;
    inicio: Date;
    cliente_id: string;
    cliente_nome: string;
    telefone: string;
    pilotos: number;
    desconto_centavos: number;
    valor_centavos: number;
    pago: number;
    status: "reservada" | "cancelada";
  }>(
    `select r.id, r.slot_id, s.inicio, r.cliente_id, c.nome as cliente_nome,
            c.telefone, r.pilotos, r.desconto_centavos, r.valor_centavos,
            ${PAGO_SQL} as pago, r.status
       from reserva r
       join cliente c on c.id = r.cliente_id
       join bateria_slot s on s.id = r.slot_id
      where r.id = $1`,
    [id],
  );
  const l = linhas[0];
  if (!l) return null;
  return {
    id: l.id,
    slotId: l.slot_id,
    inicio: l.inicio,
    clienteId: l.cliente_id,
    clienteNome: l.cliente_nome,
    telefone: l.telefone,
    pilotos: l.pilotos,
    descontoCentavos: l.desconto_centavos,
    valorCentavos: l.valor_centavos,
    pagoCentavos: l.pago,
    status: l.status,
  };
}

// Padrões para agendar sem montar grade: usa os da última bateria criada.
export async function padroesDeAgenda(): Promise<{
  duracaoMin: number;
  capacidade: number;
  precoCentavos: number | null;
}> {
  const [l] = await consultar<{
    duracao_min: number;
    capacidade: number;
    preco_centavos: number;
  }>(
    `select duracao_min, capacidade, preco_centavos from bateria_slot
      order by criado_em desc limit 1`,
  );
  return {
    duracaoMin: l?.duracao_min ?? 15,
    capacidade: l?.capacidade ?? 12,
    precoCentavos: l?.preco_centavos ?? null,
  };
}

// Agenda uma bateria num passo só: acha (ou cria) o horário e faz a reserva,
// com o responsável como primeiro piloto. Dispensa "gerar baterias do dia".
export async function agendarBateria(
  dados: {
    dia: string;
    hora: string;
    clienteId: string;
    pilotos: number;
    precoCentavos?: number;
    descontoCentavos?: number;
  },
  ator: Ator,
): Promise<{ slotId: string; reservaId: string }> {
  if (!ehDiaValido(dados.dia)) throw new ErroNegocio("Escolha o dia.");
  if (!ehHoraValida(dados.hora)) {
    throw new ErroNegocio("Escolha a hora (HH:MM).");
  }
  const inicio = instanteLocal(dados.dia, dados.hora);
  const padroes = await padroesDeAgenda();
  if (inicio.getTime() + padroes.duracaoMin * 60_000 < Date.now()) {
    throw new ErroNegocio(
      "Esse horário já passou. Escolha uma data e hora futuras.",
    );
  }

  const existente = await consultar<{ id: string; cancelada_em: Date | null }>(
    "select id, cancelada_em from bateria_slot where inicio = $1",
    [inicio],
  );
  let slotId = existente[0]?.id;
  if (existente[0]?.cancelada_em) {
    throw new ErroNegocio("Esse horário foi cancelado. Escolha outro.");
  }
  if (!slotId) {
    const preco = dados.precoCentavos ?? padroes.precoCentavos;
    if (preco === null || preco === undefined) {
      throw new ErroNegocio("Informe o preço por piloto.");
    }
    if (!Number.isInteger(preco) || preco < 0) {
      throw new ErroNegocio("Preço inválido.");
    }
    slotId = `bat-${randomUUID()}`;
    await consultar(
      `insert into bateria_slot (id, inicio, duracao_min, capacidade, preco_centavos)
       values ($1, $2, $3, $4, $5) on conflict (inicio) do nothing`,
      [slotId, inicio, padroes.duracaoMin, padroes.capacidade, preco],
    );
    const [criado] = await consultar<{ id: string }>(
      "select id from bateria_slot where inicio = $1",
      [inicio],
    );
    slotId = criado.id;
    await registrarAuditoria({
      usuarioId: ator.usuarioId,
      ip: ator.ip,
      acao: "agenda.horario_criar",
      entidade: "bateria_slot",
      entidadeId: slotId,
      depois: { inicio, ...padroes, precoCentavos: preco },
    });
  }
  // Se a reserva falhar (lotação, cliente, etc.), o horário que acabou de ser
  // criado para ela não fica sobrando na agenda.
  let reservaId: string;
  try {
    reservaId = await criarReserva(
      {
        slotId,
        clienteId: dados.clienteId,
        pilotos: dados.pilotos,
        descontoCentavos: dados.descontoCentavos,
      },
      ator,
    );
  } catch (erro) {
    if (!existente[0]) {
      await consultar(
        `delete from bateria_slot where id = $1
            and not exists (select 1 from reserva where slot_id = $1)`,
        [slotId],
      ).catch(() => undefined);
    }
    throw erro;
  }
  return { slotId, reservaId };
}

export async function criarReserva(
  dados: {
    slotId: string;
    clienteId: string;
    pilotos: number;
    descontoCentavos?: number;
    // Quem fez a reserva também pilota? (padrão: sim; entra como 1º piloto.)
    responsavelPilota?: boolean;
  },
  ator: Ator,
): Promise<string> {
  const desconto = dados.descontoCentavos ?? 0;
  if (!Number.isInteger(dados.pilotos) || dados.pilotos < 1) {
    throw new ErroNegocio("Informe quantos pilotos vão correr.");
  }
  if (!Number.isInteger(desconto) || desconto < 0) {
    throw new ErroNegocio("Desconto inválido.");
  }

  return transacao(async (cliente) => {
    // Trava a bateria: duas reservas simultâneas não passam da capacidade.
    const slots = await cliente.query<{
      id: string;
      capacidade: number;
      preco_centavos: number;
      cancelada_em: Date | null;
      encerrada: boolean;
    }>(
      `select id, capacidade, preco_centavos, cancelada_em,
              (inicio + make_interval(mins => duracao_min)) < now() as encerrada
         from bateria_slot where id = $1 for update`,
      [dados.slotId],
    );
    const slot = slots.rows[0];
    if (!slot) throw new ErroNegocio("Bateria não encontrada.");
    if (slot.cancelada_em) throw new ErroNegocio("Esta bateria foi cancelada.");
    if (slot.encerrada) throw new ErroNegocio("Esta bateria já terminou.");

    const existe = await cliente.query("select 1 from cliente where id = $1", [
      dados.clienteId,
    ]);
    if (!existe.rowCount) throw new ErroNegocio("Cliente não encontrado.");

    const { rows } = await cliente.query<{ ocupadas: number }>(
      `select coalesce(sum(pilotos), 0)::int as ocupadas
         from reserva where slot_id = $1 and status = 'reservada'`,
      [dados.slotId],
    );
    const vagas = slot.capacidade - rows[0].ocupadas;
    if (dados.pilotos > vagas) {
      throw new ErroNegocio(
        vagas <= 0
          ? "Esta bateria está lotada."
          : `Só ${vagas === 1 ? "resta 1 vaga" : `restam ${vagas} vagas`} nesta bateria.`,
      );
    }

    const bruto = slot.preco_centavos * dados.pilotos;
    if (desconto > bruto) {
      throw new ErroNegocio("O desconto não pode ser maior que o valor total.");
    }
    const id = `res-${randomUUID()}`;
    await cliente.query(
      `insert into reserva (id, slot_id, cliente_id, pilotos, desconto_centavos, valor_centavos, criada_por)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        dados.slotId,
        dados.clienteId,
        dados.pilotos,
        desconto,
        bruto - desconto,
        ator.usuarioId,
      ],
    );
    if (dados.responsavelPilota !== false) {
      await cliente.query(
        `insert into reserva_piloto (id, reserva_id, cliente_id, ordem, criado_por)
         values ($1, $2, $3, 1, $4)`,
        [`rpil-${randomUUID()}`, id, dados.clienteId, ator.usuarioId],
      );
    }
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "reserva.criar",
        entidade: "reserva",
        entidadeId: id,
        depois: {
          slotId: dados.slotId,
          clienteId: dados.clienteId,
          pilotos: dados.pilotos,
          descontoCentavos: desconto,
          valorCentavos: bruto - desconto,
        },
      },
      cliente,
    );
    return id;
  });
}

export async function cancelarReserva(
  id: string,
  motivo: string,
  ator: Ator,
): Promise<void> {
  const texto = motivo.trim();
  if (texto.length < 3)
    throw new ErroNegocio("Informe o motivo do cancelamento.");

  await transacao(async (cliente) => {
    const { rows } = await cliente.query<{ status: string }>(
      "select status from reserva where id = $1 for update",
      [id],
    );
    if (!rows[0]) throw new ErroNegocio("Reserva não encontrada.");
    if (rows[0].status === "cancelada") {
      throw new ErroNegocio("Esta reserva já está cancelada.");
    }
    const pago = await cliente.query<{ pago: number }>(
      `select coalesce(sum(case when tipo = 'pagamento' then valor_centavos
                                else -valor_centavos end), 0)::int as pago
         from caixa_movimento where reserva_id = $1`,
      [id],
    );
    if (pago.rows[0].pago > 0) {
      throw new ErroNegocio(
        "Há pagamento nesta reserva. Estorne o valor antes de cancelar.",
      );
    }
    await cliente.query(
      `update reserva set status = 'cancelada', cancelada_em = now(),
              cancelada_por = $2, motivo_cancelamento = $3 where id = $1`,
      [id, ator.usuarioId, texto],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "reserva.cancelar",
        entidade: "reserva",
        entidadeId: id,
        motivo: texto,
      },
      cliente,
    );
  });
}

// Cancela a bateria inteira (só se não houver reserva ativa).
export async function cancelarBateria(
  slotId: string,
  ator: Ator,
): Promise<void> {
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<{ cancelada_em: Date | null }>(
      "select cancelada_em from bateria_slot where id = $1 for update",
      [slotId],
    );
    if (!rows[0]) throw new ErroNegocio("Bateria não encontrada.");
    if (rows[0].cancelada_em) throw new ErroNegocio("Bateria já cancelada.");
    const ativas = await cliente.query(
      "select 1 from reserva where slot_id = $1 and status = 'reservada' limit 1",
      [slotId],
    );
    if (ativas.rowCount) {
      throw new ErroNegocio(
        "Cancele (ou remaneje) as reservas desta bateria primeiro.",
      );
    }
    await cliente.query(
      "update bateria_slot set cancelada_em = now() where id = $1",
      [slotId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "agenda.cancelar_bateria",
        entidade: "bateria_slot",
        entidadeId: slotId,
      },
      cliente,
    );
  });
}

export async function lerSlot(id: string): Promise<SlotDoDia | null> {
  const slots = await consultar<LinhaSlot>(
    `select s.id, s.inicio, s.duracao_min, s.capacidade, s.preco_centavos,
            s.cancelada_em,
            coalesce((select sum(r.pilotos) from reserva r
                       where r.slot_id = s.id and r.status = 'reservada'), 0)::int
              as ocupadas
       from bateria_slot s where s.id = $1`,
    [id],
  );
  return slots[0] ? slotDeLinha(slots[0], []) : null;
}
