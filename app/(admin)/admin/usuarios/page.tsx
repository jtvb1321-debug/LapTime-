import type { Metadata } from "next";
import { Campo, FormAcao, Selecao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissao } from "@/lib/auth";
import {
  alterarAcessoAction,
  redefinirSenhaAction,
} from "@/lib/usuarios-actions";
import { listarUsuarios, PAPEIS } from "@/lib/usuarios-store";

export const metadata: Metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

const ROTULO_PAPEL = Object.fromEntries(
  PAPEIS.map((p) => [p.valor, p.rotulo.split(" (")[0]]),
);

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sessao = await exigirPermissao("usuario.administrar");
  if (!sessao) return <SemPermissao />;
  const { q } = await searchParams;
  const usuarios = await listarUsuarios(q ?? "");

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Usuários"
        description="Veja o e-mail de cada conta, redefina senhas e defina o acesso. Quem é administrador tem acesso total ao sistema."
      />

      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar usuário"
          className="campo w-full max-w-sm"
        />
        <button
          type="submit"
          className="text-ink border-border-strong min-h-11 rounded-md border px-4 text-sm font-medium"
        >
          Buscar
        </button>
      </form>

      {usuarios.length === 0 ? (
        <p className="text-ink-2 text-sm">Nenhum usuário encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {usuarios.map((u) => {
            const ehVoce = u.id === sessao.id;
            return (
              <li key={u.id}>
                <Card>
                  <CardBody className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-ink font-medium">
                          {u.nome}
                          {ehVoce ? (
                            <span className="text-ink-3 ml-2 text-xs">
                              (você)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-ink-2 text-sm break-all">
                          {u.email}
                        </p>
                        <p className="text-ink-3 mt-0.5 text-xs">
                          {u.pilotoNumero !== null
                            ? `Piloto nº ${u.pilotoNumero} · `
                            : ""}
                          {u.ativo ? "Conta ativa" : "Conta desativada"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          u.papel === "admin"
                            ? "bg-orange text-on-orange"
                            : "bg-ink/5 text-ink-2"
                        }`}
                      >
                        {ROTULO_PAPEL[u.papel] ?? u.papel}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <details className="border-border rounded-md border px-3 py-1">
                        <summary className="text-ink flex min-h-11 cursor-pointer items-center text-sm font-medium">
                          Redefinir senha
                        </summary>
                        <FormAcao
                          action={redefinirSenhaAction}
                          rotulo="Redefinir senha"
                          variante="dark"
                          confirmar={`Redefinir a senha de ${u.email}? Ela será desconectada do sistema.`}
                          className="pb-3"
                        >
                          <input type="hidden" name="perfilId" value={u.id} />
                          <Campo
                            id={`senha-${u.id}`}
                            name="senha"
                            rotulo="Nova senha (opcional)"
                            dica="Deixe em branco para o sistema gerar uma senha forte e mostrar aqui. Mínimo de 8 caracteres se você digitar."
                            type="text"
                            autoComplete="off"
                            minLength={8}
                          />
                        </FormAcao>
                      </details>

                      <details className="border-border rounded-md border px-3 py-1">
                        <summary className="text-ink flex min-h-11 cursor-pointer items-center text-sm font-medium">
                          Acesso à conta
                        </summary>
                        {ehVoce ? (
                          <p className="text-ink-2 pb-3 text-sm">
                            Você não pode mudar o seu próprio acesso.
                          </p>
                        ) : (
                          <FormAcao
                            action={alterarAcessoAction}
                            rotulo="Salvar acesso"
                            variante="dark"
                            limpar={false}
                            confirmar={`Alterar o acesso de ${u.email}?`}
                            className="pb-3"
                          >
                            <input type="hidden" name="perfilId" value={u.id} />
                            <Selecao
                              id={`papel-${u.id}`}
                              name="papel"
                              rotulo="Acesso"
                              defaultValue={u.papel}
                            >
                              {PAPEIS.map((p) => (
                                <option key={p.valor} value={p.valor}>
                                  {p.rotulo}
                                </option>
                              ))}
                            </Selecao>
                          </FormAcao>
                        )}
                      </details>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
