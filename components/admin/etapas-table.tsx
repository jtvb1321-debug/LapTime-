"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { StatusPill, toneParaStatus } from "@/components/ui/status-pill";
import { formatData } from "@/lib/mock/data";
import { useMockStore } from "@/lib/use-mock-store";
import type { Etapa, Tracado } from "@/lib/types";

export function EtapasTable({
  etapasIniciais,
  tracados,
  campeonatoId,
}: {
  etapasIniciais: Etapa[];
  tracados: Tracado[];
  campeonatoId?: string;
}) {
  const [etapas, setEtapas] = useMockStore("gridlap:etapas", etapasIniciais);
  const [formAberto, setFormAberto] = useState(false);
  const [numero, setNumero] = useState("");
  const [kartodromo, setKartodromo] = useState("VeloKart");
  const [cidade, setCidade] = useState("");
  const [data, setData] = useState("");
  const [tracadoId, setTracadoId] = useState("");
  const [erro, setErro] = useState("");

  function criarEtapa() {
    if (!campeonatoId) {
      setErro("Cadastre um campeonato antes de criar etapas.");
      return;
    }
    if (!numero.trim() || !kartodromo.trim() || !cidade.trim() || !data) {
      setErro("Preencha número, kartódromo, cidade e data.");
      return;
    }
    const nova: Etapa = {
      id: `etapa-${Date.now()}`,
      campeonatoId,
      numero: Number(numero),
      nome: `Etapa ${numero}`,
      kartodromo: kartodromo.trim(),
      cidade: cidade.trim(),
      data,
      status: "agendada",
      tracadoId: tracadoId || undefined,
    };
    setEtapas((prev) => [...prev, nova]);
    setNumero("");
    setCidade("");
    setData("");
    setTracadoId("");
    setErro("");
    setFormAberto(false);
  }

  function alterarTracado(etapaId: string, novoTracadoId: string) {
    setEtapas((prev) =>
      prev.map((e) =>
        e.id === etapaId ? { ...e, tracadoId: novoTracadoId || undefined } : e,
      ),
    );
  }

  const colunas: Coluna<Etapa>[] = [
    { header: "Nº", cell: (e) => e.numero, numerica: true },
    { header: "Kartódromo", cell: (e) => e.kartodromo },
    { header: "Cidade", cell: (e) => e.cidade },
    { header: "Data", cell: (e) => formatData(e.data) },
    {
      header: "Status",
      cell: (e) => (
        <StatusPill tone={toneParaStatus(e.status)}>
          {e.status.replace("_", " ")}
        </StatusPill>
      ),
    },
    {
      header: "Traçado",
      cell: (e) => (
        <select
          aria-label={`Traçado da etapa ${e.numero}`}
          value={e.tracadoId ?? ""}
          onChange={(ev) => alterarTracado(e.id, ev.target.value)}
          className="campo px-2 py-1 text-xs"
        >
          <option value="">Não definido</option>
          {tracados.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={() => setFormAberto((aberto) => !aberto)}
        >
          {formAberto ? "Cancelar" : "Nova etapa"}
        </Button>
      </div>

      {formAberto ? (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-numero"
                className="text-ink text-sm font-medium"
              >
                Número
              </label>
              <input
                id="etapa-numero"
                type="number"
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="1"
                className="campo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-kartodromo"
                className="text-ink text-sm font-medium"
              >
                Kartódromo
              </label>
              <input
                id="etapa-kartodromo"
                value={kartodromo}
                onChange={(e) => setKartodromo(e.target.value)}
                className="campo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-cidade"
                className="text-ink text-sm font-medium"
              >
                Cidade
              </label>
              <input
                id="etapa-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Cotia"
                className="campo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-data"
                className="text-ink text-sm font-medium"
              >
                Data
              </label>
              <input
                id="etapa-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="campo"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="etapa-tracado"
              className="text-ink text-sm font-medium"
            >
              Traçado (opcional)
            </label>
            <select
              id="etapa-tracado"
              value={tracadoId}
              onChange={(e) => setTracadoId(e.target.value)}
              className="campo"
            >
              <option value="">Não definido</option>
              {tracados.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          {erro ? <p className="text-orange-ink text-sm">{erro}</p> : null}
          <div className="flex justify-end">
            <Button onClick={criarEtapa}>Criar etapa</Button>
          </div>
        </div>
      ) : null}

      <DataTable
        colunas={colunas}
        linhas={etapas}
        chave={(e) => e.id}
        vazio="Nenhuma etapa cadastrada ainda."
      />
    </div>
  );
}
