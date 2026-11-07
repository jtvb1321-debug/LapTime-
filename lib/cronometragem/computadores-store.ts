import { createHash, randomBytes, randomUUID } from "node:crypto";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";

// O computador da pista roda o agente (coletor/agente.mjs). Ele é pareado uma
// vez com um código de uso único e depois manda, a cada poucos segundos, o
// inventário do que está ligado nele. O sistema só OBSERVA: destaca o que
// aparece de novo (o decoder, quando for ligado) e guarda o perfil do aparelho
// que o operador confirmar. Não decide nada sobre o protocolo do decoder.

export const VALIDADE_PAREAMENTO_MIN = 15;
// Sem contato por este tempo, o computador aparece como desconectado.
export const ONLINE_ATE_S = 30;
const MAX_DISPOSITIVOS = 300;
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Decoders que já conhecemos de fábrica, pela chave do aparelho (MAC na rede):
// aparecem como "decoder reconhecido" sem o operador precisar confirmar.
export const DECODERS_CONHECIDOS: Record<string, string> = {
  "rede:34:ea:e7:57:78:41": "Decoder CalX Pro",
};

export type TipoDispositivo = "usb" | "serial" | "rede" | "outro";
const TIPOS: TipoDispositivo[] = ["usb", "serial", "rede", "outro"];

export interface Dispositivo {
  // Identificador estável do tipo de aparelho (ex.: "usb:VID_0403&PID_6001",
  // "serial:COM3", "rede:aa:bb:cc:dd:ee:ff").
  chave: string;
  tipo: TipoDispositivo;
  nome: string;
  detalhe?: string;
}

export interface DispositivoVisto extends Dispositivo {
  // Apareceu depois do último "registrar o que está ligado" (base).
  novo: boolean;
  // Bate com um aparelho que o operador já confirmou como decoder.
  decoder?: { nome: string };
}

export interface ComputadorDaPista {
  id: string;
  nome: string;
  sistema?: string;
  pareadoEm: Date;
  ultimoContato: Date | null;
  ultimoIp?: string;
  online: boolean;
  temBase: boolean;
  dispositivos: DispositivoVisto[];
}

