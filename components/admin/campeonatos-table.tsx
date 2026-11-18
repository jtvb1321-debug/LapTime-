"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { useMockStore } from "@/lib/use-mock-store";
import type { Campeonato } from "@/lib/types";

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CampeonatosTable({
  campeonatosIniciais,
  etapasPorCampeonato,
}: {
  campeonatosIniciais: Campeonato[];
  etapasPorCampeonato: Record<string, number>;
}) {
  const [campeonatos, setCampeonatos] = useMockStore(
    "gridlap:campeonatos",
    campeonatosIniciais,
  );
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [temporada, setTemporada] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState("");

  function criarCampeonato() {
    if (!nome.trim() || !temporada.trim()) {
      setErro("Preencha nome e temporada.");
      return;
    }
    const novo: Campeonato = {
      id: `camp-${Date.now()}`,
      nome: nome.trim(),
      temporada: temporada.trim(),
      slug: slugify(nome),
      descricao: descricao.trim() || "Sem descrição ainda.",
      ativo: false,
    };
    setCampeonatos((prev) => [...prev, novo]);
    setNome("");
    setTemporada("");
    setDescricao("");
    setErro("");
    setFormAberto(false);
  }

  const colunas: Coluna<Campeonato>[] = [
    { header: "Nome", cell: (c) => c.nome },
    { header: "Temporada", cell: (c) => c.temporada },
    {
      header: "Etapas",
      cell: (c) => etapasPorCampeonato[c.id] ?? 0,
      numerica: true,
    },
    {
      header: "Status",
      cell: (c) => (
        <StatusPill tone={c.ativo ? "ink" : "neutral"}>
          {c.ativo ? "ativo" : "encerrado"}
        </StatusPill>
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
          {formAberto ? "Cancelar" : "Novo campeonato"}
        </Button>
      </div>

      {formAberto ? (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink text-sm font-medium">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Campeonato Grid Lap"
                className="campo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink text-sm font-medium">Temporada</label>
              <input
                value={temporada}
                onChange={(e) => setTemporada(e.target.value)}
                placeholder="2027"
                className="campo"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink text-sm font-medium">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional"
              className="campo"
            />
          </div>
          {erro ? <p className="text-orange-ink text-sm">{erro}</p> : null}
          <div className="flex justify-end">
            <Button onClick={criarCampeonato}>Criar campeonato</Button>
          </div>
        </div>
      ) : null}

      <DataTable colunas={colunas} linhas={campeonatos} chave={(c) => c.id} />
    </div>
  );
}
