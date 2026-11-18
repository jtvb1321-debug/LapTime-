import { consultar, transacao } from "@/lib/db/conexao";
import type { PapelUsuario } from "@/lib/types";

// Contas de acesso para a tela de administração de usuários. Nunca devolve o hash da senha.
export const PAPEIS: { valor: PapelUsuario; rotulo: string }[] = [
  { valor: "piloto", rotulo: "Piloto (só consulta)" },
  { valor: "recepcao", rotulo: "Recepção (balcão e caixa)" },
  { valor: "operador", rotulo: "Operador (pista)" },
  { valor: "fiscal", rotulo: "Fiscal (provas e resultados)" },
  { valor: "admin", rotulo: "Administrador (acesso total)" },
];

export interface UsuarioListado {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  criadoEm: Date;
  pilotoNumero: number | null;
}

export async function listarUsuarios(busca = ""): Promise<UsuarioListado[]> {
  const termo = `%${busca.trim().toLowerCase()}%`;
  const linhas = await consultar<{
    id: string;
    nome: string;
    email: string;
    papel: PapelUsuario;
    ativo: boolean;
    criado_em: Date;
    numero: number | null;
  }>(
    `select p.id, p.nome, p.email, p.papel, p.ativo, p.criado_em, pi.numero
       from perfil p left join piloto pi on pi.id = p.piloto_id
      where $1 = '%%' or lower(p.nome) like $1 or lower(p.email) like $1
      order by case p.papel when 'admin' then 0 else 1 end, p.nome, p.id`,
    [termo],
  );
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    email: l.email,
    papel: l.papel,
    ativo: l.ativo,
    criadoEm: l.criado_em,
    pilotoNumero: l.numero,
  }));
}

export class ErroDeUsuario extends Error {}

export async function encontrarUsuario(
  id: string,
): Promise<{ id: string; email: string; papel: PapelUsuario } | null> {
  const [l] = await consultar<{
    id: string;
    email: string;
    papel: PapelUsuario;
  }>("select id, email, papel from perfil where id = $1", [id]);
  return l ?? null;
}

// Troca a senha e derruba as sessões abertas dessa conta (quem estava logado precisa entrar de novo).
export async function trocarSenha(perfilId: string, hash: string) {
  await transacao(async (c) => {
    const r = await c.query("update perfil set senha_hash = $1 where id = $2", [
      hash,
      perfilId,
    ]);
    if (r.rowCount === 0) throw new ErroDeUsuario("Usuário não encontrado.");
    await c.query(
      "update sessao set revogada_em = now() where perfil_id = $1 and revogada_em is null",
      [perfilId],
    );
  });
}

// Muda o acesso da conta. Nunca deixa o sistema sem um administrador ativo.
export async function trocarPapel(
  perfilId: string,
  novo: PapelUsuario,
): Promise<{ antes: PapelUsuario }> {
  return transacao(async (c) => {
    const atual = await c.query<{ papel: PapelUsuario }>(
      "select papel from perfil where id = $1 for update",
      [perfilId],
    );
    if (!atual.rows[0]) throw new ErroDeUsuario("Usuário não encontrado.");
    const antes = atual.rows[0].papel;
    if (antes === "admin" && novo !== "admin") {
      const outros = await c.query<{ n: number }>(
        "select count(*)::int as n from perfil where papel = 'admin' and ativo and id <> $1",
        [perfilId],
      );
      if (outros.rows[0].n === 0) {
        throw new ErroDeUsuario(
          "O sistema precisa ter pelo menos um administrador ativo.",
        );
      }
    }
    await c.query("update perfil set papel = $1 where id = $2", [
      novo,
      perfilId,
    ]);
    return { antes };
  });
}
