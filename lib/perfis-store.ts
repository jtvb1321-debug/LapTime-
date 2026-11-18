import type { PoolClient } from "pg";
import { consultar } from "@/lib/db/conexao";
import type { PapelUsuario, Perfil } from "@/lib/types";

// Perfis (contas de acesso) no Postgres. `ativo = false` bloqueia o login
// sem apagar o histórico.
interface LinhaPerfil {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  piloto_id: string | null;
  avatar_url: string | null;
  senha_hash: string | null;
  ativo: boolean;
}

export function perfilDeLinha(linha: LinhaPerfil): Perfil {
  return {
    id: linha.id,
    userId: linha.user_id,
    nome: linha.nome,
    email: linha.email,
    papel: linha.papel,
    pilotoId: linha.piloto_id ?? undefined,
    avatarUrl: linha.avatar_url ?? undefined,
    senhaHash: linha.senha_hash ?? undefined,
  };
}

const COLUNAS =
  "id, user_id, nome, email, papel, piloto_id, avatar_url, senha_hash, ativo";

const INSERIR = `insert into perfil (id, user_id, nome, email, papel, piloto_id, avatar_url, senha_hash)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`;

function parametros(perfil: Perfil) {
  return [
    perfil.id,
    perfil.userId,
    perfil.nome,
    perfil.email,
    perfil.papel,
    perfil.pilotoId ?? null,
    perfil.avatarUrl ?? null,
    perfil.senhaHash ?? null,
  ];
}

export async function lerPerfis(): Promise<Perfil[]> {
  const linhas = await consultar<LinhaPerfil>(
    `select ${COLUNAS} from perfil order by criado_em, id`,
  );
  return linhas.map(perfilDeLinha);
}

// Dentro de uma transação (ver lib/cadastro-store.ts).
export async function inserirPerfil(
  cliente: PoolClient,
  perfil: Perfil,
): Promise<void> {
  await cliente.query(INSERIR, parametros(perfil));
}

export async function adicionarPerfil(perfil: Perfil): Promise<void> {
  await consultar(INSERIR, parametros(perfil));
}

// Devolve também `ativo` — o login recusa perfil inativo.
export async function encontrarPerfilPorEmailStore(
  email: string,
): Promise<(Perfil & { ativo: boolean }) | undefined> {
  const linhas = await consultar<LinhaPerfil>(
    `select ${COLUNAS} from perfil where lower(email) = lower($1)`,
    [email],
  );
  const linha = linhas[0];
  return linha ? { ...perfilDeLinha(linha), ativo: linha.ativo } : undefined;
}

export async function emailJaCadastrado(email: string): Promise<boolean> {
  const linhas = await consultar(
    "select 1 from perfil where lower(email) = lower($1)",
    [email],
  );
  return linhas.length > 0;
}
