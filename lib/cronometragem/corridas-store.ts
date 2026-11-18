import { randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { lerModeloDeVinculo } from "@/lib/cronometragem/cadastros-store";
import {
  correcaoDsqAtiva,
  lerCorrecaoDsqDesde,
  ordenarGridVigente,
} from "@/lib/cronometragem/grid-vigente";
import {
  avaliarCorrida,
  type ConfigMotor,
  type LinhaClassificacao,
  type ModoEncerramento,
  type PassagemAvaliada,
  type PassagemMotor,
  type RegraLargada,
  type ResultadoMotor,
} from "@/lib/cronometragem/motor";
import { criarCliente } from "@/lib/operacao/clientes-store";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";
import { pagamentosDasReservas } from "@/lib/operacao/reserva-pilotos-store";
import type { PagamentoDoPiloto } from "@/lib/operacao/pagamento-pilotos";
import {
  VALIDADE_ACEITE_DIAS,
  clientesComTermoValido,
} from "@/lib/operacao/termo-store";
import { formatarHora } from "@/lib/operacao/tempo";

// Máquina de estados da corrida:
//   preparada → pronta → em_andamento → encerrando → finalizada
//   (cancelada a partir de qualquer estado antes de finalizada)
// "encerrando" = o tempo acabou (ou o operador deu a bandeira) e a corrida
// ainda espera as últimas passagens, conforme `modo_encerramento`.
export type EstadoCorrida =
  | "preparada"
  | "pronta"
  | "em_andamento"
  | "encerrando"
  | "finalizada"
  | "cancelada";

export const ESTADOS_ATIVOS: EstadoCorrida[] = ["em_andamento", "encerrando"];
const ESTADOS_EDITAVEIS: EstadoCorrida[] = [
  "preparada",
  "pronta",
  "em_andamento",
  "encerrando",
];

// Uma bateria do kartódromo pode ter duas fases, cada uma cronometrada à parte:
// a classificação (define o grid, pela melhor volta) e a corrida.
export type FaseCorrida = "unica" | "classificacao" | "corrida";

export const TEMPO_MINIMO_PADRAO_MS = 10_000;
export const DURACAO_PADRAO_MIN = 12;
// A CONFIRMAR com a pista (como as demais regras padrão).
export const DURACAO_CLASSIFICACAO_PADRAO_MIN = 5;
export const ESPERA_FINAL_PADRAO_S = 120;
const JANELA_PRE_LARGADA_MS = 15 * 60_000;
const JANELA_POS_FIM_MS = 2 * 60_000;

export interface Corrida {
  id: string;
  nome: string;
  slotId?: string;
  estado: EstadoCorrida;
  tempoMinimoMs: number;
  duracaoMin?: number;
  regraLargada: RegraLargada;
  modoEncerramento: ModoEncerramento;
  esperaFinalS: number;
  criadoEm: Date;
  iniciadaEm: Date | null;
  encerrandoEm: Date | null;
  encerradaEm: Date | null;
  canceladaEm: Date | null;
  motivoCancelamento?: string;
  resultadoFinal: ResultadoPublicado | null;
  // Quem fez a reserva/responde pela bateria (cadastro de cliente).
  responsavelClienteId?: string;
  fase: FaseCorrida;
  // Na corrida: a classificação que definiu o grid.
  classificacaoId?: string;
  // Na classificação: tempo planejado da corrida (min), criada ao final dela.
  duracaoCorridaMin?: number;
}

export interface ResultadoPublicado {
  geradoEm: string;
  classificacao: LinhaClassificacao[];
}

export interface CorridaResumo extends Corrida {
  pilotos: number;
  comSensor: number;
}

export interface PilotoDaCorrida {
  id: string;
  nome: string;
  clienteId?: string;
  transponder?: string;
  rotulo?: string;
  transponderStatus?: string;
  transponderCadastrado?: boolean;
  kartId?: string;
  kartNumero?: string;
  capturaArmada: boolean;
  // Outros sensores do mesmo kart lidos nesta bateria (ex.: sensor trocado).
  sensoresExtras: string[];
  // false = kart que entrou sozinho na bateria e ainda não recebeu o nome do piloto.
  nomeado: boolean;
  // Número de cadastro do cliente (piloto cadastrado na bateria).
  clienteNumero?: number;
  // Vaga da reserva ainda sem piloto cadastrado.
  vaga: boolean;
  // Termo de responsabilidade: assinado e válido, pendente, ou sem cadastro.
  termo: "valido" | "pendente" | "sem_cadastro";
  // Piloto da reserva (para lançar pagamento) e como está o pagamento dele.
  reservaId?: string;
  reservaPilotoId?: string;
  pagamento?: PagamentoDoPiloto;
  // Pode ir ao kart: termo assinado e kart definido.
  apto: boolean;
  // Posição de largada da corrida (vem da classificação).
  posicaoGrid?: number;
  // Check-in: quando o piloto confirmou presença na recepção.
  presenteEm?: Date;
  // Ocorrências decididas pelo operador (com motivo, auditadas).
  situacaoManual?: "dns" | "dnf" | "dsq";
  penalidadeMs: number;
  ocorrenciaMotivo?: string;
}

export interface SensorDetectado {
  transponder: string;
  rotulo?: string;
  cadastrado: boolean;
  status: string;
  leituras: number;
  ultimaMs: number;
}

export interface PassagemDoHistorico {
  id: string;
  instanteMs: number;
  transponder: string;
  participante?: string;
  kartNumero?: string;
  status: PassagemAvaliada["status"];
  motivo: string;
  contada: boolean;
  numeroVolta?: number;
  tempoVoltaMs?: number;
  decoderNome?: string;
  simulado: boolean;
  origem: "decoder" | "manual";
}

export interface CorrecaoDaCorrida {
  id: string;
  tipo: "invalidar" | "inserir";
  passagemId?: string;
  transponder?: string;
  instanteMs?: number;
  motivo: string;
  criadoPor?: string;
  criadoEm: Date;
  anulada: boolean;
  motivoAnulacao?: string;
}

export interface Alerta {
  nivel: "aviso" | "erro";
  texto: string;
}

export interface ResponsavelDaBateria {
  id: string;
  numero: number;
  nome: string;
  telefone: string;
}

export interface FaseVinculada {
  id: string;
  estado: EstadoCorrida;
}

export interface PainelDaCorrida {
  corrida: Corrida;
  // As duas fases da mesma bateria (classificação e corrida), quando houver.
  fases?: { classificacao?: FaseVinculada; corrida?: FaseVinculada };
  responsavel?: ResponsavelDaBateria;
  grid: PilotoDaCorrida[];
  classificacao: LinhaClassificacao[];
  historico: PassagemDoHistorico[];
  detectados: SensorDetectado[];
  correcoes: CorrecaoDaCorrida[];
  alertas: Alerta[];
  // Relógio do SERVIDOR (o navegador só mostra; não é a referência).
  agoraMs: number;
  prazoMs: number | null;
  totalPassagens: number;
  // true = o resultado publicado no encerramento difere do atual (houve
  // correção administrativa depois).
  corrigidaAposPublicar: boolean;
}

interface LinhaCorrida {
  id: string;
  nome: string;
  slot_id: string | null;
  estado: EstadoCorrida;
  tempo_minimo_ms: number;
  duracao_min: number | null;
  regra_largada: RegraLargada;
  modo_encerramento: ModoEncerramento;
  espera_final_s: number;
  criado_em: Date;
  iniciada_em: Date | null;
  encerrando_em: Date | null;
  encerrada_em: Date | null;
  cancelada_em: Date | null;
  motivo_cancelamento: string | null;
  resultado_final: ResultadoPublicado | null;
  responsavel_cliente_id: string | null;
  fase: FaseCorrida;
  classificacao_id: string | null;
  duracao_corrida_min: number | null;
}

const COLUNAS_CORRIDA = `c.id, c.nome, c.slot_id, c.estado, c.tempo_minimo_ms,
  c.duracao_min, c.regra_largada, c.modo_encerramento, c.espera_final_s,
  c.criado_em, c.iniciada_em, c.encerrando_em, c.encerrada_em, c.cancelada_em,
  c.motivo_cancelamento, c.resultado_final, c.responsavel_cliente_id,
  c.fase, c.classificacao_id, c.duracao_corrida_min`;

function corridaDeLinha(l: LinhaCorrida): Corrida {
  return {
    id: l.id,
    nome: l.nome,
    slotId: l.slot_id ?? undefined,
    estado: l.estado,
    tempoMinimoMs: l.tempo_minimo_ms,
    duracaoMin: l.duracao_min ?? undefined,
    regraLargada: l.regra_largada,
    modoEncerramento: l.modo_encerramento,
    esperaFinalS: l.espera_final_s,
    criadoEm: l.criado_em,
    iniciadaEm: l.iniciada_em,
    encerrandoEm: l.encerrando_em,
    encerradaEm: l.encerrada_em,
    canceladaEm: l.cancelada_em,
    motivoCancelamento: l.motivo_cancelamento ?? undefined,
    resultadoFinal: l.resultado_final,
    responsavelClienteId: l.responsavel_cliente_id ?? undefined,
    fase: l.fase,
    classificacaoId: l.classificacao_id ?? undefined,
    duracaoCorridaMin: l.duracao_corrida_min ?? undefined,
  };
}

// Instante em que o tempo da corrida acaba (null se não há duração).
export function prazoDaCorrida(c: Corrida): Date | null {
  if (!c.iniciadaEm || !c.duracaoMin) return null;
  return new Date(c.iniciadaEm.getTime() + c.duracaoMin * 60_000);
}

function violou(erro: unknown, restricao: string): boolean {
  const e = erro as { code?: string; constraint?: string };
  return e?.code === "23505" && e.constraint === restricao;
}

const REGEX_SENSOR = /^[A-Za-z0-9_-]{1,32}$/;

type Consulta = <T>(texto: string, parametros?: unknown[]) => Promise<T[]>;

function consultaDe(cliente: PoolClient): Consulta {
  return async <T>(texto: string, parametros: unknown[] = []) => {
    const r = await cliente.query(texto, parametros as never[]);
    return r.rows as T[];
  };
}

const consultaDoPool: Consulta = async <T>(
  texto: string,
  parametros: unknown[] = [],
) => (await consultar(texto, parametros)) as unknown as T[];

async function corridaParaAlterar(
  cliente: PoolClient,
  id: string,
): Promise<Corrida> {
  const { rows } = await cliente.query<LinhaCorrida>(
    `select ${COLUNAS_CORRIDA} from corrida c where c.id = $1 for update`,
    [id],
  );
  if (!rows[0]) throw new ErroNegocio("Bateria não encontrada.");
  return corridaDeLinha(rows[0]);
}

// Piloto + estado da corrida, travados; recusa se a corrida não pode mais mudar.
async function pilotoParaAlterar(cliente: PoolClient, pilotoId: string) {
  const { rows } = await cliente.query<{
    id: string;
    nome: string;
    corrida_id: string;
    estado: EstadoCorrida;
    transponder: string | null;
    kart_id: string | null;
  }>(
    `select p.id, p.nome, p.corrida_id, p.transponder, p.kart_id, c.estado
       from corrida_piloto p join corrida c on c.id = p.corrida_id
      where p.id = $1 for update of p`,
    [pilotoId],
  );
  if (!rows[0]) throw new ErroNegocio("Piloto não encontrado.");
  if (!ESTADOS_EDITAVEIS.includes(rows[0].estado)) {
    throw new ErroNegocio("Esta bateria já foi encerrada.");
  }
  return rows[0];
}

// Mexer no grid depois de "pronta" exige confirmar a prontidão de novo.
async function reverterSePronta(cliente: PoolClient, corridaId: string) {
  await cliente.query(
    "update corrida set estado = 'preparada' where id = $1 and estado = 'pronta'",
    [corridaId],
  );
}

// ------------------------------------------------------------ Criação

export interface DadosCorrida {
  nome?: string;
  slotId?: string;
  tempoMinimoMs?: number;
  duracaoMin?: number;
  regraLargada?: RegraLargada;
  modoEncerramento?: ModoEncerramento;
  esperaFinalS?: number;
  // "classificacao": a bateria tem classificação e depois corrida (a corrida
  // é criada ao final da classificação). Padrão: corrida única.
  fase?: "unica" | "classificacao";
  // Só na classificação: tempo planejado da corrida (padrão 12 min).
  duracaoCorridaMin?: number;
}

// Cria a corrida. Com `slotId`, parte de uma bateria da agenda: cada piloto
// reservado entra no grid (a reserva de N pilotos vira N linhas).
export async function criarCorrida(
  dados: DadosCorrida,
  ator: Ator,
): Promise<string> {
  const tempoMinimoMs = dados.tempoMinimoMs ?? TEMPO_MINIMO_PADRAO_MS;
  if (
    !Number.isInteger(tempoMinimoMs) ||
    tempoMinimoMs < 1000 ||
    tempoMinimoMs > 600_000
  ) {
    throw new ErroNegocio("Tempo mínimo entre leituras: de 1 a 600 segundos.");
  }
  const fase = dados.fase ?? "unica";
  const duracaoMin =
    dados.duracaoMin ??
    (fase === "classificacao"
      ? DURACAO_CLASSIFICACAO_PADRAO_MIN
      : DURACAO_PADRAO_MIN);
  if (!Number.isInteger(duracaoMin) || duracaoMin < 1 || duracaoMin > 240) {
    throw new ErroNegocio("Duração da bateria: de 1 a 240 minutos.");
  }
  const regraLargada = dados.regraLargada ?? "primeira_passagem";
  if (!["primeira_passagem", "largada_da_corrida"].includes(regraLargada)) {
    throw new ErroNegocio("Regra de largada inválida.");
  }
  // A classificação termina sozinha no fim do tempo; a corrida segue a regra
  // configurada (padrão: o operador dá a bandeira).
  const modoEncerramento =
    dados.modoEncerramento ??
    (fase === "classificacao" ? "corte_imediato" : "manual");
  const duracaoCorridaMin =
    fase === "classificacao"
      ? (dados.duracaoCorridaMin ?? DURACAO_PADRAO_MIN)
      : null;
  if (
    duracaoCorridaMin !== null &&
    (!Number.isInteger(duracaoCorridaMin) ||
      duracaoCorridaMin < 1 ||
      duracaoCorridaMin > 240)
  ) {
    throw new ErroNegocio("Duração da corrida: de 1 a 240 minutos.");
  }
  if (
    !["manual", "proxima_passagem", "corte_imediato"].includes(modoEncerramento)
  ) {
    throw new ErroNegocio("Regra de encerramento inválida.");
  }
  const esperaFinalS = dados.esperaFinalS ?? ESPERA_FINAL_PADRAO_S;
  if (
    !Number.isInteger(esperaFinalS) ||
    esperaFinalS < 0 ||
    esperaFinalS > 3600
  ) {
    throw new ErroNegocio("Espera final: de 0 a 3600 segundos.");
  }
  const modelo = await lerModeloDeVinculo();
  const id = `corrida-${randomUUID()}`;

  try {
    await transacao(async (cliente) => {
      let nome = dados.nome?.trim() ?? "";
      const pilotos: {
        nome: string;
        clienteId: string | null;
        reservaId: string;
      }[] = [];
      let responsavelId: string | null = null;

      if (dados.slotId) {
        const { rows: slots } = await cliente.query<{
          inicio: Date;
          cancelada_em: Date | null;
        }>("select inicio, cancelada_em from bateria_slot where id = $1", [
          dados.slotId,
        ]);
        if (!slots[0]) throw new ErroNegocio("Bateria não encontrada.");
        if (slots[0].cancelada_em) {
          throw new ErroNegocio("Esta bateria foi cancelada.");
        }
        if (!nome) nome = `Bateria ${formatarHora(slots[0].inicio)}`;

        const { rows: reservas } = await cliente.query<{
          id: string;
          cliente_id: string;
          nome: string;
          pilotos: number;
        }>(
          `select r.id, r.cliente_id, c.nome, r.pilotos
             from reserva r join cliente c on c.id = r.cliente_id
            where r.slot_id = $1 and r.status = 'reservada'
            order by r.criado_em, r.id`,
          [dados.slotId],
        );
        responsavelId = reservas[0]?.cliente_id ?? null;
        // O cliente da reserva é o responsável e o 1º piloto; as demais vagas
        // ficam abertas para cadastrar cada piloto (com o termo dele).
        const { rows: lista } = await cliente.query<{
          reserva_id: string;
          cliente_id: string;
          nome: string;
        }>(
          `select rp.reserva_id, rp.cliente_id, c.nome
             from reserva_piloto rp
             join cliente c on c.id = rp.cliente_id
             join reserva r on r.id = rp.reserva_id
            where r.slot_id = $1 and r.status = 'reservada'
            order by rp.ordem, rp.criado_em`,
          [dados.slotId],
        );
        responsavelId = reservas[0]?.cliente_id ?? null;
        // Os pilotos já cadastrados na reserva entram na bateria; o que falta
        // vira vaga aberta, até cadastrar o piloto (cada um com seu termo).
        for (const r of reservas) {
          const doGrupo = lista
            .filter((l) => l.reserva_id === r.id)
            .slice(0, r.pilotos);
          for (const l of doGrupo) {
            pilotos.push({
              nome: l.nome,
              clienteId: l.cliente_id,
              reservaId: r.id,
            });
          }
          for (let i = doGrupo.length + 1; i <= r.pilotos; i++) {
            pilotos.push({
              nome: `Vaga ${i} de ${r.nome}`,
              clienteId: null,
              reservaId: r.id,
            });
          }
        }
      }
      if (nome.length < 2) throw new ErroNegocio("Dê um nome à bateria.");
      if (fase === "classificacao") nome = `${nome} — Classificação`;

      await cliente.query(
        `insert into corrida (id, nome, slot_id, tempo_minimo_ms, duracao_min,
                              regra_largada, modo_encerramento, espera_final_s, criada_por,
                              responsavel_cliente_id, fase, duracao_corrida_min)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          nome,
          dados.slotId ?? null,
          tempoMinimoMs,
          duracaoMin,
          regraLargada,
          modoEncerramento,
          esperaFinalS,
          ator.usuarioId,
          responsavelId,
          fase,
          duracaoCorridaMin,
        ],
      );
      for (const p of pilotos) {
        await cliente.query(
          `insert into corrida_piloto (id, corrida_id, nome, cliente_id, reserva_id, modelo_vinculo)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            `cpiloto-${randomUUID()}`,
            id,
            p.nome,
            p.clienteId,
            p.reservaId,
            modelo,
          ],
        );
      }
      await registrarAuditoria(
        {
          usuarioId: ator.usuarioId,
          ip: ator.ip,
          acao: "corrida.criar",
          entidade: "corrida",
          entidadeId: id,
          depois: {
            nome,
            slotId: dados.slotId ?? null,
            pilotos: pilotos.length,
            duracaoMin,
            tempoMinimoMs,
            regraLargada,
            modoEncerramento,
            esperaFinalS,
            modeloVinculo: modelo,
          },
        },
        cliente,
      );
    });
  } catch (erro) {
    if (violou(erro, "corrida_slot_fase_unico")) {
      throw new ErroNegocio(
        "Esta bateria da agenda já está sendo cronometrada.",
      );
    }
    throw erro;
  }
  return id;
}

