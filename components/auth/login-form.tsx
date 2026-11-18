"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginMockAction, type LoginState } from "@/lib/auth-actions";

const ESTADO_INICIAL: LoginState = {};

const CONTAS_DEMO = [
  { email: "admin@gridlap.com.br", papel: "admin" },
  { email: "fiscal@gridlap.com.br", papel: "fiscal" },
  { email: "jhonattan@gridlap.com.br", papel: "piloto" },
];

const CAMPO =
  "peer block w-full border-0 border-b-2 border-white/40 bg-transparent px-0 py-2.5 text-sm text-white focus:border-[#4cc9ff] focus:ring-0 focus:outline-none";
const ROTULO =
  "pointer-events-none absolute top-3 left-0 origin-[0] -translate-y-6 scale-75 transform text-sm text-[#cfdcf3] duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-[#4cc9ff]";
const ICONE = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  className: "mr-2 -mt-1 inline-block size-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

// Formulário de entrada em vidro fosco (tela de login). A ação, os campos e as mensagens são os
// de sempre; só a aparência mudou.
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
      <form action={formAction} className="flex flex-col gap-8">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="relative">
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={state.email}
            autoComplete="username"
            placeholder=" "
            className={CAMPO}
          />
          <label htmlFor="email" className={ROTULO}>
            <svg {...ICONE}>
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            E-mail
          </label>
        </div>

        <div className="relative">
          <input
            id="senha"
            name="senha"
            type="password"
            required
            autoComplete="current-password"
            placeholder=" "
            className={CAMPO}
          />
          <label htmlFor="senha" className={ROTULO}>
            <svg {...ICONE}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Senha
          </label>
        </div>

        {state.erro ? (
          <p role="alert" className="-mt-4 text-sm text-[#ff8da1]">
            {state.erro}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="group flex w-full items-center justify-center rounded-lg bg-[#2b6ef5] px-4 py-3 font-semibold text-white shadow-[0_0_18px_rgba(43,110,245,0.55)] transition-all duration-300 hover:bg-[#1d55d6] focus-visible:ring-2 focus-visible:ring-[#4cc9ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a14] focus-visible:outline-none disabled:opacity-70"
        >
          {pending ? "Entrando…" : "Entrar"}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="ml-2 size-5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>

      <p className="text-center text-xs text-[#9fb2d4]">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="font-semibold text-[#4cc9ff] hover:text-white"
        >
          Cadastre-se como piloto
        </Link>
      </p>

      {mostrarContasDemo ? (
        <div className="rounded-md border border-white/15 bg-black/20 px-4 py-3 text-xs text-[#cfdcf3]">
          <p className="mb-1.5 font-medium">
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
