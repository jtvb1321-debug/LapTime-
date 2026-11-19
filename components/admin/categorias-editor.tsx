"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { corSolidaCategoria } from "@/lib/categoria-cor";
import { editarCategoriaAction } from "@/lib/categorias-actions";
import type { AcaoState } from "@/lib/operacao-actions";

export interface CategoriaEditavel {
  id: string;
  nome: string;
  descricao: string;
  pesoMinimoKg: number;
  pilotos: number;
}

const ESTADO_INICIAL: AcaoState = {};

function FormularioDaCategoria({
  categoria,
  aoTerminar,
}: {
  categoria: CategoriaEditavel;
  aoTerminar: () => void;
}) {
  const [estado, acao, pendente] = useActionState(
    editarCategoriaAction,
    ESTADO_INICIAL,
  );
  // Campos controlados: depois de um envio com erro o React limparia os campos não controlados.
  const [nome, setNome] = useState(categoria.nome);
  const [descricao, setDescricao] = useState(categoria.descricao);
  const [peso, setPeso] = useState(String(categoria.pesoMinimoKg));

  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={categoria.id} />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`nome-${categoria.id}`}
          className="text-ink text-sm font-medium"
        >
          Nome
        </label>
        <input
          id={`nome-${categoria.id}`}
          name="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          minLength={2}
          maxLength={40}
          className="campo"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`peso-${categoria.id}`}
          className="text-ink text-sm font-medium"
        >
          Peso mínimo (kg)
        </label>
        <input
          id={`peso-${categoria.id}`}
          name="pesoMinimoKg"
          type="number"
          inputMode="numeric"
          min={0}
          max={300}
          step={1}
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          className="campo"
          aria-describedby={`peso-ajuda-${categoria.id}`}
        />
        <p id={`peso-ajuda-${categoria.id}`} className="text-ink-3 text-xs">
          Use 0 para categoria sem peso mínimo.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`descricao-${categoria.id}`}
          className="text-ink text-sm font-medium"
        >
          Descrição
        </label>
        <textarea
          id={`descricao-${categoria.id}`}
          name="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          maxLength={300}
          className="campo"
        />
      </div>
      {estado.erro ? (
        <p role="alert" className="text-danger text-sm">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-success text-sm">
          {estado.ok}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pendente} carregando={pendente}>
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={aoTerminar}>
          {estado.ok ? "Fechar" : "Cancelar"}
        </Button>
      </div>
    </form>
  );
}

// Uma ficha por categoria (na cor dela) com nome, peso mínimo e quantidade de pilotos; o botão
// "Editar" abre o formulário ali mesmo.
export function CategoriasEditor({
  categorias,
  podeEditar,
}: {
  categorias: CategoriaEditavel[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {categorias.map((c) => (
        <li
          key={c.id}
          className="border-border bg-surface flex flex-col gap-3 overflow-hidden rounded-xl border"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-full ${corSolidaCategoria(c.id)}`}
          />
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-base font-bold">
                <NomeCategoria
                  categoriaId={c.id}
                  className="inline-block rounded-md bg-[#0c1630] px-2.5 py-0.5"
                >
                  {c.nome}
                </NomeCategoria>
              </h2>
              {podeEditar && editando !== c.id ? (
                <Button
                  variant="secondary"
                  onClick={() => setEditando(c.id)}
                  aria-label={`Editar categoria ${c.nome}`}
                >
                  Editar
                </Button>
              ) : null}
            </div>
            {editando === c.id ? (
              <FormularioDaCategoria
                categoria={c}
                aoTerminar={() => setEditando(null)}
              />
            ) : (
              <>
                <p className="text-ink-2 min-h-10 text-xs">
                  {c.descricao || "Sem descrição."}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-3 text-xs tracking-wide uppercase">
                      Peso mínimo
                    </dt>
                    <dd className="text-ink font-display text-sm font-bold">
                      {c.pesoMinimoKg > 0 ? `${c.pesoMinimoKg} kg` : "Livre"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-3 text-xs tracking-wide uppercase">
                      Pilotos
                    </dt>
                    <dd className="text-ink font-display text-sm font-bold">
                      {c.pilotos}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