// ------------------------------------------------------------ Grid

export async function adicionarPiloto(
  corridaId: string,
  nomeBruto: string,
  ator: Ator,
): Promise<void> {
  const nome = nomeBruto.trim();
  if (nome.length < 2) throw new ErroNegocio("Informe o nome do piloto.");
  if (nome.length > 80) throw new ErroNegocio("Nome longo demais.");
  const modelo = await lerModeloDeVinculo();
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, corridaId);
    if (!ESTADOS_EDITAVEIS.includes(corrida.estado)) {
      throw new ErroNegocio("Esta bateria já foi encerrada.");
    }
    const id = `cpiloto-${randomUUID()}`;
    await cliente.query(
      `insert into corrida_piloto (id, corrida_id, nome, modelo_vinculo)
       values ($1, $2, $3, $4)`,
      [id, corridaId, nome, modelo],
    );
    await reverterSePronta(cliente, corridaId);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.piloto_adicionar",
        entidade: "corrida_piloto",
        entidadeId: id,
        depois: { corridaId, nome },
      },
      cliente,
    );
  });
}

export interface DadosPilotoCadastro {
  // Piloto que já tem cadastro (número, nome ou telefone, escolhido na busca)...
  clienteId?: string;
  // ...ou cadastro novo feito na hora.
  nome?: string;
  telefone?: string;
  nascimento?: string;
  documento?: string;
  // Vaga aberta da reserva que este piloto vai ocupar.
  vagaId?: string;
}

// Coloca um cliente cadastrado na lista da bateria (ou numa vaga aberta).
async function colocarClienteNaBateria(
  cliente: PoolClient,
  corridaId: string,
  piloto: { id: string; nome: string },
  vagaId: string | undefined,
  ator: Ator,
): Promise<void> {
  const { rows: ja } = await cliente.query(
    "select 1 from corrida_piloto where corrida_id = $1 and cliente_id = $2",
    [corridaId, piloto.id],
  );
  if (ja.length) {
    throw new ErroNegocio(`${piloto.nome} já está nesta bateria.`);
  }
  let pilotoId = `cpiloto-${randomUUID()}`;
  // Sem vaga escolhida, o piloto ocupa a primeira vaga aberta da reserva.
  let vaga = vagaId;
  if (!vaga) {
    const { rows } = await cliente.query<{ id: string }>(
      `select id from corrida_piloto
        where corrida_id = $1 and cliente_id is null and reserva_id is not null
        order by criado_em, id limit 1 for update`,
      [corridaId],
    );
    vaga = rows[0]?.id;
  }
  if (vaga) {
    const { rows } = await cliente.query<{
      id: string;
      reserva_id: string | null;
    }>(
      `update corrida_piloto set nome = $3, cliente_id = $4
        where id = $1 and corrida_id = $2 and cliente_id is null
        returning id, reserva_id`,
      [vaga, corridaId, piloto.nome, piloto.id],
    );
    if (!rows[0]) throw new ErroNegocio("Essa vaga não está mais aberta.");
    pilotoId = rows[0].id;
    // O piloto também passa a fazer parte da reserva (para o pagamento dele).
    if (rows[0].reserva_id) {
      await cliente.query(
        `insert into reserva_piloto (id, reserva_id, cliente_id, ordem, criado_por)
         select $1, $2, $3, coalesce(max(ordem), 0) + 1, $4
           from reserva_piloto where reserva_id = $2
         on conflict (reserva_id, cliente_id) do nothing`,
        [`rpil-${randomUUID()}`, rows[0].reserva_id, piloto.id, ator.usuarioId],
      );
    }
  } else {
    await cliente.query(
      `insert into corrida_piloto (id, corrida_id, nome, cliente_id, modelo_vinculo)
       values ($1, $2, $3, $4, $5)`,
      [pilotoId, corridaId, piloto.nome, piloto.id, await lerModeloDeVinculo()],
    );
  }
  await registrarAuditoria(
    {
      usuarioId: ator.usuarioId,
      ip: ator.ip,
      acao: "corrida.piloto_cadastrar",
      entidade: "corrida_piloto",
      entidadeId: pilotoId,
      depois: { corridaId, clienteId: piloto.id, nome: piloto.nome },
    },
    cliente,
  );
}

// Cadastra o piloto da bateria: busca um cliente já cadastrado ou cria o
// cadastro na hora (número de cadastro novo). O termo é assinado depois, no
// link enviado a ele; sem o termo a bateria não inicia.
export async function cadastrarPilotoNaBateria(
  corridaId: string,
  dados: DadosPilotoCadastro,
  ator: Ator,
): Promise<{ clienteId: string; numero: number; nome: string }> {
  let alvo: { id: string; numero: number; nome: string };
  if (dados.clienteId) {
    const achado = await consultar<{
      id: string;
      numero: number;
      nome: string;
    }>("select id, numero, nome from cliente where id = $1", [dados.clienteId]);
    if (!achado[0]) throw new ErroNegocio("Cliente não encontrado.");
    alvo = achado[0];
  } else {
    const nome = (dados.nome ?? "").trim();
    const digitos = (dados.telefone ?? "").replace(/\D/g, "");
    // Mesmo nome e telefone de um cadastro existente: reaproveita o cadastro.
    const igual = digitos
      ? await consultar<{ id: string; numero: number; nome: string }>(
          `select id, numero, nome from cliente
            where telefone_digitos = $1 and lower(nome) = lower($2) limit 1`,
          [digitos, nome],
        )
      : [];
    alvo = igual[0]
      ? igual[0]
      : await criarCliente(
          {
            nome,
            telefone: dados.telefone ?? "",
            nascimento: dados.nascimento,
            documento: dados.documento,
          },
          ator,
        );
  }
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, corridaId);
    if (!ESTADOS_EDITAVEIS.includes(corrida.estado)) {
      throw new ErroNegocio("Esta bateria já foi encerrada.");
    }
    await colocarClienteNaBateria(cliente, corridaId, alvo, dados.vagaId, ator);
    await reverterSePronta(cliente, corridaId);
  });
  return { clienteId: alvo.id, numero: alvo.numero, nome: alvo.nome };
}

