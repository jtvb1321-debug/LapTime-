import { createHash, randomBytes, randomUUID } from "node:crypto";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import {
  avancarCorridas,
  entrarKartsAutomaticamente,
  vincularPorCaptura,
} from "@/lib/cronometragem/corridas-store";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";

// Coletor sem sinal há mais que isto = "coletor offline".
export const SINAL_VALIDO_MS = 30_000;
export const MAX_PASSAGENS_POR_LOTE = 500;
export const MAX_EVENTOS_POR_LOTE = 50;
// Diagnósticos (eventos rejeitados e de conexão) são apagados depois disto.
export const RETENCAO_DIAGNOSTICO_DIAS = 90;
const MIN_INSTANTE_MS = Date.UTC(2020, 0, 1);
const TOLERANCIA_FUTURO_MS = 5 * 60_000;

export type EstadoConexao =
  "desativado" | "coletor_offline" | "decoder_desconectado" | "conectado";

export interface Decoder {
  id: string;
  nome: string;
  driver: string;
  // O simulador não é um equipamento: a tela precisa avisar.
  simulado: boolean;
  modelo?: string;
  endereco?: string;
  ativo: boolean;
  estadoConexao: EstadoConexao;
  conectadoDesde: Date | null;
  ultimoSinal: Date | null;
  ultimaPassagem: Date | null;
  ultimoErro?: string;
  ultimoErroEm: Date | null;
  passagens24h: number;
  info?: InfoDoDriver;
  // Cadastrado sozinho pelo computador da pista.
  automatico: boolean;
}

export interface PassagemEntrada {
  transponder: string;
  instanteMs: number;
  relogio: "decoder" | "coletor";
  forca: number | null;
  bruto: string | null;
  eventoExterno: string | null;
}

export interface Rejeicao {
  motivo: string;
  transponder: string | null;
  bruto: string | null;
}

// Informações extras que o driver relata (ex.: CalX Pro: ruído da antena).
export type InfoDoDriver = Record<string, string | number>;

export interface EstadoDoDriver {
  conectado: boolean;
  erro?: string;
  info?: InfoDoDriver;
}

export type TipoEventoDriver =
  "coletor_iniciado" | "conectado" | "desconectado" | "erro";

export interface EventoDoDriver {
  tipo: TipoEventoDriver;
  detalhe: string | null;
  ocorridoEmMs: number;
}

export interface PassagemRecente {
  id: string;
  decoderNome: string;
  simulado: boolean;
  transponder: string;
  rotulo?: string;
  instanteMs: number;
  relogio: "decoder" | "coletor";
  forca: number | null;
}

function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function novoToken(): string {
  return `gl_dec_${randomBytes(24).toString("hex")}`;
}

function resumo(valor: unknown): string | null {
  if (valor === undefined) return null;
  try {
    return JSON.stringify(valor).slice(0, 400);
  } catch {
    return null;
  }
}

