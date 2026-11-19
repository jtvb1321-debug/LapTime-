import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { consultar, transacao } from "@/lib/db/conexao";
import { categoriaExiste } from "@/lib/categorias-store";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { Campeonato } from "@/lib/types";

// Campeonatos no banco (antes ficavam só no navegador de quem cadastrou). O fluxo é: dados →
// imagem → traçados (no mínimo 2) → logos de patrocinadores (no mínimo 1) → ativar. Só um
// campeonato fica ativo por vez, e só dá para ativar com tudo pronto.
export const MINIMO_DE_ETAPAS = 1;
export const MINIMO_DE_CATEGORIAS = 1;
export const MINIMO_DE_TRACADOS = 2;
export const MINIMO_DE_LOGOS = 1;

export type StatusDoCampeonato = "rascunho" | "ativo" | "encerrado";

export interface CampeonatoCompleto extends Campeonato {
  status: StatusDoCampeonato;
  temImagem: boolean;
  categoriaIds: string[];
  tracadoIds: string[];
  pilotoIds: string[];
  etapasContagem: number;
  logos: LogoDoCampeonato[];
}

export interface LogoDoCampeonato {
  id: string;
  nome: string;
  logo: string;
}

export interface Prontidao {
  imagem: boolean;
  categorias: boolean;
  etapas: boolean;
  tracados: boolean;
  logos: boolean;
  pronto: boolean;
}

interface LinhaCampeonato {
  id: string;
  nome: string;
  temporada: string;
  slug: string;
  descricao: string;
  ativo: boolean;
  encerrado_em: Date | null;
  tem_imagem: boolean;
}

function statusDe(l: LinhaCampeonato): StatusDoCampeonato {
  return l.ativo ? "ativo" : l.encerrado_em ? "encerrado" : "rascunho";
}

const SELECT = `select c.id, c.nome, c.temporada, c.slug, c.descricao, c.ativo, c.encerrado_em,
       exists (select 1 from campeonato_imagem i where i.campeonato_id = c.id) as tem_imagem
  from campeonato c`;

export function prontidaoDe(c: {
  temImagem: boolean;
  categoriaIds: string[];
  tracadoIds: string[];
  etapasContagem: number;
  logos: unknown[];
}): Prontidao {
  const imagem = c.temImagem;
  const categorias = c.categoriaIds.length >= MINIMO_DE_CATEGORIAS;
  const etapas = c.etapasContagem >= MINIMO_DE_ETAPAS;
  const tracados = c.tracadoIds.length >= MINIMO_DE_TRACADOS;
  const logos = c.logos.length >= MINIMO_DE_LOGOS;
  return {
    imagem,
    categorias,
    etapas,
    tracados,
    logos,
    pronto: imagem && categorias && etapas && tracados && logos,
  };
}

async function completar(
  linhas: LinhaCampeonato[],
): Promise<CampeonatoCompleto[]> {
  if (linhas.length === 0) return [];
  const ids = linhas.map((l) => l.id);
  const [pilotosVinc, etapasConta, categoriasVinc, vinculos, logos] =
    await Promise.all([
      consultar<{ campeonato_id: string; piloto_id: string }>(
        `select campeonato_id, piloto_id from campeonato_piloto
        where campeonato_id = any($1)`,
        [ids],
      ),
      consultar<{ campeonato_id: string; n: number }>(
        `select campeonato_id, count(*)::int as n from etapa
        where campeonato_id = any($1) group by campeonato_id`,
        [ids],
      ),
      consultar<{ campeonato_id: string; categoria_id: string }>(
        `select campeonato_id, categoria_id from campeonato_categoria
        where campeonato_id = any($1) order by categoria_id`,
        [ids],
      ),
      consultar<{ campeonato_id: string; tracado_id: string }>(
        `select campeonato_id, tracado_id from campeonato_tracado
        where campeonato_id = any($1) order by ordem, tracado_id`,
        [ids],
      ),
      consultar<{
        id: string;
        campeonato_id: string;
        nome: string;
        logo: string;
      }>(
        `select id, campeonato_id, nome, logo from campeonato_logo
        where campeonato_id = any($1) order by ordem, criado_em, id`,
        [ids],
      ),
    ]);
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    temporada: l.temporada,
    slug: l.slug,
    descricao: l.descricao,
    ativo: l.ativo,
    status: statusDe(l),
    temImagem: l.tem_imagem,
    pilotoIds: pilotosVinc
      .filter((v) => v.campeonato_id === l.id)
      .map((v) => v.piloto_id),
    etapasContagem: etapasConta.find((e) => e.campeonato_id === l.id)?.n ?? 0,
    categoriaIds: categoriasVinc
      .filter((v) => v.campeonato_id === l.id)
      .map((v) => v.categoria_id),
    tracadoIds: vinculos
      .filter((v) => v.campeonato_id === l.id)
      .map((v) => v.tracado_id),
    logos: logos
      .filter((x) => x.campeonato_id === l.id)
      .map((x) => ({ id: x.id, nome: x.nome, logo: x.logo })),
  }));
}

