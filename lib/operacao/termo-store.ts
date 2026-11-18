import { createHash, randomBytes, randomUUID } from "node:crypto";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";

// O aceite vale por este tempo; depois o cliente assina de novo.
export const VALIDADE_ACEITE_DIAS = 365;

// MODELO de partida — não é texto jurídico validado. O administrador deve
// revisar com o jurídico/seguro do kartódromo e publicar a versão oficial.
export const TERMO_MODELO = `TERMO DE RESPONSABILIDADE E CIÊNCIA DE RISCOS

Declaro que li e entendi as regras de segurança do kartódromo e que:

1. Estou em condições físicas e de saúde adequadas para pilotar kart e não faço uso de álcool ou de substâncias que alterem meus reflexos.
2. Conheço os riscos inerentes ao automobilismo (colisões, quedas, lesões) e assumo esses riscos voluntariamente.
3. Vou seguir as orientações da equipe da pista, usar todos os equipamentos de segurança fornecidos e respeitar as bandeiras e sinalizações.
4. Sou responsável pelos danos que eu causar por uso indevido do equipamento ou por descumprir as regras.
5. Quando este termo é assinado por um responsável legal em nome de menor de idade, declaro ter autoridade para isso e assumo as obrigações acima por ele.
6. Autorizo o uso dos meus dados (nome, telefone, tempos de volta) para o atendimento e a operação do kartódromo, conforme a legislação de proteção de dados.`;

export interface Termo {
  id: string;
  versao: number;
  texto: string;
  criadoEm: Date;
}

interface LinhaTermo {
  id: string;
  versao: number;
  texto: string;
  criado_em: Date;
}

function termoDeLinha(l: LinhaTermo): Termo {
  return { id: l.id, versao: l.versao, texto: l.texto, criadoEm: l.criado_em };
}

// Versão vigente. Se ainda não existe nenhuma, grava a versão 1 com o modelo
// (pra o balcão nunca ficar sem termo) — o admin troca depois.
export async function termoAtual(): Promise<Termo> {
  const linhas = await consultar<LinhaTermo>(
    "select id, versao, texto, criado_em from termo_versao order by versao desc limit 1",
  );
  if (linhas[0]) return termoDeLinha(linhas[0]);
  await consultar(
    `insert into termo_versao (id, versao, texto, criado_por)
     values ($1, 1, $2, 'sistema') on conflict (versao) do nothing`,
    [`termo-${randomUUID()}`, TERMO_MODELO],
  );
  return termoAtual();
}

export async function contarAceitesDaVersao(termoId: string): Promise<number> {
  const [{ n }] = await consultar<{ n: number }>(
    "select count(distinct cliente_id)::int as n from termo_aceite where termo_versao_id = $1",
    [termoId],
  );
  return n;
}

export async function publicarTermo(texto: string, ator: Ator): Promise<Termo> {
  const limpo = texto.trim();
  if (limpo.length < 100) {
    throw new ErroNegocio(
      "O termo está curto demais. Escreva o texto completo.",
    );
  }
  return transacao(async (cliente) => {
    // Serializa publicações simultâneas.
    await cliente.query("lock table termo_versao in share row exclusive mode");
    const { rows: ultima } = await cliente.query<{ versao: number | null }>(
      "select max(versao) as versao from termo_versao",
    );
    const versao = (ultima[0].versao ?? 0) + 1;
    const { rows } = await cliente.query<LinhaTermo>(
      `insert into termo_versao (id, versao, texto, criado_por)
       values ($1, $2, $3, $4) returning id, versao, texto, criado_em`,
      [`termo-${randomUUID()}`, versao, limpo, ator.usuarioId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "termo.publicar",
        entidade: "termo_versao",
        entidadeId: rows[0].id,
        depois: { versao },
      },
      cliente,
    );
    return termoDeLinha(rows[0]);
  });
}

export type SituacaoTermo =
  | { situacao: "valido"; aceitoEm: Date; assinante: string }
  | { situacao: "vencido"; aceitoEm: Date }
  | { situacao: "desatualizado"; aceitoEm: Date }
  | { situacao: "pendente" };