// Validação de um lote vindo do coletor. Item inválido NÃO derruba o lote
// (um registro ruim não pode travar a fila de passagens boas) e também não
// some: volta em `rejeitadas` com o motivo, e é gravado em evento_rejeitado.
export function validarPassagens(entrada: unknown): {
  validas: PassagemEntrada[];
  rejeitadas: Rejeicao[];
} {
  if (!Array.isArray(entrada)) {
    throw new ErroNegocio("Envie as passagens como uma lista.");
  }
  if (entrada.length > MAX_PASSAGENS_POR_LOTE) {
    throw new ErroNegocio(
      `No máximo ${MAX_PASSAGENS_POR_LOTE} passagens por envio.`,
    );
  }
  const limite = Date.now() + TOLERANCIA_FUTURO_MS;
  const validas: PassagemEntrada[] = [];
  const rejeitadas: Rejeicao[] = [];

  for (const item of entrada) {
    const p = (item ?? {}) as Record<string, unknown>;
    const transponder =
      typeof p.transponder === "string" ? p.transponder.trim() : "";
    const rejeitar = (motivo: string) =>
      rejeitadas.push({
        motivo,
        transponder: /^[A-Za-z0-9_-]{1,32}$/.test(transponder)
          ? transponder
          : null,
        bruto: resumo(item),
      });

    if (!/^[A-Za-z0-9_-]{1,32}$/.test(transponder)) {
      rejeitar("código de transponder inválido");
      continue;
    }
    const instanteMs = p.instanteMs;
    if (typeof instanteMs !== "number" || !Number.isFinite(instanteMs)) {
      rejeitar("instante inválido");
      continue;
    }
    if (instanteMs < MIN_INSTANTE_MS || instanteMs > limite) {
      rejeitar("instante fora do esperado (relógio do decoder errado?)");
      continue;
    }
    const forca = p.forca;
    if (
      forca !== undefined &&
      forca !== null &&
      !(Number.isInteger(forca) && (forca as number) >= 0)
    ) {
      rejeitar("força inválida");
      continue;
    }
    const eventoExterno =
      typeof p.eventoExterno === "string" && p.eventoExterno.trim()
        ? p.eventoExterno.trim().slice(0, 64)
        : null;
    validas.push({
      transponder,
      instanteMs,
      relogio: p.relogio === "coletor" ? "coletor" : "decoder",
      forca: typeof forca === "number" ? forca : null,
      bruto: typeof p.bruto === "string" ? p.bruto.slice(0, 400) : null,
      eventoExterno,
    });
  }
  return { validas, rejeitadas };
}

const TIPOS_EVENTO: TipoEventoDriver[] = [
  "coletor_iniciado",
  "conectado",
  "desconectado",
  "erro",
];

// Estado e eventos de conexão informados pelo coletor (opcionais no lote).
function validarInfo(bruto: unknown): InfoDoDriver | undefined {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
    return undefined;
  }
  const info: InfoDoDriver = {};
  for (const [chave, valor] of Object.entries(bruto).slice(0, 12)) {
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(chave)) continue;
    if (typeof valor === "number" && Number.isFinite(valor)) {
      info[chave] = valor;
    } else if (typeof valor === "string") {
      info[chave] = valor.slice(0, 80);
    }
  }
  return Object.keys(info).length ? info : undefined;
}

export function validarDiagnostico(corpo: {
  estado?: unknown;
  eventos?: unknown;
}): { estado: EstadoDoDriver | null; eventos: EventoDoDriver[] } {
  let estado: EstadoDoDriver | null = null;
  if (corpo.estado && typeof corpo.estado === "object") {
    const e = corpo.estado as Record<string, unknown>;
    if (typeof e.conectado === "boolean") {
      estado = {
        conectado: e.conectado,
        erro: typeof e.erro === "string" ? e.erro.slice(0, 300) : undefined,
        info: validarInfo(e.info),
      };
    }
  }
  const eventos: EventoDoDriver[] = [];
  if (Array.isArray(corpo.eventos)) {
    for (const bruto of corpo.eventos.slice(0, MAX_EVENTOS_POR_LOTE)) {
      const e = (bruto ?? {}) as Record<string, unknown>;
      if (!TIPOS_EVENTO.includes(e.tipo as TipoEventoDriver)) continue;
      const quando =
        typeof e.instanteMs === "number" && Number.isFinite(e.instanteMs)
          ? e.instanteMs
          : Date.now();
      eventos.push({
        tipo: e.tipo as TipoEventoDriver,
        detalhe: typeof e.detalhe === "string" ? e.detalhe.slice(0, 300) : null,
        // Hora absurda não é confiável: usa a do recebimento.
        ocorridoEmMs:
          quando < MIN_INSTANTE_MS || quando > Date.now() + TOLERANCIA_FUTURO_MS
            ? Date.now()
            : quando,
      });
    }
  }
  return { estado, eventos };
}

