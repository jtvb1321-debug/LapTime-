import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  MAX_FALHAS_LOGIN,
  autenticar,
  buscarSessao,
  criarSessao,
  hashToken,
  revogarSessao,
  revogarSessoesDoPerfil,
} from "@/lib/auth-core";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { adicionarPerfil } from "@/lib/perfis-store";
import { hashSenha } from "@/lib/senha";
import type { Perfil } from "@/lib/types";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

function novoPerfil(id: string, sobre: Partial<Perfil> = {}): Perfil {
  return {
    id,
    userId: `user-${id}`,
    nome: `Nome ${id}`,
    email: `${id}@exemplo.com`,
    papel: "fiscal",
    senhaHash: hashSenha("senha-correta-123"),
    ...sobre,
  };
}

describe.skipIf(!temBancoDeTeste)("autenticação, sessões e bloqueio", () => {
  let remover: () => Promise<void>;

  beforeAll(async () => {
    ({ remover } = await criarEsquemaDeTeste());
    await migrar();
    await adicionarPerfil(novoPerfil("ana"));
    await adicionarPerfil(novoPerfil("inativo"));
    await consultar("update perfil set ativo = false where id = 'inativo'");
    await adicionarPerfil(
      novoPerfil("demo", { senhaHash: undefined, papel: "admin" }),
    );
  });
  afterAll(async () => {
    await remover();
  });
  afterEach(() => {
    delete process.env.AUTH_CONTAS_DEMO;
  });

  it("senha correta entra; senha errada e e-mail inexistente dão a MESMA mensagem", async () => {
    const ok = await autenticar("ANA@exemplo.com", "senha-correta-123");
    expect(ok.ok).toBe(true);

    const errada = await autenticar("ana@exemplo.com", "errada");
    const inexistente = await autenticar("ninguem@exemplo.com", "qualquer");
    expect(errada).toEqual({ ok: false, erro: "E-mail ou senha incorretos." });
    expect(inexistente).toEqual(errada);
  });

  it("perfil inativo não entra, mesmo com a senha certa", async () => {
    const r = await autenticar("inativo@exemplo.com", "senha-correta-123");
    expect(r.ok).toBe(false);
  });

  it("conta sem senha (demonstração) só entra com AUTH_CONTAS_DEMO=1", async () => {
    expect((await autenticar("demo@exemplo.com", "qualquer")).ok).toBe(false);
    process.env.AUTH_CONTAS_DEMO = "1";
    expect((await autenticar("demo@exemplo.com", "qualquer")).ok).toBe(true);
  });

  it("bloqueia depois de várias falhas — inclusive com a senha certa", async () => {
    await adicionarPerfil(novoPerfil("alvo"));
    for (let i = 0; i < MAX_FALHAS_LOGIN; i++) {
      await autenticar("alvo@exemplo.com", `errada-${i}`);
    }
    const r = await autenticar("alvo@exemplo.com", "senha-correta-123");
    expect(r).toMatchObject({ ok: false, bloqueado: true });
  });

  it("login e falhas ficam na auditoria", async () => {
    const [{ n }] = await consultar<{ n: number }>(
      "select count(*)::int as n from audit_log where acao in ('login.sucesso','login.falha')",
    );
    expect(n).toBeGreaterThan(0);
  });

  it("sessão: o banco guarda só o HASH do token; buscar devolve o perfil sem senhaHash", async () => {
    const { token } = await criarSessao("ana", {
      ip: "10.0.0.5",
      userAgent: "teste",
    });
    const linhas = await consultar<{ token_hash: string }>(
      "select token_hash from sessao where perfil_id = 'ana'",
    );
    expect(linhas.map((l) => l.token_hash)).toContain(hashToken(token));
    expect(linhas.map((l) => l.token_hash)).not.toContain(token);

    const perfil = await buscarSessao(token);
    expect(perfil?.id).toBe("ana");
    expect(perfil?.papel).toBe("fiscal");
    expect(perfil?.senhaHash).toBeUndefined();
  });

  it("token inventado ou adulterado não vale", async () => {
    expect(await buscarSessao("token-inventado")).toBeNull();
    expect(await buscarSessao('{"papel":"admin"}')).toBeNull();
    const { token } = await criarSessao("ana");
    expect(await buscarSessao(`${token}x`)).toBeNull();
  });

  it("sessão vencida, revogada ou de perfil inativo é recusada", async () => {
    const vencida = await criarSessao("ana");
    await consultar(
      "update sessao set expira_em = now() - interval '1 minute' where token_hash = $1",
      [hashToken(vencida.token)],
    );
    expect(await buscarSessao(vencida.token)).toBeNull();

    const revogada = await criarSessao("ana");
    expect(await buscarSessao(revogada.token)).not.toBeNull();
    await revogarSessao(revogada.token);
    expect(await buscarSessao(revogada.token)).toBeNull();

    await adicionarPerfil(novoPerfil("saiu"));
    const deInativo = await criarSessao("saiu");
    await consultar("update perfil set ativo = false where id = 'saiu'");
    expect(await buscarSessao(deInativo.token)).toBeNull();
  });

  it("revogar todas as sessões de um perfil derruba todas", async () => {
    const a = await criarSessao("ana");
    const b = await criarSessao("ana");
    await revogarSessoesDoPerfil("ana");
    expect(await buscarSessao(a.token)).toBeNull();
    expect(await buscarSessao(b.token)).toBeNull();
  });
});