export async function situacaoDoTermo(
  clienteId: string,
): Promise<SituacaoTermo> {
  const atual = await termoAtual();
  // O aceite da versão vigente é o que vale (um aceite antigo não o esconde).
  const daVersao = await consultar<{
    aceito_em: Date;
    assinante_nome: string;
    vencido: boolean;
  }>(
    `select aceito_em, assinante_nome,
            aceito_em < now() - make_interval(days => $3) as vencido
       from termo_aceite where cliente_id = $1 and termo_versao_id = $2
      order by aceito_em desc limit 1`,
    [clienteId, atual.id, VALIDADE_ACEITE_DIAS],
  );
  const vigente = daVersao[0];
  if (vigente) {
    return vigente.vencido
      ? { situacao: "vencido", aceitoEm: vigente.aceito_em }
      : {
          situacao: "valido",
          aceitoEm: vigente.aceito_em,
          assinante: vigente.assinante_nome,
        };
  }
  const antigo = await consultar<{ aceito_em: Date }>(
    "select aceito_em from termo_aceite where cliente_id = $1 order by aceito_em desc limit 1",
    [clienteId],
  );
  return antigo[0]
    ? { situacao: "desatualizado", aceitoEm: antigo[0].aceito_em }
    : { situacao: "pendente" };
}

// Quais clientes (da lista) têm termo válido na versão atual.
export async function clientesComTermoValido(
  clienteIds: string[],
): Promise<Set<string>> {
  if (clienteIds.length === 0) return new Set();
  const atual = await termoAtual();
  const linhas = await consultar<{ cliente_id: string }>(
    `select distinct cliente_id from termo_aceite
      where cliente_id = any($1) and termo_versao_id = $2
        and aceito_em >= now() - make_interval(days => $3)`,
    [clienteIds, atual.id, VALIDADE_ACEITE_DIAS],
  );
  return new Set(linhas.map((l) => l.cliente_id));
}