export async function criarDecoder(
  dados: { nome: string; driver: string; endereco?: string; modelo?: string },
  ator: Ator,
): Promise<{ id: string; token: string }> {
  const nome = dados.nome.trim();
  const driver = dados.driver.trim().toLowerCase();
  const endereco = dados.endereco?.trim() || null;
  const modelo = dados.modelo?.trim() || null;
  if (nome.length < 2) throw new ErroNegocio("Dê um nome ao decoder.");
  if (!/^[a-z0-9-]{2,30}$/.test(driver)) {
    throw new ErroNegocio(
      "Driver inválido (use letras minúsculas, números e hífen).",
    );
  }
  if (endereco && endereco.length > 200) {
    throw new ErroNegocio("Endereço longo demais.");
  }
  if (modelo && modelo.length > 80)
    throw new ErroNegocio("Modelo longo demais.");
  const id = `decoder-${randomUUID()}`;
  const token = novoToken();
  await transacao(async (cliente) => {
    await cliente.query(
      `insert into decoder (id, nome, driver, endereco, modelo, token_hash)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, nome, driver, endereco, modelo, hashDoToken(token)],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "decoder.criar",
        entidade: "decoder",
        entidadeId: id,
        depois: { nome, driver, endereco, modelo },
      },
      cliente,
    );
  });
  return { id, token };
}

// Gera outro token e invalida o anterior (use se o token vazar ou se o
// coletor for trocado de computador).
export async function renovarToken(id: string, ator: Ator): Promise<string> {
  const token = novoToken();
  await transacao(async (cliente) => {
    const { rowCount } = await cliente.query(
      "update decoder set token_hash = $2 where id = $1",
      [id, hashDoToken(token)],
    );
    if (!rowCount) throw new ErroNegocio("Decoder não encontrado.");
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "decoder.renovar_token",
        entidade: "decoder",
        entidadeId: id,
      },
      cliente,
    );
  });
  return token;
}

export async function alternarDecoder(
  id: string,
  ativo: boolean,
  ator: Ator,
): Promise<void> {
  await transacao(async (cliente) => {
    const { rowCount } = await cliente.query(
      "update decoder set ativo = $2 where id = $1",
      [id, ativo],
    );
    if (!rowCount) throw new ErroNegocio("Decoder não encontrado.");
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: ativo ? "decoder.ativar" : "decoder.desativar",
        entidade: "decoder",
        entidadeId: id,
      },
      cliente,
    );
  });
}

// Decoder dono do token (só se estiver ativo); null se o token não vale.
export async function autenticarDecoder(
  token: string,
): Promise<{ id: string; nome: string } | null> {
  if (!token.startsWith("gl_dec_")) return null;
  const linhas = await consultar<{ id: string; nome: string }>(
    "select id, nome from decoder where token_hash = $1 and ativo",
    [hashDoToken(token)],
  );
  return linhas[0] ?? null;
}

interface OpcoesRegistro {
  rejeitadas?: Rejeicao[];
  estado?: EstadoDoDriver | null;
  eventos?: EventoDoDriver[];
  ip?: string | null;
}

// Grava o lote (idempotente: reenviar a mesma passagem não duplica), guarda o
// que foi rejeitado e o diagnóstico de conexão, e marca o coletor como vivo.
// Lote vazio = só um batimento.
export async function registrarPassagens(
  decoderId: string,
  passagens: PassagemEntrada[],
  opcoes: OpcoesRegistro = {},
): Promise<{ gravadas: number; repetidas: number; rejeitadas: number }> {
  const rejeitadas = opcoes.rejeitadas ?? [];
  const resultado = await transacao(async (cliente) => {
    let gravadas = 0;
    if (passagens.length > 0) {
      const { rowCount } = await cliente.query(
        `insert into passagem (decoder_id, transponder, instante, relogio, forca, bruto, evento_externo)
         select $1, t, to_timestamp(i / 1000.0), r, f, b, e
           from unnest($2::text[], $3::float8[], $4::text[], $5::int[], $6::text[], $7::text[])
             as u (t, i, r, f, b, e)
         on conflict do nothing`,
        [
          decoderId,
          passagens.map((p) => p.transponder),
          passagens.map((p) => p.instanteMs),
          passagens.map((p) => p.relogio),
          passagens.map((p) => p.forca),
          passagens.map((p) => p.bruto),
          passagens.map((p) => p.eventoExterno),
        ],
      );
      gravadas = rowCount ?? 0;
      await cliente.query(
        `insert into transponder (codigo)
         select distinct t from unnest($1::text[]) as u (t)
         on conflict (codigo) do nothing`,
        [passagens.map((p) => p.transponder)],
      );
      // Modelo "kart": o kart que passa depois da largada entra sozinho.
      await entrarKartsAutomaticamente(cliente, passagens);
      // Piloto que pediu "capturar o próximo sensor" recebe o primeiro sensor
      // novo (na ordem em que passaram).
      await vincularPorCaptura(
        cliente,
        [...passagens]
          .sort((a, b) => a.instanteMs - b.instanteMs)
          .map((p) => p.transponder),
      );
    }

    for (const r of rejeitadas) {
      await cliente.query(
        `insert into evento_rejeitado (decoder_id, motivo, transponder, bruto)
         values ($1, $2, $3, $4)`,
        [decoderId, r.motivo, r.transponder, r.bruto],
      );
    }
    for (const e of opcoes.eventos ?? []) {
      await cliente.query(
        `insert into decoder_evento (decoder_id, tipo, detalhe, ocorrido_em)
         values ($1, $2, $3, to_timestamp($4::float8 / 1000.0))`,
        [decoderId, e.tipo, e.detalhe, e.ocorridoEmMs],
      );
    }

    const ultima =
      passagens.length > 0
        ? Math.max(...passagens.map((p) => p.instanteMs))
        : null;
    const estado = opcoes.estado ?? null;
    await cliente.query(
      `update decoder
          set ultimo_sinal = now(),
              ultimo_ip = coalesce($3, ultimo_ip),
              ultima_passagem = case
                when $2::float8 is null then ultima_passagem
                else greatest(coalesce(ultima_passagem, 'epoch'), to_timestamp($2::float8 / 1000.0))
              end,
              conectado_desde = case
                when $4::boolean is null then conectado_desde
                when $4 and not conectado then now()
                when not $4 then null
                else conectado_desde
              end,
              conectado = coalesce($4::boolean, conectado),
              ultimo_erro = coalesce($5, ultimo_erro),
              ultimo_erro_em = case when $5::text is null then ultimo_erro_em else now() end,
              info = coalesce($6::jsonb, info)
        where id = $1`,
      [
        decoderId,
        ultima,
        opcoes.ip ?? null,
        estado ? estado.conectado : null,
        estado?.erro ?? null,
        estado?.info ? JSON.stringify(estado.info) : null,
      ],
    );
    return { gravadas, repetidas: passagens.length - gravadas };
  });

  // Uma passagem nova pode completar o encerramento de uma corrida.
  if (passagens.length > 0) await avancarCorridas();
  return { ...resultado, rejeitadas: rejeitadas.length };
}

// Apaga diagnósticos antigos (política de retenção). As passagens e as
// correções NÃO entram nisto: são histórico.
export async function purgarDiagnosticos(
  dias = RETENCAO_DIAGNOSTICO_DIAS,
): Promise<number> {
  const a = await consultar(
    `with apagados as (
       delete from evento_rejeitado
        where recebido_em < now() - make_interval(days => $1) returning 1)
     select count(*)::int as n from apagados`,
    [dias],
  );
  const b = await consultar(
    `with apagados as (
       delete from decoder_evento
        where recebido_em < now() - make_interval(days => $1) returning 1)
     select count(*)::int as n from apagados`,
    [dias],
  );
  return Number(a[0]?.n ?? 0) + Number(b[0]?.n ?? 0);
}

export async function listarDecoders(): Promise<Decoder[]> {
  const linhas = await consultar<{
    id: string;
    nome: string;
    driver: string;
    modelo: string | null;
    endereco: string | null;
    ativo: boolean;
    conectado: boolean;
    conectado_desde: Date | null;
    ultimo_sinal: Date | null;
    ultima_passagem: Date | null;
    ultimo_erro: string | null;
    ultimo_erro_em: Date | null;
    passagens_24h: number;
    info: InfoDoDriver | null;
    computador_id: string | null;
  }>(
    `select d.id, d.nome, d.driver, d.modelo, d.endereco, d.ativo, d.conectado,
            d.conectado_desde, d.ultimo_sinal, d.ultima_passagem, d.ultimo_erro,
            d.ultimo_erro_em, coalesce(c.n, 0)::int as passagens_24h,
            d.info, d.computador_id
       from decoder d
       left join (
         select decoder_id, count(*) as n from passagem
          where instante >= now() - interval '24 hours'
          group by decoder_id
       ) c on c.decoder_id = d.id
      order by d.criado_em`,
  );
  const agora = Date.now();
  return linhas.map((l) => {
    const coletorVivo =
      l.ultimo_sinal !== null &&
      agora - l.ultimo_sinal.getTime() <= SINAL_VALIDO_MS;
    const estadoConexao: EstadoConexao = !l.ativo
      ? "desativado"
      : !coletorVivo
        ? "coletor_offline"
        : l.conectado
          ? "conectado"
          : "decoder_desconectado";
    return {
      id: l.id,
      nome: l.nome,
      driver: l.driver,
      // Endereço 127.x = o simulador do CalX Pro rodando neste computador.
      simulado:
        l.driver === "simulador" || (l.endereco?.startsWith("127.") ?? false),
      modelo: l.modelo ?? undefined,
      endereco: l.endereco ?? undefined,
      ativo: l.ativo,
      estadoConexao,
      conectadoDesde: l.conectado_desde,
      ultimoSinal: l.ultimo_sinal,
      ultimaPassagem: l.ultima_passagem,
      ultimoErro: l.ultimo_erro ?? undefined,
      ultimoErroEm: l.ultimo_erro_em,
      passagens24h: l.passagens_24h,
      info: l.info ?? undefined,
      automatico: l.computador_id !== null,
    };
  });
}

export interface EventoDeConexao {
  id: string;
  decoderNome: string;
  tipo: TipoEventoDriver;
  detalhe?: string;
  ocorridoEm: Date;
}

export async function eventosDeConexao(
  limite = 15,
): Promise<EventoDeConexao[]> {
  const linhas = await consultar<{
    id: string;
    decoder_nome: string;
    tipo: TipoEventoDriver;
    detalhe: string | null;
    ocorrido_em: Date;
  }>(
    `select e.id::text, d.nome as decoder_nome, e.tipo, e.detalhe, e.ocorrido_em
       from decoder_evento e join decoder d on d.id = e.decoder_id
      order by e.id desc limit $1`,
    [limite],
  );
  return linhas.map((l) => ({
    id: l.id,
    decoderNome: l.decoder_nome,
    tipo: l.tipo,
    detalhe: l.detalhe ?? undefined,
    ocorridoEm: l.ocorrido_em,
  }));
}

export async function totalDePassagens(): Promise<number> {
  const [linha] = await consultar<{ n: number }>(
    "select count(*)::int as n from passagem",
  );
  return linha.n;
}

export async function ultimasPassagens(
  limite = 60,
): Promise<PassagemRecente[]> {
  const linhas = await consultar<{
    id: string;
    decoder_nome: string;
    driver: string;
    transponder: string;
    rotulo: string | null;
    instante_ms: number;
    relogio: "decoder" | "coletor";
    forca: number | null;
  }>(
    `select p.id::text, d.nome as decoder_nome, d.driver, p.transponder, t.rotulo,
            round(extract(epoch from p.instante) * 1000)::float8 as instante_ms,
            p.relogio, p.forca
       from passagem p
       join decoder d on d.id = p.decoder_id
       left join transponder t on t.codigo = p.transponder
      order by p.instante desc, p.id desc
      limit $1`,
    [limite],
  );
  return linhas.map((l) => ({
    id: l.id,
    decoderNome: l.decoder_nome,
    simulado: l.driver === "simulador",
    transponder: l.transponder,
    rotulo: l.rotulo ?? undefined,
    instanteMs: l.instante_ms,
    relogio: l.relogio,
    forca: l.forca,
  }));
}

export const DRIVERS_AUTOMATICOS = ["calx-pro"];

// Plug-and-play: o computador da pista (autenticado pelo token dele) pede o
// cadastro do decoder que detectou. Cria o decoder UMA vez por computador e
// driver; nas chamadas seguintes só gera um token novo (o token antigo deixa
// de valer: quem pede é o único coletor desse decoder).
export async function provisionarDecoderDoComputador(
  computadorId: string,
  dados: { driver: string; nome?: string; endereco?: string; modelo?: string },
  ip: string | null,
): Promise<{ id: string; token: string; criado: boolean }> {
  const driver = dados.driver.trim().toLowerCase();
  if (!DRIVERS_AUTOMATICOS.includes(driver)) {
    throw new ErroNegocio("Esse tipo de decoder não é cadastrado sozinho.");
  }
  const endereco = dados.endereco?.trim().slice(0, 200) || null;
  const modelo = dados.modelo?.trim().slice(0, 80) || null;
  const nome = dados.nome?.trim().slice(0, 80) || "Decoder CalX Pro";
  const token = novoToken();
  return transacao(async (cliente) => {
    const pc = await cliente.query<{ pareado_por: string | null }>(
      "select pareado_por from coletor_computador where id = $1 and revogado_em is null for update",
      [computadorId],
    );
    if (!pc.rows[0]) throw new ErroNegocio("Computador não encontrado.");
    const existente = await cliente.query<{ id: string }>(
      "select id from decoder where computador_id = $1 and driver = $2",
      [computadorId, driver],
    );
    if (existente.rows[0]) {
      await cliente.query(
        `update decoder set token_hash = $2, ativo = true,
                endereco = coalesce($3, endereco)
          where id = $1`,
        [existente.rows[0].id, hashDoToken(token), endereco],
      );
      return { id: existente.rows[0].id, token, criado: false };
    }
    // Decoder deste tipo cadastrado antes à mão (sem computador): o mesmo
    // aparelho, não um segundo. Só adota quando há UM candidato; com vários o
    // operador escolhe, para nunca ligar o decoder errado.
    const orfaos = await cliente.query<{ id: string }>(
      `select id from decoder
        where driver = $1 and computador_id is null and ativo = true`,
      [driver],
    );
    if (orfaos.rows.length === 1) {
      const adotado = orfaos.rows[0].id;
      await cliente.query(
        `update decoder set computador_id = $2, token_hash = $3,
                endereco = coalesce($4, endereco)
          where id = $1`,
        [adotado, computadorId, hashDoToken(token), endereco],
      );
      await registrarAuditoria(
        {
          usuarioId: pc.rows[0].pareado_por,
          ip,
          acao: "decoder.adotar_automatico",
          entidade: "decoder",
          entidadeId: adotado,
          depois: { driver, endereco, computadorId },
        },
        cliente,
      );
      return { id: adotado, token, criado: false };
    }
    const id = `decoder-${randomUUID()}`;
    await cliente.query(
      `insert into decoder (id, nome, driver, endereco, modelo, token_hash, computador_id)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, nome, driver, endereco, modelo, hashDoToken(token), computadorId],
    );
    await registrarAuditoria(
      {
        usuarioId: pc.rows[0].pareado_por,
        ip,
        acao: "decoder.criar_automatico",
        entidade: "decoder",
        entidadeId: id,
        depois: { nome, driver, endereco, modelo, computadorId },
      },
      cliente,
    );
    return { id, token, criado: true };
  });
}
