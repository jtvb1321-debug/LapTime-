"use client";

import { clsx } from "clsx";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import type { AcaoState } from "@/lib/operacao-actions";

const ESTADO_INICIAL: AcaoState = {};

// Formulário de uma ação do balcão: mostra "salvando", a mensagem de erro
// (em linguagem de balcão) ou a confirmação, e limpa os campos ao dar certo.
export function FormAcao({
  action,
  rotulo,
  variante = "primary",
  limpar = true,
  confirmar,
  className,
  children,
}: {
  action: (anterior: AcaoState, dados: FormData) => Promise<AcaoState>;
  rotulo: string;
  variante?: "primary" | "dark" | "secondary" | "ghost";
  limpar?: boolean;
  // Ação crítica: pede confirmação antes de enviar.
  confirmar?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [estado, executar, pendente] = useActionState(action, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok && limpar) formulario.current?.reset();
  }, [estado, limpar]);

  // Envio manual (e não `<form action>`): o React limpa o formulário depois de
  // toda ação, mesmo com erro — e o operador perderia o que digitou.
  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (confirmar && !window.confirm(confirmar)) return;
    const dados = new FormData(evento.currentTarget);
    startTransition(() => executar(dados));
  }

  return (
    <form
      ref={formulario}
      onSubmit={aoEnviar}
      className={clsx("flex flex-col gap-3", className)}
    >
      {children}
      {estado.erro ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-ink-2 text-sm break-all">
          {estado.ok}
        </p>
      ) : null}
      <Button
        type="submit"
        variant={variante}
        disabled={pendente}
        aria-busy={pendente}
      >
        {pendente ? "Aguarde…" : rotulo}
      </Button>
    </form>
  );
}

const CLASSE_CAMPO =
  "border-border-strong bg-surface text-ink focus:border-orange w-full rounded-md border px-3 py-2 text-sm outline-none";

export function Campo({
  id,
  rotulo,
  dica,
  className,
  ...props
}: {
  id: string;
  rotulo: string;
  dica?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {rotulo}
      </label>
      <input id={id} name={id} className={CLASSE_CAMPO} {...props} />
      {dica ? <p className="text-ink-3 text-xs">{dica}</p> : null}
    </div>
  );
}

export function Selecao({
  id,
  rotulo,
  children,
  ...props
}: {
  id: string;
  rotulo: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {rotulo}
      </label>
      <select id={id} name={id} className={CLASSE_CAMPO} {...props}>
        {children}
      </select>
    </div>
  );
}
