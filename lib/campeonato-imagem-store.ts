import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { validarImagem, type MimeImagem } from "@/lib/campeonato-imagem";
import { ErroNegocio } from "@/lib/operacao/erros";

export type Enquadramento = "inteira" | "preencher";

export interface ImagemDoCampeonato {
  campeonatoId: string;
  mime: MimeImagem;
  alt: string;
  tamanho: number;
  atualizadoEm: Date;
  enquadramento: Enquadramento;
  focoY: number;
}

async function campeonatoValido(id: string) {
  const [c] = await consultar<{ nome: string; ativo: boolean }>(
    "select nome, ativo from campeonato where id = $1",
    [id],
  );
  if (!c) throw new ErroNegocio("Campeonato não encontrado.");
  return c;
}

interface LinhaImagem {
  campeonato_id: string;
  tipo_mime: MimeImagem;
  texto_alternativo: string;
  tamanho: number;
  atualizado_em: Date;
  enquadramento?: Enquadramento;
  foco_y?: number;
}

// Só metadados (a imagem em si sai por /api/campeonatos/[id]/imagem). Se as colunas de
// enquadramento ainda não existirem no banco, vale o padrão: imagem inteira.
export async function lerImagemDoCampeonato(
  campeonatoId: string,
): Promise<ImagemDoCampeonato | null> {
  let l: LinhaImagem | undefined;
  try {
    [l] = await consultar<LinhaImagem>(
      `select campeonato_id, tipo_mime, texto_alternativo,
              octet_length(dados) as tamanho, atualizado_em, enquadramento, foco_y
         from campeonato_imagem where campeonato_id = $1`,
      [campeonatoId],
    );
  } catch {
    [l] = await consultar<LinhaImagem>(
      `select campeonato_id, tipo_mime, texto_alternativo,
              octet_length(dados) as tamanho, atualizado_em
         from campeonato_imagem where campeonato_id = $1`,
      [campeonatoId],
    );
  }
  return l
    ? {
        campeonatoId: l.campeonato_id,
        mime: l.tipo_mime,
        alt: l.texto_alternativo,
        tamanho: Number(l.tamanho),
        atualizadoEm: l.atualizado_em,
        enquadramento: l.enquadramento ?? "inteira",
        focoY: l.foco_y ?? 50,
      }
    : null;
}

export async function salvarEnquadramentoDaImagem(
  campeonatoId: string,
  enquadramento: string,
  focoY: number,
): Promise<void> {
  if (enquadramento !== "inteira" && enquadramento !== "preencher") {
    throw new ErroNegocio("Enquadramento inválido.");
  }
  if (!Number.isFinite(focoY)) throw new ErroNegocio("Posição inválida.");
  const foco = Math.min(100, Math.max(0, Math.round(focoY)));
  let r;
  try {
    r = await consultar(
      `update campeonato_imagem set enquadramento = $2, foco_y = $3
        where campeonato_id = $1 returning campeonato_id`,
      [campeonatoId, enquadramento, foco],
    );
  } catch {
    throw new ErroNegocio(
      "O ajuste de enquadramento ainda não está disponível neste banco (falta aplicar o SQL da atualização).",
    );
  }
  if (r.length === 0) {
    throw new ErroNegocio("Envie a imagem antes de ajustar o enquadramento.");
  }
}

export async function lerBytesDaImagem(campeonatoId: string) {
  const [l] = await consultar<{
    tipo_mime: MimeImagem;
    dados: Buffer;
    atualizado_em: Date;
  }>(
    "select tipo_mime, dados, atualizado_em from campeonato_imagem where campeonato_id = $1",
    [campeonatoId],
  );
  return l ?? null;
}

export async function salvarImagemDoCampeonato(
  campeonatoId: string,
  bytes: Uint8Array,
  altBruto: string,
  ator: { usuarioId?: string | null; ip?: string | null },
): Promise<void> {
  const camp = await campeonatoValido(campeonatoId);
  const v = validarImagem(bytes, altBruto, camp.nome);
  if (!v.ok) throw new ErroNegocio(v.erro);
  await transacao(async (cliente) => {
    await cliente.query(
      `insert into campeonato_imagem
         (campeonato_id, tipo_mime, dados, texto_alternativo, atualizado_por)
       values ($1, $2, $3, $4, $5)
       on conflict (campeonato_id) do update
         set tipo_mime = excluded.tipo_mime, dados = excluded.dados,
             texto_alternativo = excluded.texto_alternativo,
             atualizado_por = excluded.atualizado_por,
             atualizado_em = clock_timestamp()`,
      [campeonatoId, v.mime, Buffer.from(bytes), v.alt, ator.usuarioId ?? null],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "campeonato.imagem_salvar",
        entidade: "campeonato",
        entidadeId: campeonatoId,
        depois: { mime: v.mime, tamanho: bytes.length },
      },
      cliente,
    );
  });
}

export async function removerImagemDoCampeonato(
  campeonatoId: string,
  ator: { usuarioId?: string | null; ip?: string | null },
): Promise<void> {
  const camp = await campeonatoValido(campeonatoId);
  if (camp.ativo) {
    throw new ErroNegocio(
      "Campeonato ativo precisa da imagem. Troque a imagem em vez de remover.",
    );
  }
  await transacao(async (cliente) => {
    const { rowCount } = await cliente.query(
      "delete from campeonato_imagem where campeonato_id = $1",
      [campeonatoId],
    );
    if (!rowCount) return;
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "campeonato.imagem_remover",
        entidade: "campeonato",
        entidadeId: campeonatoId,
      },
      cliente,
    );
  });
}
