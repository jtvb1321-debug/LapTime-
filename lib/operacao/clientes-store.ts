import { randomUUID } from "node:crypto";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";
import { ehDiaValido, hojeEmSaoPaulo } from "@/lib/operacao/tempo";

export interface Cliente {
  id: string;
  // Número de cadastro (sequencial, o mesmo em todas as telas).
  numero: number;
  nome: string;
  telefone: string;
  email?: string;
  documento?: string;
  // AAAA-MM-DD
  nascimento?: string;
}

interface LinhaCliente {
  id: string;
  numero: number;
  nome: string;
  telefone: string;
  email: string | null;
  documento: string | null;
  nascimento: string | null;
}

function clienteDeLinha(l: LinhaCliente): Cliente {
  return {
    id: l.id,
    numero: l.numero,
    nome: l.nome,
    telefone: l.telefone,
    email: l.email ?? undefined,
    documento: l.documento ?? undefined,
    nascimento: l.nascimento ?? undefined,
  };
}

const COLUNAS = `id, numero, nome, telefone, email, documento,
  to_char(nascimento, 'YYYY-MM-DD') as nascimento`;

function validarNascimento(valor: string | undefined): string | null {
  const nascimento = valor?.trim();
  if (!nascimento) return null;
  if (
    !ehDiaValido(nascimento) ||
    nascimento > hojeEmSaoPaulo() ||
    nascimento < "1900-01-01"
  ) {
    throw new ErroNegocio("Data de nascimento inválida.");
  }
  return nascimento;
}

function validarEmail(valor: string | undefined): string | null {
  const email = valor?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErroNegocio("E-mail inválido.");
  }
  return email;
}

// Texto de cadastro sem caracteres de controle (o byte nulo derruba o banco).
function limpo(valor: string | undefined): string {
  return (valor ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function validarTamanhos(
  nome: string,
  email: string | null,
  documento: string | null,
) {
  if (nome.length > 120) {
    throw new ErroNegocio("O nome pode ter no máximo 120 caracteres.");
  }
  if (email && email.length > 120) {
    throw new ErroNegocio("O e-mail pode ter no máximo 120 caracteres.");
  }
  if (documento && documento.length > 30) {
    throw new ErroNegocio("O documento pode ter no máximo 30 caracteres.");
  }
}

export async function criarCliente(
  dados: {
    nome: string;
    telefone: string;
    email?: string;
    documento?: string;
    nascimento?: string;
  },
  ator: Ator,
): Promise<Cliente> {
  const nome = limpo(dados.nome);
  const telefone = limpo(dados.telefone);
  const digitos = telefone.replace(/\D/g, "");
  if (nome.length < 2) throw new ErroNegocio("Informe o nome do cliente.");
  if (digitos.length < 10 || digitos.length > 13) {
    throw new ErroNegocio("Informe o telefone com DDD.");
  }
  const email = validarEmail(limpo(dados.email) || undefined);
  const documento = limpo(dados.documento) || null;
  validarTamanhos(nome, email, documento);
  const nascimento = validarNascimento(dados.nascimento);

  return transacao(async (cliente) => {
    const id = `cli-${randomUUID()}`;
    const { rows } = await cliente.query<LinhaCliente>(
      `insert into cliente (id, nome, telefone, telefone_digitos, email, documento, nascimento)
       values ($1, $2, $3, $4, $5, $6, $7) returning ${COLUNAS}`,
      [id, nome, telefone, digitos, email, documento, nascimento],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "cliente.criar",
        entidade: "cliente",
        entidadeId: id,
        depois: { nome, telefone },
      },
      cliente,
    );
    return clienteDeLinha(rows[0]);
  });
}

export async function atualizarCliente(
  id: string,
  dados: {
    telefone: string;
    email?: string;
    documento?: string;
    nascimento?: string;
  },
  ator: Ator,
): Promise<void> {
  const telefone = dados.telefone.trim();
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 13) {
    throw new ErroNegocio("Informe o telefone com DDD.");
  }
  const email = validarEmail(limpo(dados.email) || undefined);
  const documento = limpo(dados.documento) || null;
  validarTamanhos("", email, documento);
  const nascimento = validarNascimento(dados.nascimento);

  await transacao(async (cliente) => {
    const antes = await cliente.query<LinhaCliente>(
      `select ${COLUNAS} from cliente where id = $1 for update`,
      [id],
    );
    if (!antes.rows[0]) throw new ErroNegocio("Cliente não encontrado.");
    await cliente.query(
      `update cliente set telefone = $2, telefone_digitos = $3, email = $4,
              documento = $5, nascimento = $6 where id = $1`,
      [id, telefone, digitos, email, documento, nascimento],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "cliente.atualizar",
        entidade: "cliente",
        entidadeId: id,
        antes: clienteDeLinha(antes.rows[0]),
        depois: { telefone, email, documento, nascimento },
      },
      cliente,
    );
  });
}