function hash(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

function normalizarCodigo(bruto: string): string {
  return bruto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function novoCodigo(): string {
  const bytes = randomBytes(8);
  let codigo = "";
  for (const b of bytes) {
    codigo += ALFABETO_CODIGO[b % ALFABETO_CODIGO.length];
  }
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

// ------------------------------------------------------------- Pareamento

// Código de uso único para ligar um computador ao sistema (vale 15 minutos).
export async function criarPareamento(
  ator: Ator,
): Promise<{ codigo: string; expiraEm: Date }> {
  const codigo = novoCodigo();
  const id = `pareamento-${randomUUID()}`;
  const [linha] = await consultar<{ expira_em: Date }>(
    `insert into coletor_pareamento (id, codigo_hash, criado_por, expira_em)
     values ($1, $2, $3, now() + make_interval(mins => $4))
     returning expira_em`,
    [
      id,
      hash(normalizarCodigo(codigo)),
      ator.usuarioId,
      VALIDADE_PAREAMENTO_MIN,
    ],
  );
  await registrarAuditoria({
    usuarioId: ator.usuarioId,
    ip: ator.ip,
    acao: "coletor.pareamento_criar",
    entidade: "coletor_pareamento",
    entidadeId: id,
  });
  return { codigo, expiraEm: linha.expira_em };
}

// O agente troca o código pelo token do computador (mostrado uma única vez).
export async function parear(
  codigoBruto: string,
  dados: { nome?: string; sistema?: string },
  ip: string | null,
): Promise<{ token: string; computadorId: string }> {
  const codigo = normalizarCodigo(codigoBruto);
  if (codigo.length !== 8) throw new ErroNegocio("Código inválido.");
  const nome = (dados.nome ?? "").trim().slice(0, 60) || "Computador da pista";
  const sistema = (dados.sistema ?? "").trim().slice(0, 80) || null;

  return transacao(async (cliente) => {
    const { rows } = await cliente.query<{ id: string; criado_por: string }>(
      `select id, criado_por from coletor_pareamento
        where codigo_hash = $1 and usado_em is null and expira_em > now()
        for update`,
      [hash(codigo)],
    );
    if (!rows[0]) throw new ErroNegocio("Código inválido ou vencido.");
    const computadorId = `pc-${randomUUID()}`;
    const token = `gl_pc_${randomBytes(24).toString("base64url")}`;
    await cliente.query(
      "update coletor_pareamento set usado_em = clock_timestamp() where id = $1",
      [rows[0].id],
    );
    await cliente.query(
      `insert into coletor_computador (id, nome, token_hash, sistema, pareado_por, ultimo_ip)
       values ($1, $2, $3, $4, $5, $6)`,
      [computadorId, nome, hash(token), sistema, rows[0].criado_por, ip],
    );
    await registrarAuditoria(
      {
        usuarioId: rows[0].criado_por,
        ip,
        acao: "coletor.parear",
        entidade: "coletor_computador",
        entidadeId: computadorId,
        depois: { nome, sistema },
      },
      cliente,
    );
    return { token, computadorId };
  });
}

export async function autenticarComputador(
  token: string,
): Promise<{ id: string; nome: string } | null> {
  if (!token.startsWith("gl_pc_")) return null;
  const [l] = await consultar<{ id: string; nome: string }>(
    "select id, nome from coletor_computador where token_hash = $1 and revogado_em is null",
    [hash(token)],
  );
  return l ?? null;
}

export async function revogarComputador(id: string, ator: Ator): Promise<void> {
  const linhas = await consultar<{ id: string }>(
    `update coletor_computador set revogado_em = clock_timestamp()
      where id = $1 and revogado_em is null returning id`,
    [id],
  );
  if (!linhas[0]) throw new ErroNegocio("Computador não encontrado.");
  await registrarAuditoria({
    usuarioId: ator.usuarioId,
    ip: ator.ip,
    acao: "coletor.revogar",
    entidade: "coletor_computador",
    entidadeId: id,
  });
}

// ------------------------------------------------------------- Inventário

// Valida e normaliza o inventário que veio do agente (entrada externa).
export function validarInventario(bruto: unknown): Dispositivo[] {
  if (!Array.isArray(bruto)) {
    throw new ErroNegocio("O inventário deve ser uma lista.");
  }
  if (bruto.length > MAX_DISPOSITIVOS) {
    throw new ErroNegocio("Inventário grande demais.");
  }
  const vistos = new Set<string>();
  const lista: Dispositivo[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const chave = typeof d.chave === "string" ? d.chave.trim() : "";
    if (!chave || chave.length > 120 || vistos.has(chave)) continue;
    const tipo = TIPOS.includes(d.tipo as TipoDispositivo)
      ? (d.tipo as TipoDispositivo)
      : "outro";
    const nome = typeof d.nome === "string" ? d.nome.trim().slice(0, 120) : "";
    const detalhe =
      typeof d.detalhe === "string" ? d.detalhe.trim().slice(0, 200) : "";
    vistos.add(chave);
    lista.push({
      chave,
      tipo,
      nome: nome || chave,
      ...(detalhe ? { detalhe } : {}),
    });
  }
  return lista;
}

export async function registrarInventario(
  computadorId: string,
  dispositivos: Dispositivo[],
  ip: string | null,
): Promise<void> {
  await consultar(
    `update coletor_computador
        set inventario = $2::jsonb, ultimo_contato = clock_timestamp(), ultimo_ip = $3
      where id = $1 and revogado_em is null`,
    [computadorId, JSON.stringify(dispositivos), ip],
  );
}

// ------------------------------------------------------------------ Leitura

interface LinhaComputador {
  id: string;
  nome: string;
  sistema: string | null;
  pareado_em: Date;
  ultimo_contato: Date | null;
  ultimo_ip: string | null;
  inventario: Dispositivo[];
  base: string[] | null;
  online: boolean;
}

export async function listarComputadores(): Promise<ComputadorDaPista[]> {
  const [linhas, perfis] = await Promise.all([
    consultar<LinhaComputador>(
      `select id, nome, sistema, pareado_em, ultimo_contato, ultimo_ip,
              inventario, base,
              coalesce(ultimo_contato > now() - make_interval(secs => $1), false) as online
         from coletor_computador where revogado_em is null
        order by pareado_em`,
      [ONLINE_ATE_S],
    ),
    consultar<{ chave: string; nome: string }>(
      "select chave, nome from dispositivo_decoder",
    ),
  ]);
  const nomeDoPerfil = new Map<string, string>([
    ...Object.entries(DECODERS_CONHECIDOS),
    ...perfis.map((p) => [p.chave, p.nome] as [string, string]),
  ]);
  return linhas.map((l) => {
    const base = l.base ? new Set(l.base) : null;
    return {
      id: l.id,
      nome: l.nome,
      sistema: l.sistema ?? undefined,
      pareadoEm: l.pareado_em,
      ultimoContato: l.ultimo_contato,
      ultimoIp: l.ultimo_ip ?? undefined,
      online: l.online,
      temBase: base !== null,
      dispositivos: l.inventario.map((d) => ({
        ...d,
        novo: base !== null && !base.has(d.chave),
        decoder: nomeDoPerfil.has(d.chave)
          ? { nome: nomeDoPerfil.get(d.chave)! }
          : undefined,
      })),
    };
  });
}

// ------------------------------------------------------------- Ações do operador

// "Tudo que está ligado agora NÃO é o decoder": o que aparecer depois é novo.
export async function registrarBase(
  computadorId: string,
  ator: Ator,
): Promise<number> {
  return transacao(async (cliente) => {
    const { rows } = await cliente.query<{ inventario: Dispositivo[] }>(
      `select inventario from coletor_computador
        where id = $1 and revogado_em is null for update`,
      [computadorId],
    );
    if (!rows[0]) throw new ErroNegocio("Computador não encontrado.");
    const chaves = rows[0].inventario.map((d) => d.chave);
    await cliente.query(
      "update coletor_computador set base = $2::jsonb where id = $1",
      [computadorId, JSON.stringify(chaves)],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "coletor.base",
        entidade: "coletor_computador",
        entidadeId: computadorId,
        depois: { dispositivos: chaves.length },
      },
      cliente,
    );
    return chaves.length;
  });
}

// O operador confirma que este dispositivo é o decoder: passa a ser
// reconhecido sozinho sempre que aparecer.
export async function confirmarDecoder(
  computadorId: string,
  chave: string,
  nomeBruto: string,
  ator: Ator,
): Promise<void> {
  const nome = nomeBruto.trim().slice(0, 80);
  if (nome.length < 2) throw new ErroNegocio("Dê um nome ao decoder.");
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<{ inventario: Dispositivo[] }>(
      "select inventario from coletor_computador where id = $1 and revogado_em is null",
      [computadorId],
    );
    if (!rows[0]) throw new ErroNegocio("Computador não encontrado.");
    const visto = rows[0].inventario.find((d) => d.chave === chave);
    if (!visto) {
      throw new ErroNegocio("Esse dispositivo não está mais ligado.");
    }
    await cliente.query(
      `insert into dispositivo_decoder (chave, nome, confirmado_por)
       values ($1, $2, $3)
       on conflict (chave) do update
         set nome = excluded.nome, confirmado_por = excluded.confirmado_por,
             confirmado_em = clock_timestamp()`,
      [chave, nome, ator.usuarioId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "coletor.decoder_confirmar",
        entidade: "dispositivo_decoder",
        entidadeId: chave,
        depois: { nome, dispositivo: visto },
      },
      cliente,
    );
  });
}

export async function esquecerDecoder(
  chave: string,
  ator: Ator,
): Promise<void> {
  const linhas = await consultar<{ chave: string }>(
    "delete from dispositivo_decoder where chave = $1 returning chave",
    [chave],
  );
  if (!linhas[0]) throw new ErroNegocio("Perfil não encontrado.");
  await registrarAuditoria({
    usuarioId: ator.usuarioId,
    ip: ator.ip,
    acao: "coletor.decoder_esquecer",
    entidade: "dispositivo_decoder",
    entidadeId: chave,
  });
}