// Sem a tabela (SQL ainda não aplicado) o sistema segue como se não houvesse campeonatos.
export async function lerCampeonatos(): Promise<CampeonatoCompleto[]> {
  try {
    const linhas = await consultar<LinhaCampeonato>(
      `${SELECT} order by c.ativo desc, c.criado_em desc, c.id`,
    );
    return await completar(linhas);
  } catch {
    return [];
  }
}

export async function lerCampeonatoPorId(
  id: string,
): Promise<CampeonatoCompleto | undefined> {
  try {
    const linhas = await consultar<LinhaCampeonato>(
      `${SELECT} where c.id = $1`,
      [id],
    );
    return (await completar(linhas))[0];
  } catch {
    return undefined;
  }
}

export async function lerCampeonatoAtivo(): Promise<
  CampeonatoCompleto | undefined
> {
  try {
    const linhas = await consultar<LinhaCampeonato>(
      `${SELECT} where c.ativo limit 1`,
    );
    return (await completar(linhas))[0];
  } catch {
    return undefined;
  }
}

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function slugDe(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface DadosDoCampeonato {
  nome: string;
  temporada: string;
  descricao: string;
}

function validarDados(d: DadosDoCampeonato): DadosDoCampeonato {
  const nome = d.nome.trim();
  const temporada = d.temporada.trim();
  const descricao = d.descricao.trim();
  if (nome.length < 2 || nome.length > 80) {
    throw new ErroNegocio("O nome deve ter de 2 a 80 caracteres.");
  }
  if (temporada.length < 1 || temporada.length > 20) {
    throw new ErroNegocio("Informe a temporada (até 20 caracteres).");
  }
  if (descricao.length > 400) {
    throw new ErroNegocio("A descrição pode ter até 400 caracteres.");
  }
  return { nome, temporada, descricao };
}

export async function criarCampeonato(
  d: DadosDoCampeonato,
  usuarioId: string,
): Promise<string> {
  const dados = validarDados(d);
  const id = `camp-${randomUUID().slice(0, 8)}`;
  const base = slugDe(`${dados.nome} ${dados.temporada}`) || "campeonato";
  await consultar(
    `insert into campeonato (id, nome, temporada, slug, descricao, criado_por)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (slug) do nothing`,
    [id, dados.nome, dados.temporada, base, dados.descricao, usuarioId],
  );
  // Slug já usado por outro campeonato: acrescenta um sufixo.
  const [existe] = await consultar<{ id: string }>(
    "select id from campeonato where id = $1",
    [id],
  );
  if (!existe) {
    await consultar(
      `insert into campeonato (id, nome, temporada, slug, descricao, criado_por)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        dados.nome,
        dados.temporada,
        `${base}-${id.slice(-4)}`,
        dados.descricao,
        usuarioId,
      ],
    );
  }
  // De início, todos os pilotos que já estão no sistema entram no campeonato.
  await consultar(
    `insert into campeonato_piloto (campeonato_id, piloto_id)
     select $1, id from piloto on conflict do nothing`,
    [id],
  );
  return id;
}

// Piloto que acabou de se cadastrar entra nos campeonatos que ainda não terminaram. Roda dentro
// da transação do cadastro; se a tabela ainda não existir, o cadastro não é afetado.
export async function incluirPilotoNosCampeonatos(
  cliente: PoolClient,
  pilotoId: string,
): Promise<void> {
  await cliente.query("savepoint incluir_piloto_campeonato");
  try {
    await cliente.query(
      `insert into campeonato_piloto (campeonato_id, piloto_id)
       select id, $1 from campeonato where encerrado_em is null
       on conflict do nothing`,
      [pilotoId],
    );
    await cliente.query("release savepoint incluir_piloto_campeonato");
  } catch {
    await cliente.query("rollback to savepoint incluir_piloto_campeonato");
  }
}

export async function definirPilotos(
  id: string,
  pilotoIds: string[],
): Promise<void> {
  const unicos = [...new Set(pilotoIds)];
  await transacao(async (cliente) => {
    const camp = await cliente.query("select 1 from campeonato where id = $1", [
      id,
    ]);
    if (camp.rowCount === 0)
      throw new ErroNegocio("Campeonato não encontrado.");
    if (unicos.length > 0) {
      const ok = await cliente.query(
        "select id from piloto where id = any($1)",
        [unicos],
      );
      if (ok.rowCount !== unicos.length) {
        throw new ErroNegocio("Um dos pilotos escolhidos não existe mais.");
      }
    }
    await cliente.query(
      "delete from campeonato_piloto where campeonato_id = $1",
      [id],
    );
    for (const pilotoId of unicos) {
      await cliente.query(
        "insert into campeonato_piloto (campeonato_id, piloto_id) values ($1, $2)",
        [id, pilotoId],
      );
    }
  });
}

export async function atualizarDados(
  id: string,
  d: DadosDoCampeonato,
): Promise<void> {
  const dados = validarDados(d);
  const r = await consultar(
    `update campeonato set nome = $2, temporada = $3, descricao = $4
      where id = $1 returning id`,
    [id, dados.nome, dados.temporada, dados.descricao],
  );
  if (r.length === 0) throw new ErroNegocio("Campeonato não encontrado.");
}

export async function definirCategorias(
  id: string,
  categoriaIds: string[],
): Promise<void> {
  const unicas = [...new Set(categoriaIds)];
  if (unicas.some((c) => !categoriaExiste(c))) {
    throw new ErroNegocio("Uma das categorias escolhidas não existe.");
  }
  await transacao(async (cliente) => {
    const camp = await cliente.query(
      "select ativo from campeonato where id = $1",
      [id],
    );
    if (camp.rowCount === 0)
      throw new ErroNegocio("Campeonato não encontrado.");
    if (camp.rows[0].ativo && unicas.length < MINIMO_DE_CATEGORIAS) {
      throw new ErroNegocio(
        `Campeonato ativo precisa de pelo menos ${MINIMO_DE_CATEGORIAS} categoria.`,
      );
    }
    await cliente.query(
      "delete from campeonato_categoria where campeonato_id = $1",
      [id],
    );
    for (const categoriaId of unicas) {
      await cliente.query(
        "insert into campeonato_categoria (campeonato_id, categoria_id) values ($1, $2)",
        [id, categoriaId],
      );
    }
  });
}

export async function definirTracados(
  id: string,
  tracadoIds: string[],
): Promise<void> {
  const unicos = [...new Set(tracadoIds)];
  await transacao(async (cliente) => {
    const camp = await cliente.query("select 1 from campeonato where id = $1", [
      id,
    ]);
    if (camp.rowCount === 0)
      throw new ErroNegocio("Campeonato não encontrado.");
    if (unicos.length > 0) {
      const existentes = await cliente.query(
        "select id from tracado where id = any($1)",
        [unicos],
      );
      if (existentes.rowCount !== unicos.length) {
        throw new ErroNegocio("Um dos traçados escolhidos não existe mais.");
      }
    }
    await cliente.query(
      "delete from campeonato_tracado where campeonato_id = $1",
      [id],
    );
    for (const [ordem, tracadoId] of unicos.entries()) {
      await cliente.query(
        "insert into campeonato_tracado (campeonato_id, tracado_id, ordem) values ($1, $2, $3)",
        [id, tracadoId, ordem],
      );
    }
    // Campeonato ativo não pode ficar abaixo do mínimo.
    const [c] = (
      await cliente.query("select ativo from campeonato where id = $1", [id])
    ).rows as { ativo: boolean }[];
    if (c?.ativo && unicos.length < MINIMO_DE_TRACADOS) {
      throw new ErroNegocio(
        `Campeonato ativo precisa de pelo menos ${MINIMO_DE_TRACADOS} traçados.`,
      );
    }
  });
}

export async function adicionarLogo(
  campeonatoId: string,
  nome: string,
  logo: string,
): Promise<void> {
  const limpo = nome.trim();
  if (limpo.length < 1 || limpo.length > 60) {
    throw new ErroNegocio(
      "Informe o nome do patrocinador (até 60 caracteres).",
    );
  }
  if (
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(logo) ||
    logo.length > 700_000
  ) {
    throw new ErroNegocio("Logo inválido: use PNG, JPG ou WEBP de até 500 KB.");
  }
  const [camp] = await consultar("select 1 from campeonato where id = $1", [
    campeonatoId,
  ]);
  if (!camp) throw new ErroNegocio("Campeonato não encontrado.");
  const [ordem] = await consultar<{ n: number }>(
    "select coalesce(max(ordem), -1) + 1 as n from campeonato_logo where campeonato_id = $1",
    [campeonatoId],
  );
  await consultar(
    `insert into campeonato_logo (id, campeonato_id, nome, logo, ordem)
     values ($1, $2, $3, $4, $5)`,
    [
      `logo-${randomUUID().slice(0, 8)}`,
      campeonatoId,
      limpo,
      logo,
      ordem?.n ?? 0,
    ],
  );
}

export async function removerLogo(
  campeonatoId: string,
  logoId: string,
): Promise<void> {
  const c = await lerCampeonatoPorId(campeonatoId);
  if (!c) throw new ErroNegocio("Campeonato não encontrado.");
  if (c.ativo && c.logos.length <= MINIMO_DE_LOGOS) {
    throw new ErroNegocio(
      `Campeonato ativo precisa de pelo menos ${MINIMO_DE_LOGOS} logo de patrocinador.`,
    );
  }
  await consultar(
    "delete from campeonato_logo where id = $1 and campeonato_id = $2",
    [logoId, campeonatoId],
  );
}

// Ativa o campeonato (encerrando o que estava ativo) — só com imagem, traçados e logos prontos.
export async function ativarCampeonato(id: string): Promise<void> {
  const c = await lerCampeonatoPorId(id);
  if (!c) throw new ErroNegocio("Campeonato não encontrado.");
  const p = prontidaoDe(c);
  if (!p.pronto) {
    const falta = [
      !p.imagem && "a imagem do campeonato",
      !p.categorias && `pelo menos ${MINIMO_DE_CATEGORIAS} categoria`,
      !p.etapas && `pelo menos ${MINIMO_DE_ETAPAS} etapa no calendário`,
      !p.tracados && `pelo menos ${MINIMO_DE_TRACADOS} traçados`,
      !p.logos && `pelo menos ${MINIMO_DE_LOGOS} logo de patrocinador`,
    ].filter(Boolean);
    throw new ErroNegocio(`Para ativar, falta: ${falta.join(", ")}.`);
  }
  await transacao(async (cliente) => {
    await cliente.query(
      "update campeonato set ativo = false, encerrado_em = clock_timestamp() where ativo and id <> $1",
      [id],
    );
    await cliente.query(
      "update campeonato set ativo = true, encerrado_em = null where id = $1",
      [id],
    );
  });
}

export async function encerrarCampeonato(id: string): Promise<void> {
  const r = await consultar(
    `update campeonato set ativo = false, encerrado_em = clock_timestamp()
      where id = $1 and ativo returning id`,
    [id],
  );
  if (r.length === 0) {
    throw new ErroNegocio("Só um campeonato ativo pode ser encerrado.");
  }
}

export async function excluirCampeonato(id: string): Promise<void> {
  const c = await lerCampeonatoPorId(id);
  if (!c) throw new ErroNegocio("Campeonato não encontrado.");
  if (c.ativo) {
    throw new ErroNegocio("Encerre o campeonato antes de excluí-lo.");
  }
  await transacao(async (cliente) => {
    await cliente.query(
      "delete from campeonato_imagem where campeonato_id = $1",
      [id],
    );
    await cliente.query("delete from campeonato where id = $1", [id]);
  });
}