export async function registrarAceite(
  dados: { clienteId: string; assinante: string; porMenor: boolean },
  ator: Ator,
): Promise<void> {
  const assinante = dados.assinante.trim();
  if (assinante.length < 3) {
    throw new ErroNegocio("Informe o nome completo de quem assina.");
  }
  const atual = await termoAtual();

  await transacao(async (cliente) => {
    const existe = await cliente.query(
      "select 1 from cliente where id = $1 for update",
      [dados.clienteId],
    );
    if (!existe.rowCount) throw new ErroNegocio("Cliente não encontrado.");
    const valido = await cliente.query(
      `select 1 from termo_aceite
        where cliente_id = $1 and termo_versao_id = $2
          and aceito_em >= now() - make_interval(days => $3) limit 1`,
      [dados.clienteId, atual.id, VALIDADE_ACEITE_DIAS],
    );
    if (valido.rowCount) {
      throw new ErroNegocio("Este cliente já tem um termo válido assinado.");
    }
    const id = `aceite-${randomUUID()}`;
    await cliente.query(
      `insert into termo_aceite (id, cliente_id, termo_versao_id, assinante_nome, por_menor, registrado_por, ip, texto_hash)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        dados.clienteId,
        atual.id,
        assinante,
        dados.porMenor,
        ator.usuarioId,
        ator.ip ?? null,
        hashDoTexto(atual.texto),
      ],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "termo.aceite",
        entidade: "termo_aceite",
        entidadeId: id,
        depois: {
          clienteId: dados.clienteId,
          versao: atual.versao,
          assinante,
          porMenor: dados.porMenor,
        },
      },
      cliente,
    );
  });
}

// ---------------------------------------------------- Assinatura digital

// O link enviado ao cliente vale por este tempo.
export const VALIDADE_CONVITE_DIAS = 7;
const MAIOR_ASSINATURA_BYTES = 300_000;
const MENOR_ASSINATURA_BYTES = 200;
const ASSINATURA_PNG = /^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/;
const CABECALHO_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

// Impressão digital do texto que o cliente leu (prova de qual texto assinou).
export function hashDoTexto(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

export interface ConviteDoTermo {
  token: string;
  expiraEm: Date;
}

// Link de assinatura do cliente: reaproveita o que ainda vale; senão cria um.
export async function garantirConvite(
  clienteId: string,
  ator: Ator,
  corridaId?: string,
): Promise<ConviteDoTermo> {
  if ((await situacaoDoTermo(clienteId)).situacao === "valido") {
    throw new ErroNegocio("Este cliente já tem um termo válido assinado.");
  }
  return transacao(async (cliente) => {
    const existe = await cliente.query(
      "select 1 from cliente where id = $1 for update",
      [clienteId],
    );
    if (!existe.rowCount) throw new ErroNegocio("Cliente não encontrado.");
    const { rows } = await cliente.query<{ token: string; expira_em: Date }>(
      `select token, expira_em from termo_convite
        where cliente_id = $1 and usado_em is null and expira_em > now()
        order by criado_em desc limit 1`,
      [clienteId],
    );
    if (rows[0]) return { token: rows[0].token, expiraEm: rows[0].expira_em };

    const id = `convite-${randomUUID()}`;
    const token = randomBytes(24).toString("base64url");
    const inserido = await cliente.query<{ expira_em: Date }>(
      `insert into termo_convite (id, cliente_id, token, corrida_id, criado_por, expira_em)
       values ($1, $2, $3, $4, $5, now() + make_interval(days => $6))
       returning expira_em`,
      [
        id,
        clienteId,
        token,
        corridaId ?? null,
        ator.usuarioId,
        VALIDADE_CONVITE_DIAS,
      ],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "termo.convite",
        entidade: "termo_convite",
        entidadeId: id,
        depois: { clienteId, corridaId: corridaId ?? null },
      },
      cliente,
    );
    return { token, expiraEm: inserido.rows[0].expira_em };
  });
}

// Links ainda válidos dos clientes da lista (para mostrar/enviar de novo).
export async function convitesVigentes(
  clienteIds: string[],
): Promise<Map<string, ConviteDoTermo>> {
  if (clienteIds.length === 0) return new Map();
  const linhas = await consultar<{
    cliente_id: string;
    token: string;
    expira_em: Date;
  }>(
    `select distinct on (cliente_id) cliente_id, token, expira_em
       from termo_convite
      where cliente_id = any($1) and usado_em is null and expira_em > now()
      order by cliente_id, criado_em desc`,
    [clienteIds],
  );
  return new Map(
    linhas.map((l) => [
      l.cliente_id,
      { token: l.token, expiraEm: l.expira_em },
    ]),
  );
}

export type ConviteLido =
  | { estado: "invalido" }
  | {
      estado: "valido" | "usado" | "expirado";
      cliente: { id: string; nome: string; numero: number; menor: boolean };
      termo: Termo;
    };

function ehMenor(nascimento: string | null): boolean {
  if (!nascimento) return false;
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 18);
  return new Date(`${nascimento}T12:00:00`) > limite;
}

// Leitura pública do link (sem login): só devolve o necessário para assinar.
export async function lerConvite(token: string): Promise<ConviteLido> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { estado: "invalido" };
  const [c] = await consultar<{
    cliente_id: string;
    nome: string;
    numero: number;
    nascimento: string | null;
    usado: boolean;
    expirado: boolean;
  }>(
    `select c.id as cliente_id, c.nome, c.numero,
            to_char(c.nascimento, 'YYYY-MM-DD') as nascimento,
            tc.usado_em is not null as usado, tc.expira_em <= now() as expirado
       from termo_convite tc join cliente c on c.id = tc.cliente_id
      where tc.token = $1`,
    [token],
  );
  if (!c) return { estado: "invalido" };
  const termo = await termoAtual();
  return {
    estado: c.usado ? "usado" : c.expirado ? "expirado" : "valido",
    cliente: {
      id: c.cliente_id,
      nome: c.nome,
      numero: c.numero,
      menor: ehMenor(c.nascimento),
    },
    termo,
  };
}

export interface AssinaturaDigital {
  assinante: string;
  documento?: string;
  porMenor: boolean;
  // Imagem PNG da assinatura desenhada, em data URL.
  assinaturaPng: string;
  // Versão do termo que o cliente leu (recusa se o texto mudou no meio).
  termoVersao: number;
}

function validarAssinaturaPng(dataUrl: string): void {
  const m = ASSINATURA_PNG.exec(dataUrl);
  if (!m) throw new ErroNegocio("Desenhe a assinatura no quadro.");
  const bytes = Buffer.from(m[1], "base64");
  if (
    bytes.length < MENOR_ASSINATURA_BYTES ||
    bytes.length > MAIOR_ASSINATURA_BYTES ||
    !bytes.subarray(0, 8).equals(CABECALHO_PNG)
  ) {
    throw new ErroNegocio("A assinatura não é válida. Desenhe de novo.");
  }
}

// Registra o aceite feito pelo próprio cliente no link. O aceite é imutável e
// guarda a assinatura desenhada, o hash do texto, o IP e o aparelho.
export async function assinarPorConvite(
  token: string,
  dados: AssinaturaDigital,
  origem: { ip?: string | null; userAgent?: string | null },
): Promise<void> {
  const assinante = dados.assinante.trim();
  if (assinante.length < 3) {
    throw new ErroNegocio("Informe o nome completo de quem assina.");
  }
  const documento = dados.documento?.trim() || null;
  if (documento && documento.length > 30) {
    throw new ErroNegocio("Documento longo demais.");
  }
  validarAssinaturaPng(dados.assinaturaPng);
  const atual = await termoAtual();
  if (dados.termoVersao !== atual.versao) {
    throw new ErroNegocio(
      "O texto do termo foi atualizado. Recarregue a página e leia de novo.",
    );
  }

  await transacao(async (cliente) => {
    const { rows } = await cliente.query<{
      id: string;
      cliente_id: string;
      nome: string;
      nascimento: string | null;
      usado_em: Date | null;
      expirado: boolean;
    }>(
      `select tc.id, tc.cliente_id, c.nome,
              to_char(c.nascimento, 'YYYY-MM-DD') as nascimento,
              tc.usado_em, tc.expira_em <= now() as expirado
         from termo_convite tc join cliente c on c.id = tc.cliente_id
        where tc.token = $1 for update of tc`,
      [token],
    );
    const convite = rows[0];
    if (!convite) throw new ErroNegocio("Link inválido.");
    if (convite.usado_em) {
      throw new ErroNegocio("Este termo já foi assinado.");
    }
    if (convite.expirado) {
      throw new ErroNegocio("Este link venceu. Peça um novo à equipe.");
    }
    const menor = ehMenor(convite.nascimento);
    const porMenor = dados.porMenor || menor;
    if (menor && assinante.toLowerCase() === convite.nome.toLowerCase()) {
      throw new ErroNegocio(
        "Piloto menor de 18 anos: o termo deve ser assinado pelo responsável legal.",
      );
    }
    const aceiteId = `aceite-${randomUUID()}`;
    await cliente.query(
      `insert into termo_aceite (id, cliente_id, termo_versao_id, assinante_nome,
                                 por_menor, registrado_por, ip, canal,
                                 assinatura_png, texto_hash, documento, user_agent)
       values ($1, $2, $3, $4, $5, 'link', $6, 'link', $7, $8, $9, $10)`,
      [
        aceiteId,
        convite.cliente_id,
        atual.id,
        assinante,
        porMenor,
        origem.ip ?? null,
        dados.assinaturaPng,
        hashDoTexto(atual.texto),
        documento,
        origem.userAgent?.slice(0, 300) ?? null,
      ],
    );
    await cliente.query(
      "update termo_convite set usado_em = clock_timestamp(), aceite_id = $2 where id = $1",
      [convite.id, aceiteId],
    );
    await registrarAuditoria(
      {
        usuarioId: null,
        ip: origem.ip,
        acao: "termo.aceite",
        entidade: "termo_aceite",
        entidadeId: aceiteId,
        depois: {
          clienteId: convite.cliente_id,
          versao: atual.versao,
          assinante,
          porMenor,
          canal: "link",
        },
      },
      cliente,
    );
  });
}

export interface AceiteDoCliente {
  id: string;
  aceitoEm: Date;
  assinante: string;
  porMenor: boolean;
  canal: "balcao" | "link";
  versao: number;
  assinaturaPng?: string;
  documento?: string;
}

// Último aceite do cliente (para o comprovante na ficha do cliente).
export async function ultimoAceiteDoCliente(
  clienteId: string,
): Promise<AceiteDoCliente | null> {
  const [l] = await consultar<{
    id: string;
    aceito_em: Date;
    assinante_nome: string;
    por_menor: boolean;
    canal: "balcao" | "link";
    versao: number;
    assinatura_png: string | null;
    documento: string | null;
  }>(
    `select a.id, a.aceito_em, a.assinante_nome, a.por_menor, a.canal,
            v.versao, a.assinatura_png, a.documento
       from termo_aceite a join termo_versao v on v.id = a.termo_versao_id
      where a.cliente_id = $1 order by a.aceito_em desc limit 1`,
    [clienteId],
  );
  return l
    ? {
        id: l.id,
        aceitoEm: l.aceito_em,
        assinante: l.assinante_nome,
        porMenor: l.por_menor,
        canal: l.canal,
        versao: l.versao,
        assinaturaPng: l.assinatura_png ?? undefined,
        documento: l.documento ?? undefined,
      }
    : null;
}