// Define quem responde pela bateria. Por padrão o responsável também corre e
// entra na lista de pilotos (se ainda não estiver).
export async function definirResponsavel(
  corridaId: string,
  clienteId: string,
  tambemPilota: boolean,
  ator: Ator,
): Promise<void> {
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, corridaId);
    if (!ESTADOS_EDITAVEIS.includes(corrida.estado)) {
      throw new ErroNegocio("Esta bateria já foi encerrada.");
    }
    const { rows } = await cliente.query<{ id: string; nome: string }>(
      "select id, nome from cliente where id = $1",
      [clienteId],
    );
    if (!rows[0]) throw new ErroNegocio("Cliente não encontrado.");
    await cliente.query(
      "update corrida set responsavel_cliente_id = $2 where id = $1",
      [corridaId, clienteId],
    );
    if (tambemPilota) {
      const { rows: ja } = await cliente.query(
        "select 1 from corrida_piloto where corrida_id = $1 and cliente_id = $2",
        [corridaId, clienteId],
      );
      if (!ja.length) {
        await colocarClienteNaBateria(
          cliente,
          corridaId,
          rows[0],
          undefined,
          ator,
        );
        await reverterSePronta(cliente, corridaId);
      }
    }
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.responsavel",
        entidade: "corrida",
        entidadeId: corridaId,
        depois: { clienteId, nome: rows[0].nome, tambemPilota },
      },
      cliente,
    );
  });
}

// Cadastra vários pilotos de uma vez (um nome por linha): é a lista da bateria,
// de onde se escolhe o nome ao dar o nome ao kart. Nada é gravado se algum
// nome for inválido.
export async function adicionarPilotosEmLote(
  corridaId: string,
  textoBruto: string,
  ator: Ator,
): Promise<number> {
  const nomes = textoBruto
    .split(/\r?\n/)
    .map((n) => n.trim())
    .filter(Boolean);
  if (nomes.length === 0) throw new ErroNegocio("Escreva ao menos um nome.");
  if (nomes.length > 60) throw new ErroNegocio("No máximo 60 nomes por vez.");
  for (const n of nomes) {
    if (n.length < 2) throw new ErroNegocio(`Nome muito curto: "${n}".`);
    if (n.length > 80)
      throw new ErroNegocio(`Nome longo demais: "${n.slice(0, 20)}…".`);
  }
  const modelo = await lerModeloDeVinculo();
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, corridaId);
    if (!ESTADOS_EDITAVEIS.includes(corrida.estado)) {
      throw new ErroNegocio("Esta bateria já foi encerrada.");
    }
    for (const nome of nomes) {
      await cliente.query(
        `insert into corrida_piloto (id, corrida_id, nome, modelo_vinculo)
         values ($1, $2, $3, $4)`,
        [`cpiloto-${randomUUID()}`, corridaId, nome, modelo],
      );
    }
    await reverterSePronta(cliente, corridaId);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.pilotos_adicionar",
        entidade: "corrida",
        entidadeId: corridaId,
        depois: { nomes },
      },
      cliente,
    );
  });
  return nomes.length;
}

export async function removerPiloto(
  pilotoId: string,
  ator: Ator,
): Promise<void> {
  await transacao(async (cliente) => {
    const piloto = await pilotoParaAlterar(cliente, pilotoId);
    await cliente.query("delete from corrida_piloto where id = $1", [pilotoId]);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.piloto_remover",
        entidade: "corrida_piloto",
        entidadeId: pilotoId,
        antes: { corridaId: piloto.corrida_id, nome: piloto.nome },
      },
      cliente,
    );
  });
}

// Sensor (transponder) já em uso por outro participante de uma corrida que
// ainda não terminou? Devolve o nome de quem está com ele.
async function donoDoSensor(
  cliente: PoolClient,
  sensor: string,
  ignorarPiloto: string,
  corridaId: string,
): Promise<string | null> {
  const { rows } = await cliente.query<{ nome: string }>(
    `select p.nome from corrida_piloto p join corrida c on c.id = p.corrida_id
      where p.transponder = $1 and p.id <> $2
        and (p.corrida_id = $3 or c.estado in ('em_andamento', 'encerrando'))
      limit 1`,
    [sensor, ignorarPiloto, corridaId],
  );
  return rows[0]?.nome ?? null;
}

async function exigirTransponderUsavel(cliente: PoolClient, sensor: string) {
  const { rows } = await cliente.query<{ status: string }>(
    "select status from transponder where codigo = $1",
    [sensor],
  );
  if (!rows[0]) {
    throw new ErroNegocio("Esse sensor ainda não foi lido pelo decoder.");
  }
  if (rows[0].status !== "ativo") {
    throw new ErroNegocio(
      `Esse transponder está ${rows[0].status === "manutencao" ? "em manutenção" : "inativo"}.`,
    );
  }
}

function traduzirErroDeVinculo(erro: unknown): never {
  if (violou(erro, "corrida_piloto_sensor")) {
    throw new ErroNegocio(
      "Esse sensor já está com outro piloto nesta bateria.",
    );
  }
  if (violou(erro, "corrida_piloto_kart")) {
    throw new ErroNegocio("Esse kart já está com outro piloto nesta bateria.");
  }
  throw erro;
}

// Modelo "piloto": liga um sensor (que o decoder já leu) a um piloto. As
// passagens dele que já aconteceram na corrida passam a valer.
export async function vincularSensor(
  pilotoId: string,
  codigo: string,
  ator: Ator,
): Promise<void> {
  const sensor = codigo.trim();
  if (!REGEX_SENSOR.test(sensor)) throw new ErroNegocio("Escolha o sensor.");
  if ((await lerModeloDeVinculo()) !== "piloto") {
    throw new ErroNegocio(
      "Neste modo o sensor vem do kart: escolha o kart do piloto.",
    );
  }
  try {
    await transacao(async (cliente) => {
      const piloto = await pilotoParaAlterar(cliente, pilotoId);
      await exigirTransponderUsavel(cliente, sensor);
      const dono = await donoDoSensor(
        cliente,
        sensor,
        pilotoId,
        piloto.corrida_id,
      );
      if (dono) throw new ErroNegocio(`Esse sensor já está com ${dono}.`);
      await cliente.query(
        `update corrida_piloto
            set transponder = $2, captura_armada_em = null, modelo_vinculo = 'piloto'
          where id = $1`,
        [pilotoId, sensor],
      );
      await registrarAuditoria(
        {
          usuarioId: ator.usuarioId,
          ip: ator.ip,
          acao: "corrida.sensor_vincular",
          entidade: "corrida_piloto",
          entidadeId: pilotoId,
          antes: { transponder: piloto.transponder },
          depois: { transponder: sensor },
        },
        cliente,
      );
    });
  } catch (erro) {
    if (erro instanceof ErroNegocio) throw erro;
    traduzirErroDeVinculo(erro);
  }
}

export async function desvincularSensor(
  pilotoId: string,
  ator: Ator,
): Promise<void> {
  if ((await lerModeloDeVinculo()) !== "piloto") {
    throw new ErroNegocio(
      "Neste modo o sensor vem do kart: troque ou retire o kart do piloto.",
    );
  }
  await transacao(async (cliente) => {
    const piloto = await pilotoParaAlterar(cliente, pilotoId);
    await cliente.query(
      "update corrida_piloto set transponder = null where id = $1",
      [pilotoId],
    );
    await reverterSePronta(cliente, piloto.corrida_id);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.sensor_desvincular",
        entidade: "corrida_piloto",
        entidadeId: pilotoId,
        antes: { transponder: piloto.transponder },
      },
      cliente,
    );
  });
}

// Escolhe o kart do piloto. Modelo "kart": o transponder fixo do kart passa a
// ser o do piloto NESTA corrida (cópia gravada na participação). Modelo
// "piloto": o kart só é registrado. `kartId` null remove o kart.
// Define (ou tira) o kart de um participante; no modelo "kart" o sensor vem
// do kart. Roda dentro de uma transação já aberta.
async function atribuirKart(
  cliente: PoolClient,
  pilotoId: string,
  kartId: string | null,
  modelo: string,
  ator: Ator,
): Promise<void> {
  const piloto = await pilotoParaAlterar(cliente, pilotoId);
  if (kartId === null) {
    await cliente.query(
      `update corrida_piloto
              set kart_id = null, kart_numero = null,
                  transponder = case when $2 = 'kart' then null else transponder end
            where id = $1`,
      [pilotoId, modelo],
    );
    await reverterSePronta(cliente, piloto.corrida_id);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.kart_remover",
        entidade: "corrida_piloto",
        entidadeId: pilotoId,
        antes: { kartId: piloto.kart_id, transponder: piloto.transponder },
      },
      cliente,
    );
    return;
  }

  const { rows } = await cliente.query<{
    numero: string;
    status: string;
    transponder_fixo: string | null;
  }>(
    "select numero, status, transponder_fixo from kart where id = $1 for share",
    [kartId],
  );
  const kart = rows[0];
  if (!kart) throw new ErroNegocio("Kart não encontrado.");
  if (kart.status !== "ativo") {
    throw new ErroNegocio(
      `O kart ${kart.numero} está ${kart.status === "manutencao" ? "em manutenção" : "inativo"}.`,
    );
  }
  let transponder: string | null = piloto.transponder;
  if (modelo === "kart") {
    if (!kart.transponder_fixo) {
      throw new ErroNegocio(
        `O kart ${kart.numero} não tem transponder fixo cadastrado.`,
      );
    }
    await exigirTransponderUsavel(cliente, kart.transponder_fixo);
    const dono = await donoDoSensor(
      cliente,
      kart.transponder_fixo,
      pilotoId,
      piloto.corrida_id,
    );
    if (dono) {
      throw new ErroNegocio(
        `O transponder do kart ${kart.numero} já está com ${dono}.`,
      );
    }
    transponder = kart.transponder_fixo;
  }
  await cliente.query(
    `update corrida_piloto
            set kart_id = $2, kart_numero = $3, transponder = $4,
                modelo_vinculo = $5, captura_armada_em = null
          where id = $1`,
    [pilotoId, kartId, kart.numero, transponder, modelo],
  );
  await registrarAuditoria(
    {
      usuarioId: ator.usuarioId,
      ip: ator.ip,
      acao: "corrida.kart_definir",
      entidade: "corrida_piloto",
      entidadeId: pilotoId,
      antes: { kartId: piloto.kart_id, transponder: piloto.transponder },
      depois: { kartId, kartNumero: kart.numero, transponder, modelo },
    },
    cliente,
  );
}

export async function definirKart(
  pilotoId: string,
  kartId: string | null,
  ator: Ator,
): Promise<void> {
  const modelo = await lerModeloDeVinculo();
  try {
    await transacao((cliente) =>
      atribuirKart(cliente, pilotoId, kartId, modelo, ator),
    );
  } catch (erro) {
    if (erro instanceof ErroNegocio) throw erro;
    traduzirErroDeVinculo(erro);
  }
}