// Cliente de um piloto: o que já tem cadastro (clienteId) ou um cadastro novo
// (nome e telefone). Mesmo nome e telefone de um cadastro existente reaproveitam
// aquele cadastro, sem número novo.
export async function obterOuCriarCliente(
  dados: {
    clienteId?: string;
    nome?: string;
    telefone?: string;
    nascimento?: string;
    documento?: string;
  },
  ator: Ator,
): Promise<{ id: string; numero: number; nome: string }> {
  if (dados.clienteId) {
    const achado = await consultar<{
      id: string;
      numero: number;
      nome: string;
    }>("select id, numero, nome from cliente where id = $1", [dados.clienteId]);
    if (!achado[0]) throw new ErroNegocio("Cliente não encontrado.");
    return achado[0];
  }
  const nome = (dados.nome ?? "").trim();
  const digitos = (dados.telefone ?? "").replace(/\D/g, "");
  const igual = digitos
    ? await consultar<{ id: string; numero: number; nome: string }>(
        `select id, numero, nome from cliente
          where telefone_digitos = $1 and lower(nome) = lower($2) limit 1`,
        [digitos, nome],
      )
    : [];
  if (igual[0]) return igual[0];
  const novo = await criarCliente(
    {
      nome,
      telefone: dados.telefone ?? "",
      nascimento: dados.nascimento,
      documento: dados.documento,
    },
    ator,
  );
  return { id: novo.id, numero: novo.numero, nome: novo.nome };
}

// Busca por número de cadastro, parte do nome ou do telefone (só dígitos).
export async function buscarClientes(
  termo: string,
  limite = 20,
): Promise<Cliente[]> {
  const texto = limpo(termo).slice(0, 80);
  if (!texto) return [];
  const digitos = texto.replace(/\D/g, "");
  const linhas = await consultar<LinhaCliente>(
    `select ${COLUNAS} from cliente
      where lower(nome) like '%' || lower($1) || '%'
         or ($2 <> '' and telefone_digitos like '%' || $2 || '%')
         or ($4::int is not null and numero = $4::int)
      order by (numero = $4::int) desc nulls last, nome limit $3`,
    [texto, digitos, limite, /^\d{1,9}$/.test(texto) ? Number(texto) : null],
  );
  return linhas.map(clienteDeLinha);
}

export async function lerClientePorNumero(
  numero: number,
): Promise<Cliente | null> {
  const linhas = await consultar<LinhaCliente>(
    `select ${COLUNAS} from cliente where numero = $1`,
    [numero],
  );
  return linhas[0] ? clienteDeLinha(linhas[0]) : null;
}

export async function lerCliente(id: string): Promise<Cliente | null> {
  const linhas = await consultar<LinhaCliente>(
    `select ${COLUNAS} from cliente where id = $1`,
    [id],
  );
  return linhas[0] ? clienteDeLinha(linhas[0]) : null;
}

export async function clientesRecentes(limite = 30): Promise<Cliente[]> {
  const linhas = await consultar<LinhaCliente>(
    `select ${COLUNAS} from cliente order by criado_em desc limit $1`,
    [limite],
  );
  return linhas.map(clienteDeLinha);
}

// ---- histórico e relacionamento ----

export interface ClienteResumo extends Cliente {
  // Reservas ativas cuja bateria já aconteceu.
  visitas: number;
  ultimaVisita: Date | null;
  // Pago líquido (pagamentos − estornos) em todas as reservas.
  gastoCentavos: number;
}

interface LinhaResumo extends LinhaCliente {
  visitas: number;
  ultima_visita: Date | null;
  gasto: number;
}

