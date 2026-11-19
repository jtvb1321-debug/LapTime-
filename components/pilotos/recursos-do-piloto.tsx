"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { criarRecursoAction } from "@/lib/resultados-campeonato-actions";
import type { AcaoState } from "@/lib/operacao-actions";
import type { RecursoCompleto } from "@/lib/resultados-campeonato-store";

// O piloto contesta um resultado ou uma decisão; a organização responde (deferido ou indeferido).
export function RecursosDoPiloto({
  etapas,
  recursos,
}: {
  etapas: { id: string; nome: string }[];
  recursos: RecursoCompleto[];
}) {
  const [etapa, setEtapa] = useState("");
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-surface flex max-w-xl flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rec-etapa" className="text-ink text-sm font-medium">
            Etapa (opcional)
          </label>
          <select
            id="rec-etapa"
            value={etapa}
            onChange={(e) => setEtapa(e.target.value)}
            className="campo"
          >
            <option value="">Não é de uma etapa específica</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rec-texto" className="text-ink text-sm font-medium">
            O que você quer contestar
          </label>
          <textarea
            id="rec-texto"
            rows={4}
            maxLength={1500}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Explique com calma o que aconteceu e o que você pede."
            className="campo"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={pendente || texto.trim().length < 10}
            carregando={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await criarRecursoAction(etapa || null, texto);
                setResultado(r);
                if (r.ok) setTexto("");
              })
            }
          >
            Enviar recurso
          </Button>
          {resultado?.erro ? (
            <p role="alert" className="text-danger text-sm">
              {resultado.erro}
            </p>
          ) : null}
          {resultado?.ok ? (
            <p role="status" className="text-success text-sm">
              {resultado.ok}
            </p>
          ) : null}
        </div>
      </div>

      {recursos.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {recursos.map((r) => (
            <li
              key={r.id}
              className="border-border bg-surface flex flex-col gap-1.5 rounded-lg border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink-3 text-xs">
                  {r.etapaNome ?? "Geral"} ·{" "}
                  {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
                </span>
                <StatusPill
                  tone={
                    r.status === "aberto"
                      ? "warning"
                      : r.status === "deferido"
                        ? "success"
                        : "neutral"
                  }
                >
                  {r.status === "aberto" ? "aguardando" : r.status}
                </StatusPill>
              </div>
              <p className="text-ink-2 text-sm whitespace-pre-line">
                {r.texto}
              </p>
              {r.parecer ? (
                <p className="text-ink text-sm">
                  <span className="font-medium">Resposta da organização:</span>{" "}
                  {r.parecer}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