// Sorteio dos karts: cada piloto da bateria (com cadastro) ainda sem kart
// recebe, ao acaso, um dos karts disponíveis (ativos e com sensor). O sensor
// vem do kart, então o piloto já fica ligado ao sensor. Com `refazer`, o sorteio
// recomeça do zero. Só antes da largada.
export async function sortearKarts(
  corridaId: string,
  opcoes: { refazer?: boolean },
  ator: Ator,
): Promise<{ piloto: string; kart: string }[]> {
  const modelo = await lerModeloDeVinculo();
  return transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, corridaId);
    if (!["preparada", "pronta"].includes(corrida.estado)) {
      throw new ErroNegocio("O sorteio é feito antes de iniciar a bateria.");
    }
    if (opcoes.refazer) {
      const { rows: comKart } = await cliente.query<{ id: string }>(
        "select id from corrida_piloto where corrida_id = $1 and kart_id is not null",
        [corridaId],
      );
      for (const p of comKart) {
        await atribuirKart(cliente, p.id, null, modelo, ator);
      }
    }
    const { rows: pilotos } = await cliente.query<{ id: string; nome: string }>(
      `select id, nome from corrida_piloto
        where corrida_id = $1 and kart_id is null
          and not (cliente_id is null and reserva_id is not null)
        order by criado_em, id`,
      [corridaId],
    );
    if (pilotos.length === 0) {
      throw new ErroNegocio(
        "Não há piloto sem kart. Cadastre os pilotos da bateria antes do sorteio.",
      );
    }
    const { rows: karts } = await cliente.query<{ id: string; numero: string }>(
      `select k.id, k.numero from kart k
        where k.status = 'ativo' and k.transponder_fixo is not null
          and not exists (select 1 from corrida_piloto p
                           where p.corrida_id = $1 and p.kart_id = k.id)`,
      [corridaId],
    );
    if (karts.length < pilotos.length) {
      throw new ErroNegocio(
        `São ${pilotos.length} piloto(s) sem kart e só ${karts.length} kart(s) disponível(is) (ativos e com sensor). Cadastre mais karts ou tire pilotos da bateria.`,
      );
    }
    // Embaralha (Fisher-Yates com sorteio criptográfico).
    for (let i = karts.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [karts[i], karts[j]] = [karts[j], karts[i]];
    }
    const resultado: { piloto: string; kart: string }[] = [];
    for (const piloto of pilotos) {
      let atribuido = false;
      while (karts.length > 0 && !atribuido) {
        const kart = karts.shift()!;
        try {
          await atribuirKart(cliente, piloto.id, kart.id, modelo, ator);
          resultado.push({ piloto: piloto.nome, kart: kart.numero });
          atribuido = true;
        } catch (erro) {
          // Kart com sensor em uso em outra bateria etc.: tenta o próximo.
          if (!(erro instanceof ErroNegocio)) throw erro;
        }
      }
      if (!atribuido) {
        throw new ErroNegocio(
          `Não sobrou kart utilizável para ${piloto.nome}. Confira os sensores dos karts.`,
        );
      }
    }
    await reverterSePronta(cliente, corridaId);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.sorteio_karts",
        entidade: "corrida",
        entidadeId: corridaId,
        depois: { refazer: Boolean(opcoes.refazer), sorteio: resultado },
      },
      cliente,
    );
    return resultado;
  });
}