const RESUMO_SQL = `
  select c.id, c.numero, c.nome, c.telefone, c.email, c.documento,
         to_char(c.nascimento, 'YYYY-MM-DD') as nascimento,
         (select count(*) from reserva r join bateria_slot s on s.id = r.slot_id
           where r.cliente_id = c.id and r.status = 'reservada'
             and s.inicio < now())::int as visitas,
         (select max(s.inicio) from reserva r join bateria_slot s on s.id = r.slot_id
           where r.cliente_id = c.id and r.status = 'reservada'
             and s.inicio < now()) as ultima_visita,
         coalesce((select sum(case when m.tipo = 'pagamento'
                                   then m.valor_centavos else -m.valor_centavos end)
                     from caixa_movimento m join reserva r on r.id = m.reserva_id
                    where r.cliente_id = c.id), 0)::int as gasto
    from cliente c`;

function resumoDeLinha(l: LinhaResumo): ClienteResumo {
  return {
    ...clienteDeLinha(l),
    visitas: l.visitas,
    ultimaVisita: l.ultima_visita,
    gastoCentavos: l.gasto,
  };
}

export async function listarClientesComResumo(
  termo: string,
  limite = 50,
): Promise<ClienteResumo[]> {
  const texto = limpo(termo).slice(0, 80);
  const linhas = texto
    ? await consultar<LinhaResumo>(
        `${RESUMO_SQL}
          where lower(c.nome) like '%' || lower($1) || '%'
             or ($2 <> '' and c.telefone_digitos like '%' || $2 || '%')
          order by c.nome limit $3`,
        [texto, texto.replace(/\D/g, ""), limite],
      )
    : await consultar<LinhaResumo>(
        `${RESUMO_SQL} order by c.criado_em desc limit $1`,
        [limite],
      );
  return linhas.map(resumoDeLinha);
}

export async function lerClienteComResumo(
  id: string,
): Promise<ClienteResumo | null> {
  const linhas = await consultar<LinhaResumo>(`${RESUMO_SQL} where c.id = $1`, [
    id,
  ]);
  return linhas[0] ? resumoDeLinha(linhas[0]) : null;
}

export interface VisitaDoCliente {
  reservaId: string;
  inicio: Date;
  pilotos: number;
  valorCentavos: number;
  pagoCentavos: number;
  status: "reservada" | "cancelada";
}

export async function lerVisitasDoCliente(
  clienteId: string,
): Promise<VisitaDoCliente[]> {
  const linhas = await consultar<{
    id: string;
    inicio: Date;
    pilotos: number;
    valor_centavos: number;
    pago: number;
    status: "reservada" | "cancelada";
  }>(
    `select r.id, s.inicio, r.pilotos, r.valor_centavos, r.status,
            coalesce((select sum(case when m.tipo = 'pagamento'
                                      then m.valor_centavos else -m.valor_centavos end)
                        from caixa_movimento m where m.reserva_id = r.id), 0)::int as pago
       from reserva r join bateria_slot s on s.id = r.slot_id
      where r.cliente_id = $1
      order by s.inicio desc`,
    [clienteId],
  );
  return linhas.map((l) => ({
    reservaId: l.id,
    inicio: l.inicio,
    pilotos: l.pilotos,
    valorCentavos: l.valor_centavos,
    pagoCentavos: l.pago,
    status: l.status,
  }));
}

// Clientes que fazem aniversário no mês (1–12), pelo dia do mês.
export async function aniversariantesDoMes(
  mes: number,
): Promise<ClienteResumo[]> {
  const linhas = await consultar<LinhaResumo>(
    `${RESUMO_SQL}
      where c.nascimento is not null and extract(month from c.nascimento) = $1
      order by extract(day from c.nascimento), c.nome`,
    [mes],
  );
  return linhas.map(resumoDeLinha);
}

// Quem já correu pelo menos uma vez e não volta há `dias` dias ou mais.
export async function clientesSumidos(dias: number): Promise<ClienteResumo[]> {
  const linhas = await consultar<LinhaResumo>(
    `select * from (${RESUMO_SQL}) x
      where x.visitas > 0 and x.ultima_visita < now() - make_interval(days => $1)
      order by x.ultima_visita limit 200`,
    [dias],
  );
  return linhas.map(resumoDeLinha);
}
