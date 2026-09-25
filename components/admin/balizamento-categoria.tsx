"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { corDoKart } from "@/lib/kart-cor";
import type { Categoria, Piloto } from "@/lib/types";

interface Troca {
  id: string;
  motivo: string;
  horario: string;
}

const LASTRO_MAXIMO = 5;

interface LinhaSorteio {
  pesoKg: string;
  lastroQtd: string;
  kartNumero: string;
  motivoTroca: string;
  trocas: Troca[];
}

function linhaVazia(): LinhaSorteio {
  return {
    pesoKg: "",
    lastroQtd: "",
    kartNumero: "",
    motivoTroca: "",
    trocas: [],
  };
}

export function BalizamentoCategoria({
  categoria,
  pilotos,
}: {
  categoria: Categoria;
  pilotos: Piloto[];
}) {
  const [linhas, setLinhas] = useState<Record<string, LinhaSorteio>>(() =>
    Object.fromEntries(pilotos.map((p) => [p.id, linhaVazia()])),
  );

  function atualizar(pilotoId: string, campo: Partial<LinhaSorteio>) {
    setLinhas((prev) => ({
      ...prev,
      [pilotoId]: { ...prev[pilotoId], ...campo },
    }));
  }

  function embaralhar() {
    const numeros = pilotos.map((_, i) => i + 1);
    for (let i = numeros.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numeros[i], numeros[j]] = [numeros[j], numeros[i]];
    }
    setLinhas((prev) => {
      const novo = { ...prev };
      pilotos.forEach((p, i) => {
        novo[p.id] = { ...novo[p.id], kartNumero: String(numeros[i]) };
      });
      return novo;
    });
  }

  function solicitarTroca(pilotoId: string) {
    const linha = linhas[pilotoId];
    if (!linha.motivoTroca.trim()) return;
    const horario = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    atualizar(pilotoId, {
      motivoTroca: "",
      trocas: [
        ...linha.trocas,
        {
          id: `${pilotoId}-${linha.trocas.length}`,
          motivo: linha.motivoTroca.trim(),
          horario,
        },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-ink text-sm font-medium">{categoria.nome}</h2>
        <Button variant="secondary" onClick={embaralhar}>
          Embaralhar karts
        </Button>
      </div>

      <div className="border-border bg-surface overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-border text-ink-3 border-b text-xs tracking-wide uppercase">
              <th className="px-4 py-3 font-medium">Piloto</th>
              <th className="px-4 py-3 font-medium">Peso (kg)</th>
              <th className="px-4 py-3 font-medium">Lastro</th>
              <th className="px-4 py-3 font-medium">Kart</th>
              <th className="px-4 py-3 font-medium">Troca de kart</th>
            </tr>
          </thead>
          <tbody>
            {pilotos.map((pilotoAtual) => {
              const linha = linhas[pilotoAtual.id];
              const kartNumero = Number(linha.kartNumero);

              return (
                <tr
                  key={pilotoAtual.id}
                  className="border-border border-b align-top last:border-0"
                >
                  <td className="text-ink px-4 py-3 font-medium">
                    {pilotoAtual.nome}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={linha.pesoKg}
                      onChange={(e) =>
                        atualizar(pilotoAtual.id, { pesoKg: e.target.value })
                      }
                      placeholder="—"
                      className="border-border-strong focus:border-orange w-20 rounded-md border px-2 py-1 font-mono text-sm outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={LASTRO_MAXIMO}
                        value={linha.lastroQtd}
                        onChange={(e) => {
                          const bruto = e.target.value;
                          if (bruto.trim() === "") {
                            atualizar(pilotoAtual.id, { lastroQtd: "" });
                            return;
                          }
                          const limitado = Math.min(
                            LASTRO_MAXIMO,
                            Math.max(0, Number(bruto)),
                          );
                          atualizar(pilotoAtual.id, {
                            lastroQtd: String(limitado),
                          });
                        }}
                        placeholder="0"
                        className="border-border-strong focus:border-orange w-14 rounded-md border px-2 py-1 font-mono text-sm outline-none"
                      />
                      <span className="text-ink-3 text-xs">
                        un. (máx. {LASTRO_MAXIMO})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={linha.kartNumero}
                      onChange={(e) =>
                        atualizar(pilotoAtual.id, {
                          kartNumero: e.target.value,
                        })
                      }
                      placeholder="—"
                      className={clsx(
                        "w-14 rounded-md px-2 py-1 text-center font-mono text-sm font-semibold outline-none",
                        corDoKart(kartNumero),
                      )}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {linha.trocas.map((troca) => (
                        <p key={troca.id} className="text-ink-3 text-xs">
                          {troca.horario} — {troca.motivo}
                        </p>
                      ))}
                      <div className="flex gap-1.5">
                        <input
                          value={linha.motivoTroca}
                          onChange={(e) =>
                            atualizar(pilotoAtual.id, {
                              motivoTroca: e.target.value,
                            })
                          }
                          placeholder="Motivo da troca"
                          className="border-border-strong focus:border-orange w-36 rounded-md border px-2 py-1 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => solicitarTroca(pilotoAtual.id)}
                          className="text-orange shrink-0 text-xs font-medium hover:underline"
                        >
                          Registrar
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
