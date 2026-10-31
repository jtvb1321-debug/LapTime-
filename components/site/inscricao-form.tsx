"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  inscricaoMockAction,
  type InscricaoState,
} from "@/lib/inscricao-actions";
import type { Categoria, Etapa } from "@/lib/types";

const ESTADO_INICIAL: InscricaoState = {};

export function InscricaoForm({
  categorias,
  etapas,
}: {
  categorias: Categoria[];
  etapas: Etapa[];
}) {
  const [state, formAction, pending] = useActionState(
    inscricaoMockAction,
    ESTADO_INICIAL,
  );

  if (state.sucesso) {
    return (
      <div className="border-orange/30 bg-orange/5 text-orange-ink rounded-lg border px-5 py-4 text-sm">
        Inscrição recebida! (modo demonstração local — nenhum dado foi salvo
        ainda)
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nome" className="text-ink text-sm font-medium">
          Nome completo
        </label>
        <input
          id="nome"
          name="nome"
          required
          className="border-border-strong bg-surface text-ink focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-ink text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="border-border-strong bg-surface text-ink focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoriaId" className="text-ink text-sm font-medium">
          Categoria
        </label>
        <select
          id="categoriaId"
          name="categoriaId"
          required
          defaultValue=""
          className="border-border-strong bg-surface text-ink focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
        >
          <option value="" disabled>
            Selecione
          </option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="etapaId" className="text-ink text-sm font-medium">
          Etapa
        </label>
        <select
          id="etapaId"
          name="etapaId"
          required
          defaultValue=""
          className="border-border-strong bg-surface text-ink focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
        >
          <option value="" disabled>
            Selecione
          </option>
          {etapas.map((etapa) => (
            <option key={etapa.id} value={etapa.id}>
              Etapa {etapa.numero} — {etapa.kartodromo}
            </option>
          ))}
        </select>
      </div>

      <label className="text-ink-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="aceite"
          className="border-border-strong accent-orange rounded"
        />
        Li e aceito o regulamento do campeonato
      </label>

      {state.erro ? (
        <p className="text-orange-ink text-sm">{state.erro}</p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando…" : "Confirmar inscrição"}
      </Button>
    </form>
  );
}
