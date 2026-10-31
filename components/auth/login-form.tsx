"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { loginMockAction, type LoginState } from "@/lib/auth-actions";

const ESTADO_INICIAL: LoginState = {};

const CONTAS_DEMO = [
  { email: "admin@gridlap.com.br", papel: "admin" },
  { email: "fiscal@gridlap.com.br", papel: "fiscal" },
  { email: "jhonattan@gridlap.com.br", papel: "piloto" },
];

export function LoginForm({
  redirectTo,
  mostrarContasDemo = false,
}: {
  redirectTo: string;
  mostrarContasDemo?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    loginMockAction,
    ESTADO_INICIAL,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-ink text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={state.email}
            autoComplete="username"
            className="border-border-strong bg-surface text-ink focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha" className="text-ink text-sm font-medium">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            autoComplete="current-password"
            className="border-border-strong bg-surface text-ink focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
          />
        </div>

        {state.erro ? (
          <p role="alert" className="text-orange-ink text-sm">
            {state.erro}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="text-ink-2 text-center text-sm">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="text-orange-ink font-medium hover:underline"
        >
          Cadastre-se como piloto
        </Link>
      </p>

      {mostrarContasDemo ? (
        <div className="border-border bg-bg text-ink-2 rounded-md border px-4 py-3 text-xs">
          <p className="text-ink-2 mb-1.5 font-medium">
            Contas de demonstração (modo local, qualquer senha):
          </p>
          <ul className="flex flex-col gap-0.5 font-mono">
            {CONTAS_DEMO.map((conta) => (
              <li key={conta.email}>
                {conta.email} — {conta.papel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