// Ao fim da classificação, cria a corrida da mesma bateria: os mesmos pilotos,
// karts e sensores, com o grid de largada pela melhor volta da classificação
// (quem não fez tempo larga atrás). Só uma corrida por classificação.
// Gera a corrida de uma classificação finalizada: mesmos pilotos, karts e
// sensores, com o grid pela melhor volta (quem não fez tempo larga atrás, na
// ordem de cadastro). Uma corrida por classificação; devolve a que já existe.
async function criarCorridaDaClassificacao(
  cliente: PoolClient,
  quali: Corrida,
  duracaoMin: number,
  quem: { usuarioId: string | null; ip?: string | null },
): Promise<string | null> {
  const { rows: existente } = await cliente.query<{ id: string }>(
    "select id from corrida where classificacao_id = $1 limit 1",
    [quali.id],
  );
  if (existente[0]) return existente[0].id;
  const { rows: participantes } = await cliente.query<{
    id: string;
    nome: string;
    cliente_id: string | null;
    reserva_id: string | null;
    transponder: string | null;
    kart_id: string | null;
    kart_numero: string | null;
    modelo_vinculo: string;
    nomeado: boolean;
    sensores_extras: string[];
  }>(
    `select id, nome, cliente_id, reserva_id, transponder, kart_id, kart_numero,
              modelo_vinculo, nomeado, sensores_extras
         from corrida_piloto where corrida_id = $1 order by criado_em, id`,
    [quali.id],
  );
  if (participantes.length === 0) return null;
  // Grid: melhor volta da classificação; sem tempo, atrás e na ordem de cadastro (regra vigente,
  // em lib/cronometragem/grid-vigente.ts). Com a correção de DSQ/DNS ativada para esta sessão, DSQ e DNS
  // vão para o fim do grid em vez de serem ordenados pela melhor volta.
  const ordenados = ordenarGridVigente(
    participantes,
    quali.resultadoFinal?.classificacao,
    {
      corrigirDsqDns: correcaoDsqAtiva(
        { fase: quali.fase, criadoEm: quali.criadoEm },
        lerCorrecaoDsqDesde(),
      ),
    },
  ).map((p) => ({ p }));

  const id = `corrida-${randomUUID()}`;
  const nome = quali.nome.includes(" — Classificação")
    ? quali.nome.replace(" — Classificação", " — Corrida")
    : `${quali.nome} — Corrida`;
  await cliente.query(
    `insert into corrida (id, nome, slot_id, tempo_minimo_ms, duracao_min,
                            regra_largada, modo_encerramento, espera_final_s, criada_por,
                            responsavel_cliente_id, fase, classificacao_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'corrida', $11)`,
    [
      id,
      nome,
      quali.slotId ?? null,
      quali.tempoMinimoMs,
      duracaoMin,
      quali.regraLargada,
      quali.modoEncerramento,
      quali.esperaFinalS,
      quem.usuarioId,
      quali.responsavelClienteId ?? null,
      quali.id,
    ],
  );
  for (const [posicao, { p }] of ordenados.entries()) {
    await cliente.query(
      `insert into corrida_piloto
           (id, corrida_id, nome, cliente_id, reserva_id, transponder, kart_id,
            kart_numero, modelo_vinculo, nomeado, sensores_extras, posicao_grid)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        `cpiloto-${randomUUID()}`,
        id,
        p.nome,
        p.cliente_id,
        p.reserva_id,
        p.transponder,
        p.kart_id,
        p.kart_numero,
        p.modelo_vinculo,
        p.nomeado,
        p.sensores_extras,
        posicao + 1,
      ],
    );
  }
  await registrarAuditoria(
    {
      usuarioId: quem.usuarioId,
      ip: quem.ip,
      acao: "corrida.preparar_corrida",
      entidade: "corrida",
      entidadeId: id,
      depois: {
        classificacaoId: quali.id,
        duracaoMin,
        grid: ordenados.map(({ p }, i) => ({ posicao: i + 1, nome: p.nome })),
      },
    },
    cliente,
  );
  return id;
}

export async function prepararCorrida(
  classificacaoId: string,
  opcoes: { duracaoMin?: number },
  ator: Ator,
): Promise<string> {
  if (opcoes.duracaoMin !== undefined) {
    const m = opcoes.duracaoMin;
    if (!Number.isInteger(m) || m < 1 || m > 240) {
      throw new ErroNegocio("Duração da corrida: de 1 a 240 minutos.");
    }
  }
  return transacao(async (cliente) => {
    const { rows } = await cliente.query<LinhaCorrida>(
      `select ${COLUNAS_CORRIDA} from corrida c where c.id = $1 for update`,
      [classificacaoId],
    );
    if (!rows[0]) throw new ErroNegocio("Classificação não encontrada.");
    const quali = corridaDeLinha(rows[0]);
    if (quali.fase !== "classificacao") {
      throw new ErroNegocio("Só a classificação gera a corrida.");
    }
    if (quali.estado !== "finalizada") {
      throw new ErroNegocio(
        "Finalize a classificação antes de criar a corrida.",
      );
    }
    const id = await criarCorridaDaClassificacao(
      cliente,
      quali,
      opcoes.duracaoMin ?? quali.duracaoCorridaMin ?? DURACAO_PADRAO_MIN,
      { usuarioId: ator.usuarioId, ip: ator.ip },
    );
    if (!id) throw new ErroNegocio("A classificação não teve participantes.");
    return id;
  });
}

// Pula a classificação (antes de iniciar): vai direto para a corrida, sem
// tempos; o grid segue a ordem de cadastro. Devolve a corrida criada.
export async function pularClassificacao(
  classificacaoId: string,
  ator: Ator,
): Promise<string | null> {
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, classificacaoId);
    if (corrida.fase !== "classificacao") {
      throw new ErroNegocio("Só a classificação pode ser pulada.");
    }
    if (!["preparada", "pronta"].includes(corrida.estado)) {
      throw new ErroNegocio(
        "A classificação já começou: use “Encerrar a classificação agora”.",
      );
    }
    await finalizarInterno(
      cliente,
      classificacaoId,
      null,
      ator.usuarioId,
      ator.ip,
      "pulada",
    );
  });
  return corridaDaClassificacao(classificacaoId);
}

// A corrida que nasceu desta classificação (se já existe).
export async function corridaDaClassificacao(
  classificacaoId: string,
): Promise<string | null> {
  const [l] = await consultar<{ id: string }>(
    "select id from corrida where classificacao_id = $1 limit 1",
    [classificacaoId],
  );
  return l?.id ?? null;
}

// Edita os tempos: da fase (min) e, na classificação, o tempo planejado da
// corrida (até ela ser criada; depois, edita-se na própria corrida). Com a
// bateria rodando, o novo tempo precisa ainda estar no futuro.
export async function definirDuracoes(
  id: string,
  tempos: { duracaoMin?: number; duracaoCorridaMin?: number },
  ator: Ator,
): Promise<void> {
  const valida = (m: number, rotulo: string) => {
    if (!Number.isInteger(m) || m < 1 || m > 240) {
      throw new ErroNegocio(`${rotulo}: de 1 a 240 minutos.`);
    }
  };
  if (tempos.duracaoMin !== undefined) valida(tempos.duracaoMin, "Duração");
  if (tempos.duracaoCorridaMin !== undefined) {
    valida(tempos.duracaoCorridaMin, "Duração da corrida");
  }
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, id);
    if (["finalizada", "cancelada", "encerrando"].includes(corrida.estado)) {
      throw new ErroNegocio("Esta bateria já terminou: o tempo não muda mais.");
    }
    if (tempos.duracaoMin !== undefined) {
      if (corrida.estado === "em_andamento") {
        const { rows } = await cliente.query<{ ok: boolean }>(
          `select (iniciada_em + make_interval(mins => $2) > clock_timestamp()) as ok
             from corrida where id = $1`,
          [id, tempos.duracaoMin],
        );
        if (!rows[0]?.ok) {
          throw new ErroNegocio(
            "Esse tempo já passou: a bateria está rodando há mais que isso. Use “Encerrar agora”.",
          );
        }
      }
      await cliente.query("update corrida set duracao_min = $2 where id = $1", [
        id,
        tempos.duracaoMin,
      ]);
    }
    if (tempos.duracaoCorridaMin !== undefined) {
      if (corrida.fase !== "classificacao") {
        throw new ErroNegocio(
          "O tempo da corrida é definido na classificação; na corrida, altere a duração dela.",
        );
      }
      const { rowCount } = await cliente.query(
        "select 1 from corrida where classificacao_id = $1",
        [id],
      );
      if (rowCount) {
        throw new ErroNegocio(
          "A corrida já foi criada: altere o tempo na própria corrida.",
        );
      }
      await cliente.query(
        "update corrida set duracao_corrida_min = $2 where id = $1",
        [id, tempos.duracaoCorridaMin],
      );
    }
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.duracao_alterar",
        entidade: "corrida",
        entidadeId: id,
        antes: {
          duracaoMin: corrida.duracaoMin,
          duracaoCorridaMin: corrida.duracaoCorridaMin,
        },
        depois: tempos,
      },
      cliente,
    );
  });
}

// "Capturar o próximo sensor": o primeiro sensor novo que o decoder ler vai
// para este piloto (como bipar o código de barras). Só no modelo "piloto".
export async function armarCaptura(
  pilotoId: string,
  armar: boolean,
  ator: Ator,
): Promise<void> {
  if (armar && (await lerModeloDeVinculo()) !== "piloto") {
    throw new ErroNegocio("Neste modo o sensor vem do kart.");
  }
  await transacao(async (cliente) => {
    const piloto = await pilotoParaAlterar(cliente, pilotoId);
    if (armar && piloto.transponder) {
      throw new ErroNegocio("Este piloto já tem sensor.");
    }
    await cliente.query(
      `update corrida_piloto
          set captura_armada_em = case when $2 then clock_timestamp() else null end
        where id = $1`,
      [pilotoId, armar],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: armar ? "corrida.captura_armar" : "corrida.captura_cancelar",
        entidade: "corrida_piloto",
        entidadeId: pilotoId,
      },
      cliente,
    );
  });
}

// Chamado pela entrada de passagens (mesma transação): sensores ativos que
// ainda não estão com ninguém numa corrida aberta vão para o piloto que pediu
// captura, do pedido mais antigo para o mais novo.
export async function vincularPorCaptura(
  cliente: PoolClient,
  codigos: string[],
): Promise<void> {
  for (const codigo of new Set(codigos)) {
    const { rows: usavel } = await cliente.query(
      "select 1 from transponder where codigo = $1 and status = 'ativo'",
      [codigo],
    );
    if (!usavel.length) continue;
    const { rowCount: emAndamento } = await cliente.query(
      `select 1 from corrida_piloto p join corrida c on c.id = p.corrida_id
        where p.transponder = $1 and c.estado in ('em_andamento', 'encerrando')
        limit 1`,
      [codigo],
    );
    if (emAndamento) continue;
    const { rows } = await cliente.query<{ id: string; corrida_id: string }>(
      `select p.id, p.corrida_id
         from corrida_piloto p join corrida c on c.id = p.corrida_id
        where p.captura_armada_em is not null and p.transponder is null
          and c.estado not in ('finalizada', 'cancelada')
        order by p.captura_armada_em, p.id
        limit 1 for update of p skip locked`,
    );
    if (!rows[0]) return;
    const { rowCount: naMesma } = await cliente.query(
      "select 1 from corrida_piloto where corrida_id = $1 and transponder = $2",
      [rows[0].corrida_id, codigo],
    );
    if (naMesma) continue;
    await cliente.query(
      `update corrida_piloto
          set transponder = $2, captura_armada_em = null, modelo_vinculo = 'piloto'
        where id = $1`,
      [rows[0].id, codigo],
    );
    await registrarAuditoria(
      {
        acao: "corrida.sensor_capturado",
        entidade: "corrida_piloto",
        entidadeId: rows[0].id,
        depois: { transponder: codigo, corridaId: rows[0].corrida_id },
      },
      cliente,
    );
  }
}

// ------------------------------------------- Bateria no estilo LapTime

// Modelo "kart": cada kart tem um sensor fixo cadastrado. Depois da largada,
// o kart que passar pelo decoder entra SOZINHO na classificação (sem nome); o
// operador dá o nome do piloto depois da 1ª passagem. Chamado pela entrada de
// passagens, na mesma transação.
export async function entrarKartsAutomaticamente(
  cliente: PoolClient,
  passagens: { transponder: string; instanteMs: number }[],
): Promise<void> {
  const { rows: cfg } = await cliente.query<{ modelo_vinculo: string }>(
    "select modelo_vinculo from config_cronometragem",
  );
  if (cfg[0]?.modelo_vinculo !== "kart") return;
  const { rows: ativa } = await cliente.query<{
    id: string;
    iniciada_em: Date;
  }>(
    "select id, iniciada_em from corrida where estado = 'em_andamento' limit 1",
  );
  if (!ativa[0]) return;
  const inicio = ativa[0].iniciada_em.getTime();

  const codigos = new Set(
    passagens.filter((p) => p.instanteMs >= inicio).map((p) => p.transponder),
  );
  for (const codigo of codigos) {
    const { rows: karts } = await cliente.query<{ id: string; numero: string }>(
      `select k.id, k.numero
         from kart_sensor ks
         join kart k on k.id = ks.kart_id
         join transponder t on t.codigo = ks.transponder
        where ks.transponder = $1 and ks.removido_em is null
          and k.status = 'ativo' and t.status = 'ativo'`,
      [codigo],
    );
    if (!karts[0]) continue;
    // O mesmo sensor não pode estar em duas baterias abertas ao mesmo tempo.
    const { rowCount: emOutra } = await cliente.query(
      `select 1 from corrida_piloto p join corrida c on c.id = p.corrida_id
        where p.transponder = $1 and c.estado in ('em_andamento', 'encerrando')
          and p.corrida_id <> $2 limit 1`,
      [codigo, ativa[0].id],
    );
    if (emOutra) continue;

    // O kart já está na bateria com outro sensor (o sensor foi trocado ou o
    // kart tem dois): esta leitura passa a contar para o mesmo piloto.
    const { rows: jaNaBateria } = await cliente.query<{
      id: string;
      transponder: string | null;
      sensores_extras: string[];
    }>(
      `select id, transponder, sensores_extras from corrida_piloto
        where corrida_id = $1 and kart_id = $2 for update`,
      [ativa[0].id, karts[0].id],
    );
    if (jaNaBateria[0]) {
      const atual = jaNaBateria[0];
      if (
        atual.transponder !== codigo &&
        !atual.sensores_extras.includes(codigo)
      ) {
        await cliente.query(
          `update corrida_piloto set sensores_extras = array_append(sensores_extras, $2)
            where id = $1`,
          [atual.id, codigo],
        );
        await registrarAuditoria(
          {
            acao: "corrida.sensor_adicionado_ao_kart",
            entidade: "corrida_piloto",
            entidadeId: atual.id,
            depois: { kart: karts[0].numero, transponder: codigo },
          },
          cliente,
        );
      }
      continue;
    }
    const id = `cpiloto-${randomUUID()}`;
    const { rowCount } = await cliente.query(
      `insert into corrida_piloto
         (id, corrida_id, nome, kart_id, kart_numero, transponder, modelo_vinculo, nomeado)
       values ($1, $2, $3, $4, $5, $6, 'kart', false)
       on conflict do nothing`,
      [
        id,
        ativa[0].id,
        `Kart ${karts[0].numero}`,
        karts[0].id,
        karts[0].numero,
        codigo,
      ],
    );
    if (rowCount) {
      await registrarAuditoria(
        {
          acao: "corrida.kart_entrou",
          entidade: "corrida_piloto",
          entidadeId: id,
          depois: {
            corridaId: ativa[0].id,
            kart: karts[0].numero,
            transponder: codigo,
          },
        },
        cliente,
      );
    }
  }
}

// Dá o nome ao piloto de um kart (depois da 1ª passagem): digitado, ou
// escolhido na lista de pilotos da bateria que ainda não têm kart. Também
// serve para corrigir um nome, mesmo depois que a bateria terminou.
export async function nomearParticipante(
  participanteId: string,
  dados: { nome?: string; pendenteId?: string },
  ator: Ator,
): Promise<void> {
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<{
      id: string;
      nome: string;
      corrida_id: string;
      estado: EstadoCorrida;
    }>(
      `select p.id, p.nome, p.corrida_id, c.estado
         from corrida_piloto p join corrida c on c.id = p.corrida_id
        where p.id = $1 for update of p`,
      [participanteId],
    );
    const atual = rows[0];
    if (!atual) throw new ErroNegocio("Piloto não encontrado.");
    if (atual.estado === "cancelada") {
      throw new ErroNegocio("Esta bateria foi cancelada.");
    }

    let nome = dados.nome?.trim() ?? "";
    let clienteId: string | null = null;
    let reservaId: string | null = null;
    if (dados.pendenteId) {
      const { rows: pend } = await cliente.query<{
        nome: string;
        cliente_id: string | null;
        reserva_id: string | null;
        transponder: string | null;
      }>(
        `select nome, cliente_id, reserva_id, transponder from corrida_piloto
          where id = $1 and corrida_id = $2 and id <> $3 for update`,
        [dados.pendenteId, atual.corrida_id, participanteId],
      );
      if (!pend[0] || pend[0].transponder) {
        throw new ErroNegocio("Esse piloto da lista não está mais disponível.");
      }
      nome = pend[0].nome;
      clienteId = pend[0].cliente_id;
      reservaId = pend[0].reserva_id;
      await cliente.query("delete from corrida_piloto where id = $1", [
        dados.pendenteId,
      ]);
    }
    if (nome.length < 2) throw new ErroNegocio("Informe o nome do piloto.");
    if (nome.length > 80) throw new ErroNegocio("Nome longo demais.");

    await cliente.query(
      `update corrida_piloto
          set nome = $2, nomeado = true,
              cliente_id = coalesce($3, cliente_id),
              reserva_id = coalesce($4, reserva_id)
        where id = $1`,
      [participanteId, nome, clienteId, reservaId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.piloto_nomear",
        entidade: "corrida_piloto",
        entidadeId: participanteId,
        antes: { nome: atual.nome },
        depois: { nome },
      },
      cliente,
    );
  });
}

// Abre a bateria de um horário da agenda: devolve a que já existe (a em curso,
// ou a última) ou cria uma nova, com classificação e corrida e os pilotos
// reservados.
export async function abrirBateriaDoSlot(
  slotId: string,
  ator: Ator,
): Promise<string> {
  const [existente] = await consultar<{ id: string }>(
    `select id from corrida where slot_id = $1
      order by (estado in ('finalizada', 'cancelada')), criado_em desc limit 1`,
    [slotId],
  );
  if (existente) return existente.id;
  return criarCorrida({ slotId, fase: "classificacao" }, ator);
}

// "Nova bateria" com um clique: repete as regras da última bateria (ou usa os
// padrões) e já devolve uma bateria pronta para iniciar. Se já existir uma
// bateria avulsa em preparação e vazia, reaproveita em vez de criar outra.
export async function novaBateriaRapida(
  ator: Ator,
  opcoes: { duasFases?: boolean } = {},
): Promise<string> {
  const fase = opcoes.duasFases ? "classificacao" : "unica";
  const vazias = await consultar<{ id: string }>(
    `select c.id from corrida c
      where c.estado = 'preparada' and c.slot_id is null and c.fase = $1
        and not exists (select 1 from corrida_piloto p where p.corrida_id = c.id)
      order by c.criado_em desc limit 1`,
    [fase],
  );
  if (vazias[0]) return vazias[0].id;

  // As regras vêm da última bateria do mesmo tipo (a classificação copia a
  // última classificação; a corrida única, a última corrida).
  const [ultima] = await consultar<LinhaCorrida>(
    `select ${COLUNAS_CORRIDA} from corrida c
      where c.fase = $1 or ($1 = 'unica' and c.fase = 'corrida')
      order by c.criado_em desc limit 1`,
    [fase],
  );
  const hora = formatarHora(new Date());
  return criarCorrida(
    {
      fase,
      nome: `Bateria ${hora}`,
      duracaoMin: ultima?.duracao_min ?? undefined,
      tempoMinimoMs: ultima?.tempo_minimo_ms,
      regraLargada: ultima?.regra_largada,
      modoEncerramento: ultima?.modo_encerramento,
      esperaFinalS: ultima?.espera_final_s,
    },
    ator,
  );
}

// ------------------------------------------------- Máquina de estados

// Confirma que o grid está pronto: ao menos um piloto e todos com sensor
// ativo. Piloto que não vai correr deve ser removido do grid.
export async function marcarPronta(id: string, ator: Ator): Promise<void> {
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, id);
    if (corrida.estado !== "preparada") {
      throw new ErroNegocio("Esta bateria não está em preparação.");
    }
    const { rows } = await cliente.query<{
      nome: string;
      transponder: string | null;
      status: string | null;
    }>(
      `select p.nome, p.transponder, t.status
         from corrida_piloto p left join transponder t on t.codigo = p.transponder
        where p.corrida_id = $1 order by p.criado_em, p.id`,
      [id],
    );
    if (rows.length === 0)
      throw new ErroNegocio("Adicione ao menos um piloto.");
    const semSensor = rows.filter((r) => !r.transponder).map((r) => r.nome);
    if (semSensor.length) {
      throw new ErroNegocio(
        `Falta sensor para: ${semSensor.join(", ")}. Vincule ou remova do grid.`,
      );
    }
    const inativos = rows
      .filter((r) => r.status !== "ativo")
      .map((r) => r.nome);
    if (inativos.length) {
      throw new ErroNegocio(
        `Transponder inativo ou em manutenção para: ${inativos.join(", ")}.`,
      );
    }
    await cliente.query("update corrida set estado = 'pronta' where id = $1", [
      id,
    ]);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.marcar_pronta",
        entidade: "corrida",
        entidadeId: id,
      },
      cliente,
    );
  });
}

export async function reabrirPreparacao(id: string, ator: Ator): Promise<void> {
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, id);
    if (corrida.estado !== "pronta") {
      throw new ErroNegocio("Esta bateria não está marcada como pronta.");
    }
    await cliente.query(
      "update corrida set estado = 'preparada' where id = $1",
      [id],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.reabrir_preparacao",
        entidade: "corrida",
        entidadeId: id,
      },
      cliente,
    );
  });
}

// A bateria só sai quando todo piloto cadastrado nela assinou o termo vigente
// (e as vagas abertas da reserva foram preenchidas ou removidas).
async function exigirTermosAssinados(
  cliente: PoolClient,
  corridaId: string,
): Promise<void> {
  const { rows } = await cliente.query<{
    nome: string;
    numero: number | null;
    vaga: boolean;
  }>(
    `select p.nome, c.numero, (p.cliente_id is null) as vaga
       from corrida_piloto p left join cliente c on c.id = p.cliente_id
      where p.corrida_id = $1
        and ((p.cliente_id is null and p.reserva_id is not null)
          or (p.cliente_id is not null and not exists (
                select 1 from termo_aceite a
                 where a.cliente_id = p.cliente_id
                   and a.termo_versao_id = (select id from termo_versao order by versao desc limit 1)
                   and a.aceito_em >= now() - make_interval(days => $2))))
      order by p.criado_em, p.id`,
    [corridaId, VALIDADE_ACEITE_DIAS],
  );
  if (rows.length === 0) return;
  const vagas = rows.filter((r) => r.vaga).map((r) => r.nome);
  const pendentes = rows
    .filter((r) => !r.vaga)
    .map((r) => `${r.nome} (nº ${r.numero})`);
  const partes: string[] = [];
  if (pendentes.length) {
    partes.push(`Termo pendente: ${pendentes.join(", ")}.`);
  }
  if (vagas.length) {
    partes.push(
      `Vaga sem piloto cadastrado: ${vagas.join(", ")} (cadastre o piloto ou remova a vaga).`,
    );
  }
  throw new ErroNegocio(
    `${partes.join(" ")} Os termos estão na tela da bateria (QR e link): peça para assinarem antes de iniciar.`,
  );
}

export async function iniciarCorrida(id: string, ator: Ator): Promise<void> {
  try {
    await transacao(async (cliente) => {
      const corrida = await corridaParaAlterar(cliente, id);
      const porKart = (await lerModeloDeVinculo()) === "kart";
      if (corrida.estado === "preparada" && !porKart) {
        throw new ErroNegocio(
          "Confirme o grid (Marcar como pronta) antes de iniciar.",
        );
      }
      // Modelo "kart": os karts entram sozinhos ao passar; não há grid a confirmar.
      if (
        corrida.estado !== "pronta" &&
        !(corrida.estado === "preparada" && porKart)
      ) {
        throw new ErroNegocio("Esta bateria já foi iniciada ou encerrada.");
      }
      await exigirTermosAssinados(cliente, id);
      await cliente.query(
        `update corrida set estado = 'em_andamento', iniciada_em = clock_timestamp()
          where id = $1`,
        [id],
      );
      await registrarAuditoria(
        {
          usuarioId: ator.usuarioId,
          ip: ator.ip,
          acao: "corrida.iniciar",
          entidade: "corrida",
          entidadeId: id,
        },
        cliente,
      );
    });
  } catch (erro) {
    if (violou(erro, "corrida_uma_ativa")) {
      throw new ErroNegocio(
        "Já existe uma bateria em andamento. Finalize-a antes de iniciar outra.",
      );
    }
    throw erro;
  }
}

// Bandeira antes do fim do tempo: a corrida passa a "encerrando".
export async function encerrarAgora(id: string, ator: Ator): Promise<void> {
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, id);
    if (corrida.estado !== "em_andamento") {
      throw new ErroNegocio("Esta bateria não está em andamento.");
    }
    await cliente.query(
      `update corrida set estado = 'encerrando', encerrando_em = clock_timestamp()
        where id = $1`,
      [id],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.encerrar_agora",
        entidade: "corrida",
        entidadeId: id,
      },
      cliente,
    );
  });
  await avancarCorrida(id);
}

// Fecha a corrida: grava o instante final e o resultado publicado.
async function finalizarInterno(
  cliente: PoolClient,
  id: string,
  instante: Date | null,
  usuarioId: string | null,
  ip: string | null | undefined,
  origem: string,
): Promise<void> {
  await cliente.query(
    `update corrida
        set estado = 'finalizada',
            iniciada_em = coalesce(iniciada_em, clock_timestamp()),
            encerrada_em = coalesce($2::timestamptz, clock_timestamp()),
            encerrando_em = coalesce(encerrando_em, $2::timestamptz, clock_timestamp())
      where id = $1`,
    [id, instante],
  );
  await cliente.query(
    "update corrida_piloto set captura_armada_em = null where corrida_id = $1",
    [id],
  );
  const { rows } = await cliente.query<LinhaCorrida>(
    `select ${COLUNAS_CORRIDA} from corrida c where c.id = $1`,
    [id],
  );
  const corrida = corridaDeLinha(rows[0]);
  const grid = await listarPilotos(consultaDe(cliente), id);
  const carregado = await carregarEntrada(
    consultaDe(cliente),
    corrida,
    grid,
    corrida.encerradaEm?.getTime() ?? Date.now(),
  );
  const publicado: ResultadoPublicado = {
    geradoEm: new Date().toISOString(),
    classificacao: carregado.resultado.classificacao,
  };
  await cliente.query(
    "update corrida set resultado_final = $2::jsonb where id = $1",
    [id, JSON.stringify(publicado)],
  );
  // Terminou a classificação (no tempo, antes ou pulada): a corrida é gerada
  // na hora, com o tempo planejado, para o operador só iniciar.
  if (corrida.fase === "classificacao") {
    await criarCorridaDaClassificacao(
      cliente,
      { ...corrida, resultadoFinal: publicado },
      corrida.duracaoCorridaMin ?? DURACAO_PADRAO_MIN,
      { usuarioId, ip },
    );
  }
  await registrarAuditoria(
    {
      usuarioId,
      ip,
      acao: "corrida.finalizar",
      entidade: "corrida",
      entidadeId: id,
      depois: {
        origem,
        classificacao: carregado.resultado.classificacao.map((l) => ({
          piloto: l.nome,
          posicao: l.posicao,
          voltas: l.voltas,
          melhorVoltaMs: l.melhorVoltaMs,
        })),
      },
    },
    cliente,
  );
}

export async function finalizarCorrida(id: string, ator: Ator): Promise<void> {
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, id);
    if (!ESTADOS_ATIVOS.includes(corrida.estado)) {
      throw new ErroNegocio("Esta bateria não está em andamento.");
    }
    await finalizarInterno(
      cliente,
      id,
      null,
      ator.usuarioId,
      ator.ip,
      "manual",
    );
  });
}

export async function cancelarCorrida(
  id: string,
  motivoBruto: string,
  ator: Ator,
): Promise<void> {
  const motivo = motivoBruto.trim();
  if (motivo.length < 3) {
    throw new ErroNegocio("Informe o motivo do cancelamento.");
  }
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, id);
    if (!ESTADOS_EDITAVEIS.includes(corrida.estado)) {
      throw new ErroNegocio("Esta bateria já foi encerrada ou cancelada.");
    }
    await cliente.query(
      `update corrida
          set estado = 'cancelada', cancelada_em = clock_timestamp(),
              cancelada_por = $2, motivo_cancelamento = $3
        where id = $1`,
      [id, ator.usuarioId, motivo],
    );
    await cliente.query(
      "update corrida_piloto set captura_armada_em = null where corrida_id = $1",
      [id],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.cancelar",
        entidade: "corrida",
        entidadeId: id,
        antes: { estado: corrida.estado },
        motivo,
      },
      cliente,
    );
  });
}

// Só dá pra apagar o que nunca começou.
export async function excluirCorrida(id: string, ator: Ator): Promise<void> {
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, id);
    if (corrida.estado !== "preparada" && corrida.estado !== "pronta") {
      throw new ErroNegocio(
        "Só é possível excluir uma bateria que não começou.",
      );
    }
    await cliente.query("delete from corrida_piloto where corrida_id = $1", [
      id,
    ]);
    await cliente.query("delete from corrida where id = $1", [id]);
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.excluir",
        entidade: "corrida",
        entidadeId: id,
        antes: { nome: corrida.nome },
      },
      cliente,
    );
  });
}

// O relógio da corrida mora no SERVIDOR e no banco: esta função é idempotente
// e é chamada por um temporizador do servidor, ao abrir a tela e a cada
// passagem recebida. Depois de uma reinicialização ela simplesmente retoma
// de onde o banco está.
export async function avancarCorrida(id: string): Promise<void> {
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<LinhaCorrida & { agora_ms: number }>(
      `select ${COLUNAS_CORRIDA},
              (extract(epoch from clock_timestamp()) * 1000)::float8 as agora_ms
         from corrida c where c.id = $1 for update skip locked`,
      [id],
    );
    if (!rows[0]) return;
    let corrida = corridaDeLinha(rows[0]);
    const agoraMs = rows[0].agora_ms;

    // 1) O tempo acabou: bandeira no instante exato do prazo.
    const prazo = prazoDaCorrida(corrida);
    if (
      corrida.estado === "em_andamento" &&
      prazo &&
      agoraMs >= prazo.getTime()
    ) {
      await cliente.query(
        "update corrida set estado = 'encerrando', encerrando_em = $2 where id = $1",
        [id, prazo],
      );
      await registrarAuditoria(
        {
          acao: "corrida.tempo_esgotado",
          entidade: "corrida",
          entidadeId: id,
          depois: { prazo: prazo.toISOString() },
        },
        cliente,
      );
      corrida = { ...corrida, estado: "encerrando", encerrandoEm: prazo };
    }
    if (corrida.estado !== "encerrando" || !corrida.encerrandoEm) return;

    // 2) Regra de encerramento configurada.
    const bandeiraMs = corrida.encerrandoEm.getTime();
    if (corrida.modoEncerramento === "corte_imediato") {
      await finalizarInterno(
        cliente,
        id,
        corrida.encerrandoEm,
        null,
        null,
        "corte_imediato",
      );
      return;
    }
    if (corrida.modoEncerramento === "proxima_passagem") {
      const limiteMs = bandeiraMs + corrida.esperaFinalS * 1000;
      const grid = await listarPilotos(consultaDe(cliente), id);
      const { resultado } = await carregarEntrada(
        consultaDe(cliente),
        corrida,
        grid,
        agoraMs,
      );
      const faltam = resultado.classificacao.filter(
        (l) => l.transponder && l.situacao === "em_pista",
      );
      if (faltam.length === 0) {
        await finalizarInterno(
          cliente,
          id,
          null,
          null,
          null,
          "todos_terminaram",
        );
      } else if (agoraMs >= limiteMs) {
        await finalizarInterno(
          cliente,
          id,
          new Date(limiteMs),
          null,
          null,
          "espera_final_esgotada",
        );
      }
    }
    // modo "manual": o operador finaliza.
  });
}

export async function avancarCorridas(): Promise<void> {
  const ativas = await consultar<{ id: string }>(
    "select id from corrida where estado in ('em_andamento', 'encerrando')",
  );
  for (const { id } of ativas) await avancarCorrida(id);
}

// --------------------------------------------------------- Correções

// Invalida uma passagem (ex.: leitura falsa). A passagem original continua no
// banco; a correção fica registrada e pode ser anulada.
export async function invalidarPassagem(
  corridaId: string,
  passagemId: string,
  motivoBruto: string,
  ator: Ator,
): Promise<void> {
  const motivo = motivoBruto.trim();
  if (motivo.length < 3) throw new ErroNegocio("Informe o motivo da correção.");
  if (!/^\d+$/.test(passagemId)) throw new ErroNegocio("Passagem inválida.");
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, corridaId);
    if (corrida.estado === "cancelada") {
      throw new ErroNegocio("Esta bateria foi cancelada.");
    }
    const { rowCount } = await cliente.query(
      "select 1 from passagem where id = $1",
      [passagemId],
    );
    if (!rowCount) throw new ErroNegocio("Passagem não encontrada.");
    const jaInvalidada = await cliente.query(
      `select 1 from correcao_passagem
        where corrida_id = $1 and passagem_id = $2 and anulada_em is null`,
      [corridaId, passagemId],
    );
    if (jaInvalidada.rowCount) {
      throw new ErroNegocio("Essa passagem já está invalidada.");
    }
    const id = `correcao-${randomUUID()}`;
    await cliente.query(
      `insert into correcao_passagem (id, corrida_id, tipo, passagem_id, motivo, criado_por)
       values ($1, $2, 'invalidar', $3, $4, $5)`,
      [id, corridaId, passagemId, motivo, ator.usuarioId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.passagem_invalidar",
        entidade: "correcao_passagem",
        entidadeId: id,
        depois: { corridaId, passagemId },
        motivo,
      },
      cliente,
    );
  });
}

// Insere uma passagem que o decoder deixou de ler (marcada como manual).
export async function inserirPassagemManual(
  corridaId: string,
  pilotoId: string,
  instanteMs: number,
  motivoBruto: string,
  ator: Ator,
): Promise<void> {
  const motivo = motivoBruto.trim();
  if (motivo.length < 3) throw new ErroNegocio("Informe o motivo da correção.");
  if (!Number.isFinite(instanteMs)) throw new ErroNegocio("Horário inválido.");
  await transacao(async (cliente) => {
    const corrida = await corridaParaAlterar(cliente, corridaId);
    if (!corrida.iniciadaEm || corrida.estado === "cancelada") {
      throw new ErroNegocio("A bateria ainda não começou ou foi cancelada.");
    }
    const { rows } = await cliente.query<{ transponder: string | null }>(
      "select transponder from corrida_piloto where id = $1 and corrida_id = $2",
      [pilotoId, corridaId],
    );
    if (!rows[0]) throw new ErroNegocio("Piloto não encontrado nesta bateria.");
    if (!rows[0].transponder) {
      throw new ErroNegocio("Este piloto não tem sensor.");
    }
    const fim = corrida.encerradaEm?.getTime() ?? Date.now();
    if (instanteMs < corrida.iniciadaEm.getTime() || instanteMs > fim) {
      throw new ErroNegocio("O horário precisa estar dentro da bateria.");
    }
    const id = `correcao-${randomUUID()}`;
    await cliente.query(
      `insert into correcao_passagem (id, corrida_id, tipo, transponder, instante, motivo, criado_por)
       values ($1, $2, 'inserir', $3, to_timestamp($4::float8 / 1000.0), $5, $6)`,
      [id, corridaId, rows[0].transponder, instanteMs, motivo, ator.usuarioId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.passagem_inserir",
        entidade: "correcao_passagem",
        entidadeId: id,
        depois: { corridaId, transponder: rows[0].transponder, instanteMs },
        motivo,
      },
      cliente,
    );
  });
}

export async function anularCorrecao(
  correcaoId: string,
  motivoBruto: string,
  ator: Ator,
): Promise<void> {
  const motivo = motivoBruto.trim();
  if (motivo.length < 3) throw new ErroNegocio("Informe o motivo.");
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<{
      corrida_id: string;
      anulada_em: Date | null;
    }>(
      "select corrida_id, anulada_em from correcao_passagem where id = $1 for update",
      [correcaoId],
    );
    if (!rows[0]) throw new ErroNegocio("Correção não encontrada.");
    if (rows[0].anulada_em) {
      throw new ErroNegocio("Essa correção já foi anulada.");
    }
    await cliente.query(
      `update correcao_passagem
          set anulada_em = clock_timestamp(), anulada_por = $2, motivo_anulacao = $3
        where id = $1`,
      [correcaoId, ator.usuarioId, motivo],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.correcao_anular",
        entidade: "correcao_passagem",
        entidadeId: correcaoId,
        depois: { corridaId: rows[0].corrida_id },
        motivo,
      },
      cliente,
    );
  });
}

// Dá um nome amigável ao sensor (ex.: "Kart 7").
export async function rotularSensor(
  codigo: string,
  rotuloBruto: string,
  ator: Ator,
): Promise<void> {
  const rotulo = rotuloBruto.trim();
  if (rotulo.length > 40) throw new ErroNegocio("Nome longo demais.");
  if (!REGEX_SENSOR.test(codigo)) throw new ErroNegocio("Sensor inválido.");
  await transacao(async (cliente) => {
    const { rowCount } = await cliente.query(
      "update transponder set rotulo = $2, atualizado_em = clock_timestamp() where codigo = $1",
      [codigo, rotulo || null],
    );
    if (!rowCount) throw new ErroNegocio("Sensor não encontrado.");
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "transponder.rotular",
        entidade: "transponder",
        entidadeId: codigo,
        depois: { rotulo: rotulo || null },
      },
      cliente,
    );
  });
}

// ------------------------------------------------------------ Leitura

export async function lerCorrida(id: string): Promise<Corrida | null> {
  const linhas = await consultar<LinhaCorrida>(
    `select ${COLUNAS_CORRIDA} from corrida c where c.id = $1`,
    [id],
  );
  return linhas[0] ? corridaDeLinha(linhas[0]) : null;
}

export async function corridaAtiva(): Promise<Corrida | null> {
  const linhas = await consultar<LinhaCorrida>(
    `select ${COLUNAS_CORRIDA} from corrida c
      where c.estado in ('em_andamento', 'encerrando') limit 1`,
  );
  return linhas[0] ? corridaDeLinha(linhas[0]) : null;
}

export async function listarCorridas(limite = 30): Promise<CorridaResumo[]> {
  const linhas = await consultar<
    LinhaCorrida & { pilotos: number; com_sensor: number }
  >(
    `select ${COLUNAS_CORRIDA},
            (select count(*) from corrida_piloto p where p.corrida_id = c.id)::int as pilotos,
            (select count(*) from corrida_piloto p
              where p.corrida_id = c.id and p.transponder is not null)::int as com_sensor
       from corrida c
      order by coalesce(c.iniciada_em, c.criado_em) desc
      limit $1`,
    [limite],
  );
  return linhas.map((l) => ({
    ...corridaDeLinha(l),
    pilotos: l.pilotos,
    comSensor: l.com_sensor,
  }));
}

// Baterias da agenda ainda sem corrida (candidatas a virar uma).
export async function bateriasSemCorrida(
  inicio: Date,
  fim: Date,
): Promise<{ id: string; inicio: Date; pilotos: number }[]> {
  return consultar<{ id: string; inicio: Date; pilotos: number }>(
    `select s.id, s.inicio,
            coalesce((select sum(r.pilotos) from reserva r
                       where r.slot_id = s.id and r.status = 'reservada'), 0)::int as pilotos
       from bateria_slot s
      where s.inicio >= $1 and s.inicio < $2 and s.cancelada_em is null
        and not exists (select 1 from corrida c where c.slot_id = s.id)
      order by s.inicio`,
    [inicio, fim],
  );
}

async function fasesDaBateria(
  q: Consulta,
  corrida: Corrida,
): Promise<PainelDaCorrida["fases"]> {
  if (corrida.fase === "unica") return undefined;
  const eu: FaseVinculada = { id: corrida.id, estado: corrida.estado };
  if (corrida.fase === "classificacao") {
    const [c] = await q<FaseVinculada>(
      "select id, estado from corrida where classificacao_id = $1 limit 1",
      [corrida.id],
    );
    return { classificacao: eu, corrida: c };
  }
  const [k] = corrida.classificacaoId
    ? await q<FaseVinculada>("select id, estado from corrida where id = $1", [
        corrida.classificacaoId,
      ])
    : [];
  return { classificacao: k, corrida: eu };
}

async function listarPilotos(
  q: Consulta,
  corridaId: string,
): Promise<PilotoDaCorrida[]> {
  const linhas = await q<{
    id: string;
    nome: string;
    cliente_id: string | null;
    transponder: string | null;
    rotulo: string | null;
    t_status: string | null;
    t_cadastrado: boolean | null;
    kart_id: string | null;
    kart_numero: string | null;
    nomeado: boolean;
    sensores_extras: string[];
    armada: boolean;
    cliente_numero: number | null;
    reserva_id: string | null;
    reserva_piloto_id: string | null;
    posicao_grid: number | null;
    presente_em: Date | null;
    situacao_manual: "dns" | "dnf" | "dsq" | null;
    penalidade_ms: number;
    ocorrencia_motivo: string | null;
  }>(
    `select p.id, p.nome, p.cliente_id, p.transponder, t.rotulo,
            t.status as t_status, t.cadastrado as t_cadastrado,
            p.kart_id, p.kart_numero, p.nomeado, p.sensores_extras,
            (p.captura_armada_em is not null) as armada,
            cl.numero as cliente_numero, p.reserva_id,
            rp.id as reserva_piloto_id, p.posicao_grid,
            p.presente_em, p.situacao_manual, p.penalidade_ms, p.ocorrencia_motivo
       from corrida_piloto p
       left join transponder t on t.codigo = p.transponder
       left join cliente cl on cl.id = p.cliente_id
       left join reserva_piloto rp
              on rp.reserva_id = p.reserva_id and rp.cliente_id = p.cliente_id
      where p.corrida_id = $1
      order by p.posicao_grid nulls last, p.criado_em, p.id`,
    [corridaId],
  );
  const comTermo = await clientesComTermoValido(
    linhas.flatMap((l) => (l.cliente_id ? [l.cliente_id] : [])),
  );
  const pagamentos = await pagamentosDasReservas([
    ...new Set(linhas.flatMap((l) => (l.reserva_id ? [l.reserva_id] : []))),
  ]);
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    clienteId: l.cliente_id ?? undefined,
    clienteNumero: l.cliente_numero ?? undefined,
    vaga: l.cliente_id === null && l.reserva_id !== null,
    reservaId: l.reserva_id ?? undefined,
    reservaPilotoId: l.reserva_piloto_id ?? undefined,
    pagamento: l.reserva_piloto_id
      ? pagamentos.get(l.reserva_piloto_id)
      : undefined,
    apto:
      l.cliente_id !== null && comTermo.has(l.cliente_id) && l.kart_id !== null,
    posicaoGrid: l.posicao_grid ?? undefined,
    presenteEm: l.presente_em ?? undefined,
    situacaoManual: l.situacao_manual ?? undefined,
    penalidadeMs: l.penalidade_ms,
    ocorrenciaMotivo: l.ocorrencia_motivo ?? undefined,
    termo: !l.cliente_id
      ? "sem_cadastro"
      : comTermo.has(l.cliente_id)
        ? "valido"
        : "pendente",
    transponder: l.transponder ?? undefined,
    rotulo: l.rotulo ?? undefined,
    transponderStatus: l.t_status ?? undefined,
    transponderCadastrado: l.t_cadastrado ?? undefined,
    kartId: l.kart_id ?? undefined,
    kartNumero: l.kart_numero ?? undefined,
    capturaArmada: l.armada,
    sensoresExtras: l.sensores_extras ?? [],
    nomeado: l.nomeado,
  }));
}

interface InfoPassagem {
  decoderNome: string;
  simulado: boolean;
}

// Reúne tudo que o motor precisa (passagens, correções) e o executa.
async function carregarEntrada(
  q: Consulta,
  corrida: Corrida,
  grid: PilotoDaCorrida[],
  agoraMs: number,
) {
  const encerradaEm = (corrida.encerradaEm ?? corrida.canceladaEm)?.getTime();
  const fimMs = encerradaEm ?? agoraMs;
  // Depois que a corrida acaba, ainda mostramos (como "depois do fim") as
  // leituras dos sensores DESTA corrida nos minutos seguintes: nada some.
  const fimJanelaMs =
    fimMs + (encerradaEm === undefined ? 0 : JANELA_POS_FIM_MS);
  const inicioMs =
    (corrida.iniciadaEm?.getTime() ?? agoraMs) - JANELA_PRE_LARGADA_MS;

  const passagensBrutas = await q<{
    id: string;
    transponder: string;
    ms: number;
    decoder_nome: string;
    driver: string;
  }>(
    `select p.id::text, p.transponder,
            round(extract(epoch from p.instante) * 1000)::float8 as ms,
            d.nome as decoder_nome, d.driver
       from passagem p join decoder d on d.id = p.decoder_id
      where p.instante >= to_timestamp($1::float8 / 1000.0)
        and p.instante <= to_timestamp($2::float8 / 1000.0)
        and (p.instante <= to_timestamp($4::float8 / 1000.0)
             or p.transponder = any($3::text[]))
      order by p.instante, p.id
      limit 5000`,
    [
      inicioMs,
      fimJanelaMs,
      grid.flatMap((p) =>
        [p.transponder, ...p.sensoresExtras].filter((s): s is string =>
          Boolean(s),
        ),
      ),
      fimMs,
    ],
  );
  const correcoes = await listarCorrecoes(q, corrida.id);

  const info = new Map<string, InfoPassagem>();
  const passagens: PassagemMotor[] = passagensBrutas.map((p) => {
    info.set(p.id, {
      decoderNome: p.decoder_nome,
      simulado: p.driver === "simulador",
    });
    return {
      id: p.id,
      transponder: p.transponder,
      instanteMs: p.ms,
      origem: "decoder",
    };
  });
  for (const c of correcoes) {
    if (
      c.anulada ||
      c.tipo !== "inserir" ||
      !c.transponder ||
      c.instanteMs === undefined
    ) {
      continue;
    }
    passagens.push({
      id: `manual-${c.id}`,
      transponder: c.transponder,
      instanteMs: c.instanteMs,
      origem: "manual",
    });
  }

  const config: ConfigMotor = {
    tempoMinimoMs: corrida.tempoMinimoMs,
    regraLargada: corrida.regraLargada,
    modoEncerramento: corrida.modoEncerramento,
    iniciadaEmMs: corrida.iniciadaEm?.getTime() ?? null,
    encerrandoEmMs: corrida.encerrandoEm?.getTime() ?? null,
    finalizadaEmMs:
      (corrida.encerradaEm ?? corrida.canceladaEm)?.getTime() ?? null,
  };
  const resultado: ResultadoMotor = avaliarCorrida({
    config,
    participantes: grid.map((p) => ({
      id: p.id,
      nome: p.nome,
      transponder: p.transponder ?? null,
      transponders: p.sensoresExtras,
      kartNumero: p.kartNumero ?? null,
      situacaoManual: p.situacaoManual ?? null,
      penalidadeMs: p.penalidadeMs,
    })),
    passagens,
    invalidacoes: correcoes
      .filter((c) => !c.anulada && c.tipo === "invalidar" && c.passagemId)
      .map((c) => ({ passagemId: c.passagemId as string, motivo: c.motivo })),
  });
  return { resultado, info, correcoes, passagens };
}

async function listarCorrecoes(
  q: Consulta,
  corridaId: string,
): Promise<CorrecaoDaCorrida[]> {
  const linhas = await q<{
    id: string;
    tipo: "invalidar" | "inserir";
    passagem_id: string | null;
    transponder: string | null;
    instante_ms: number | null;
    motivo: string;
    criado_por: string | null;
    criado_em: Date;
    anulada_em: Date | null;
    motivo_anulacao: string | null;
  }>(
    `select id, tipo, passagem_id::text, transponder,
            round(extract(epoch from instante) * 1000)::float8 as instante_ms,
            motivo, criado_por, criado_em, anulada_em, motivo_anulacao
       from correcao_passagem where corrida_id = $1 order by criado_em`,
    [corridaId],
  );
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    passagemId: l.passagem_id ?? undefined,
    transponder: l.transponder ?? undefined,
    instanteMs: l.instante_ms ?? undefined,
    motivo: l.motivo,
    criadoPor: l.criado_por ?? undefined,
    criadoEm: l.criado_em,
    anulada: l.anulada_em !== null,
    motivoAnulacao: l.motivo_anulacao ?? undefined,
  }));
}

function assinatura(linhas: LinhaClassificacao[]): string {
  return linhas
    .map(
      (l) => `${l.participanteId}:${l.posicao}:${l.voltas}:${l.melhorVoltaMs}`,
    )
    .join("|");
}

// Tudo que a tela da corrida precisa, numa leitura só (e com o relógio do
// servidor já avançado).
export async function lerPainel(
  corridaId: string,
): Promise<PainelDaCorrida | null> {
  await avancarCorrida(corridaId);
  const corrida = await lerCorrida(corridaId);
  if (!corrida) return null;
  const q = consultaDoPool;
  const [{ agora_ms: agoraMs }] = await q<{ agora_ms: number }>(
    "select (extract(epoch from clock_timestamp()) * 1000)::float8 as agora_ms",
  );
  const grid = await listarPilotos(q, corridaId);
  const fases = await fasesDaBateria(q, corrida);
  const [responsavel] = corrida.responsavelClienteId
    ? await q<ResponsavelDaBateria>(
        "select id, numero, nome, telefone from cliente where id = $1",
        [corrida.responsavelClienteId],
      )
    : [];
  const { resultado, info, correcoes, passagens } = await carregarEntrada(
    q,
    corrida,
    grid,
    agoraMs,
  );

  const porParticipante = new Map(grid.map((p) => [p.id, p]));
  const historico: PassagemDoHistorico[] = resultado.passagens
    .map((a) => {
      const participante = a.participanteId
        ? porParticipante.get(a.participanteId)
        : undefined;
      const sobre = info.get(a.passagem.id);
      return {
        id: a.passagem.id,
        instanteMs: a.passagem.instanteMs,
        transponder: a.passagem.transponder,
        participante: participante?.nome,
        kartNumero: participante?.kartNumero,
        status: a.status,
        motivo: a.motivo,
        contada: a.contada,
        numeroVolta: a.numeroVolta,
        tempoVoltaMs: a.tempoVoltaMs,
        decoderNome: sobre?.decoderNome,
        simulado: sobre?.simulado ?? false,
        origem: a.passagem.origem,
      };
    })
    // Leituras de sensores sem piloto antes da largada não fazem parte da
    // corrida (ficam só na lista de "sensores lidos").
    .filter(
      (h) =>
        h.status !== "sem_participante" ||
        (corrida.iniciadaEm !== null &&
          h.instanteMs >= corrida.iniciadaEm.getTime()),
    )
    .sort((a, b) => b.instanteMs - a.instanteMs);

  // Sensores lidos que ainda não têm piloto nesta bateria.
  const donos = new Set(
    grid.flatMap((p) =>
      [p.transponder, ...p.sensoresExtras].filter((s): s is string =>
        Boolean(s),
      ),
    ),
  );
  const vistos = new Map<string, { leituras: number; ultimaMs: number }>();
  for (const p of passagens) {
    if (p.origem !== "decoder" || donos.has(p.transponder)) continue;
    const v = vistos.get(p.transponder) ?? { leituras: 0, ultimaMs: 0 };
    v.leituras += 1;
    v.ultimaMs = Math.max(v.ultimaMs, p.instanteMs);
    vistos.set(p.transponder, v);
  }
  const cadastro = vistos.size
    ? await q<{
        codigo: string;
        rotulo: string | null;
        cadastrado: boolean;
        status: string;
      }>(
        "select codigo, rotulo, cadastrado, status from transponder where codigo = any($1)",
        [[...vistos.keys()]],
      )
    : [];
  const encerrada =
    corrida.estado === "finalizada" || corrida.estado === "cancelada";
  const detectados: SensorDetectado[] = encerrada
    ? []
    : cadastro
        .map((c) => ({
          transponder: c.codigo,
          rotulo: c.rotulo ?? undefined,
          cadastrado: c.cadastrado,
          status: c.status,
          leituras: vistos.get(c.codigo)?.leituras ?? 0,
          ultimaMs: vistos.get(c.codigo)?.ultimaMs ?? 0,
        }))
        .sort((a, b) => b.ultimaMs - a.ultimaMs);

  const alertas: Alerta[] = [];
  // No modelo "kart" os sensores dos karts cadastrados entram sozinhos na
  // bateria: só alarma o sensor que não é de nenhum kart.
  let alarmantes = detectados;
  if (detectados.length > 0 && (await lerModeloDeVinculo()) === "kart") {
    const deKart = new Set(
      (
        await q<{ transponder: string }>(
          "select transponder from kart_sensor where transponder = any($1) and removido_em is null",
          [detectados.map((d) => d.transponder)],
        )
      ).map((k) => k.transponder),
    );
    alarmantes = detectados.filter((d) => !deKart.has(d.transponder));
  }
  if (alarmantes.length > 0) {
    const desconhecidos = alarmantes.filter((d) => !d.cadastrado).length;
    alertas.push({
      nivel: "aviso",
      texto:
        `${alarmantes.length} sensor(es) lido(s) sem piloto nesta bateria` +
        (desconhecidos > 0
          ? ` (${desconhecidos} desconhecido(s): ainda não cadastrado(s))`
          : "") +
        ".",
    });
  }
  for (const p of grid) {
    if (
      p.transponder &&
      p.transponderStatus &&
      p.transponderStatus !== "ativo"
    ) {
      alertas.push({
        nivel: "erro",
        texto: `O transponder de ${p.nome} está ${p.transponderStatus === "manutencao" ? "em manutenção" : "inativo"}.`,
      });
    }
  }
  if (historico.some((h) => h.simulado)) {
    alertas.push({
      nivel: "aviso",
      texto:
        "Há passagens do SIMULADOR nesta bateria: não vieram do decoder real.",
    });
  }
  const naoContadas = historico.filter(
    (h) =>
      !h.contada &&
      h.status !== "sem_participante" &&
      h.status !== "antes_da_largada",
  ).length;
  if (naoContadas > 0) {
    alertas.push({
      nivel: "aviso",
      texto: `${naoContadas} leitura(s) não contada(s): veja o motivo no histórico de passagens.`,
    });
  }
  if (corrida.estado === "encerrando") {
    alertas.push({
      nivel: "aviso",
      texto:
        corrida.modoEncerramento === "manual"
          ? "Tempo esgotado: as passagens continuam valendo até o operador finalizar."
          : corrida.modoEncerramento === "proxima_passagem"
            ? "Tempo esgotado: cada piloto termina na próxima passagem."
            : "Tempo esgotado.",
    });
  }

  const prazo = prazoDaCorrida(corrida);
  return {
    corrida,
    fases,
    responsavel,
    grid,
    classificacao: resultado.classificacao,
    historico,
    detectados,
    correcoes,
    alertas,
    agoraMs,
    prazoMs: prazo?.getTime() ?? null,
    totalPassagens: passagens.filter((p) => p.origem === "decoder").length,
    corrigidaAposPublicar:
      corrida.resultadoFinal !== null &&
      assinatura(corrida.resultadoFinal.classificacao) !==
        assinatura(resultado.classificacao),
  };
}

// ------------------------------------------------ Check-in e ocorrências

// Check-in: o piloto confirmou presença na recepção (antes de a bateria
// terminar). Desfazer também é auditado.
export async function registrarPresenca(
  pilotoId: string,
  presente: boolean,
  ator: Ator,
): Promise<void> {
  await transacao(async (cliente) => {
    const piloto = await pilotoParaAlterar(cliente, pilotoId);
    const { rows } = await cliente.query<{ estado: EstadoCorrida }>(
      "select estado from corrida where id = $1",
      [piloto.corrida_id],
    );
    if (["finalizada", "cancelada"].includes(rows[0]?.estado)) {
      throw new ErroNegocio("Esta bateria já terminou.");
    }
    await cliente.query(
      `update corrida_piloto
          set presente_em = case when $2 then clock_timestamp() else null end
        where id = $1`,
      [pilotoId, presente],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: presente ? "corrida.checkin" : "corrida.checkin_desfazer",
        entidade: "corrida_piloto",
        entidadeId: pilotoId,
        depois: { corridaId: piloto.corrida_id },
      },
      cliente,
    );
  });
}

export const PENALIDADE_MAXIMA_S = 3600;

// Ocorrência do operador sobre um participante: DNS, DNF ou DSQ (ou nenhuma,
// para desfazer) e penalidade em segundos. Exige motivo e fica auditada; depois
// da bateria finalizada vale como correção do resultado (o resultado publicado
// é mantido e o painel mostra que houve alteração).
export async function registrarOcorrencia(
  pilotoId: string,
  dados: {
    situacao: "dns" | "dnf" | "dsq" | null;
    penalidadeS: number;
    motivo: string;
  },
  ator: Ator,
): Promise<void> {
  const motivo = dados.motivo.trim();
  if (motivo.length < 3) throw new ErroNegocio("Informe o motivo.");
  if (
    !Number.isInteger(dados.penalidadeS) ||
    dados.penalidadeS < 0 ||
    dados.penalidadeS > PENALIDADE_MAXIMA_S
  ) {
    throw new ErroNegocio(
      `Penalidade: de 0 a ${PENALIDADE_MAXIMA_S} segundos.`,
    );
  }
  if (dados.situacao && !["dns", "dnf", "dsq"].includes(dados.situacao)) {
    throw new ErroNegocio("Situação inválida.");
  }
  await transacao(async (cliente) => {
    // Vale também depois de encerrada (correção do resultado), por isso não
    // usa pilotoParaAlterar; só a bateria cancelada fica de fora.
    const { rows } = await cliente.query<{ estado: EstadoCorrida }>(
      `select c.estado from corrida_piloto p join corrida c on c.id = p.corrida_id
        where p.id = $1 for update of p`,
      [pilotoId],
    );
    if (!rows[0]) throw new ErroNegocio("Piloto não encontrado.");
    if (rows[0].estado === "cancelada") {
      throw new ErroNegocio("Esta bateria foi cancelada.");
    }
    const { rows: antes } = await cliente.query<{
      situacao_manual: string | null;
      penalidade_ms: number;
    }>(
      "select situacao_manual, penalidade_ms from corrida_piloto where id = $1",
      [pilotoId],
    );
    await cliente.query(
      `update corrida_piloto
          set situacao_manual = $2, penalidade_ms = $3, ocorrencia_motivo = $4
        where id = $1`,
      [pilotoId, dados.situacao, dados.penalidadeS * 1000, motivo],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "corrida.ocorrencia",
        entidade: "corrida_piloto",
        entidadeId: pilotoId,
        antes: antes[0],
        depois: {
          situacao: dados.situacao,
          penalidadeMs: dados.penalidadeS * 1000,
          estadoDaBateria: rows[0].estado,
        },
        motivo,
      },
      cliente,
    );
  });
}
