import { createHash, randomBytes } from "node:crypto";
import { registrarAuditoria } from "@/lib/audit";
import { consultar } from "@/lib/db/conexao";
import {
  encontrarPerfilPorEmailStore,
  perfilDeLinha,
} from "@/lib/perfis-store";
import { hashSenha, verificarSenha } from "@/lib/senha";
import type { Perfil } from "@/lib/types";

// Núcleo da autenticação, sem dependência do Next (testável): sessões no
// banco — o cookie guarda só um token aleatório e o banco guarda o HASH dele
// —, login com bloqueio por tentativas e revogação.
export const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;
export const MAX_FALHAS_LOGIN = 5;
export const JANELA_BLOQUEIO_MIN = 10;

export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Contas de demonstração antigas (sem senha, aceitavam qualquer uma) só
// entram se AUTH_CONTAS_DEMO=1 — desligado por padrão.
export function contasDemoPermitidas(): boolean {
  return process.env.AUTH_CONTAS_DEMO === "1";
}

let hashFalso: string | undefined;

export type ResultadoLogin =
  | { ok: true; perfil: Perfil }
  | { ok: false; erro: string; bloqueado?: boolean };

export async function autenticar(
  email: string,
  senha: string,
  ip?: string | null,
): Promise<ResultadoLogin> {
  const emailNormalizado = email.trim().toLowerCase();

  const [{ n }] = await consultar<{ n: number }>(
    `select count(*)::int as n from audit_log
      where acao = 'login.falha' and entidade = 'login' and entidade_id = $1
        and criado_em > now() - make_interval(mins => $2)`,
    [emailNormalizado, JANELA_BLOQUEIO_MIN],
  );
  if (n >= MAX_FALHAS_LOGIN) {
    return {
      ok: false,
      erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
      bloqueado: true,
    };
  }

  const perfil = await encontrarPerfilPorEmailStore(emailNormalizado);
  let valido = false;
  if (perfil?.ativo && perfil.senhaHash) {
    valido = verificarSenha(senha, perfil.senhaHash);
  } else if (perfil?.ativo && contasDemoPermitidas()) {
    valido = true;
  } else {
    // Gasta o mesmo tempo de uma verificação real, pra não revelar por
    // tempo de resposta se o e-mail existe.
    hashFalso ??= hashSenha("senha-falsa-para-igualar-o-tempo");
    verificarSenha(senha, hashFalso);
  }

  if (!valido || !perfil) {
    await registrarAuditoria({
      acao: "login.falha",
      entidade: "login",
      entidadeId: emailNormalizado,
      ip,
    });
    return { ok: false, erro: "E-mail ou senha incorretos." };
  }

  await registrarAuditoria({
    usuarioId: perfil.id,
    acao: "login.sucesso",
    entidade: "login",
    entidadeId: emailNormalizado,
    ip,
  });
  const { ativo: _ativo, ...semAtivo } = perfil;
  void _ativo;
  return { ok: true, perfil: semAtivo };
}

export async function criarSessao(
  perfilId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiraEm: Date }> {
  const token = gerarToken();
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await consultar(
    `insert into sessao (token_hash, perfil_id, expira_em, ip, user_agent)
     values ($1, $2, $3, $4, $5)`,
    [
      hashToken(token),
      perfilId,
      expiraEm,
      meta.ip ?? null,
      meta.userAgent ?? null,
    ],
  );
  // Limpeza oportunista de sessões vencidas há mais de uma semana.
  await consultar(
    "delete from sessao where expira_em < now() - interval '7 days'",
  );
  return { token, expiraEm };
}

// Perfil dono do token, se a sessão estiver válida (não vencida, não
// revogada, perfil ativo). Nunca devolve o hash da senha.
export async function buscarSessao(token: string): Promise<Perfil | null> {
  const hash = hashToken(token);
  const linhas = await consultar<Parameters<typeof perfilDeLinha>[0]>(
    `select p.id, p.user_id, p.nome, p.email, p.papel, p.piloto_id,
            p.avatar_url, null::text as senha_hash, p.ativo
       from sessao s join perfil p on p.id = s.perfil_id
      where s.token_hash = $1 and s.revogada_em is null
        and s.expira_em > now() and p.ativo`,
    [hash],
  );
  if (!linhas[0]) return null;
  await consultar(
    `update sessao set ultimo_uso = now()
      where token_hash = $1 and ultimo_uso < now() - interval '5 minutes'`,
    [hash],
  );
  return perfilDeLinha(linhas[0]);
}

export async function revogarSessao(token: string): Promise<void> {
  await consultar(
    "update sessao set revogada_em = now() where token_hash = $1 and revogada_em is null",
    [hashToken(token)],
  );
}

export async function revogarSessoesDoPerfil(perfilId: string): Promise<void> {
  await consultar(
    "update sessao set revogada_em = now() where perfil_id = $1 and revogada_em is null",
    [perfilId],
  );
}
