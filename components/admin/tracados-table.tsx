"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import {
  TracadoEditor,
  type RotaEditada,
} from "@/components/admin/tracado-editor";
import { TracadoMiniatura } from "@/components/tracado/tracado-miniatura";
import { formatTempoVolta, getRecordeDoTracado } from "@/lib/mock/data";
import { CHAVE_TRACADOS } from "@/lib/tracado3d/rota";
import { useMockStore } from "@/lib/use-mock-store";
import type { Tracado } from "@/lib/types";

export function TracadosTable({
  tracadosIniciais,
}: {
  tracadosIniciais: Tracado[];
}) {
  const [tracados, setTracados] = useMockStore(
    CHAVE_TRACADOS,
    tracadosIniciais,
  );
  const [formAberto, setFormAberto] = useState(false);
  // Quando preenchido, o formulário edita este traçado em vez de criar outro.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [chaveForm, setChaveForm] = useState(0);
  const [inicial, setInicial] = useState<Tracado | undefined>();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [rota, setRota] = useState<RotaEditada>({
    pontos: [],
    fechado: false,
    invalidos: 0,
    metros: 0,
    pronto: false,
  });
  const [erro, setErro] = useState("");
  const [mostrarExportacao, setMostrarExportacao] = useState(false);

  function abrirForm(tracado?: Tracado) {
    setEditandoId(tracado?.id ?? null);
    setInicial(tracado);
    setNome(tracado?.nome ?? "");
    setDescricao(tracado?.descricao ?? "");
    setErro("");
    setChaveForm((k) => k + 1);
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditandoId(null);
    setInicial(undefined);
    setErro("");
  }

  function excluirTracado(id: string) {
    if (
      !window.confirm(
        "Excluir este traçado? As etapas vinculadas a ele ficam sem traçado. Essa ação não pode ser desfeita.",
      )
    ) {
      return;
    }
    setTracados((prev) => prev.filter((t) => t.id !== id));
  }

  function salvarTracado() {
    if (!nome.trim()) return setErro("Preencha o nome do traçado.");
    if (rota.pontos.length < 2) {
      return setErro("Marque pelo menos 2 pontos sobre o asfalto.");
    }
    if (!rota.pronto) {
      return setErro("Aguarde o modelo da pista terminar de carregar.");
    }
    if (rota.invalidos > 0) {
      return setErro(
        `${rota.invalidos} trecho(s) saem do asfalto (em vermelho). Corrija antes de salvar.`,
      );
    }
    const dados = {
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      pontos: rota.pontos,
      fechado: rota.fechado,
      extensaoMetros: Math.round(rota.metros),
    };
    if (editandoId) {
      setTracados((prev) =>
        prev.map((t) => (t.id === editandoId ? { ...t, ...dados } : t)),
      );
    } else {
      setTracados((prev) => [
        ...prev,
        { id: `tracado-${Date.now()}`, ...dados },
      ]);
    }
    fecharForm();
  }

  const colunas: Coluna<Tracado>[] = [
    {
      header: "Traçado",
      cell: (t) => (
        <TracadoMiniatura
          pontos={t.pontos}
          fechado={t.fechado}
          className="border-border h-12 w-20 rounded border"
        />
      ),
    },
    { header: "Nome", cell: (t) => t.nome },
    {
      header: "Tipo",
      cell: (t) => (t.fechado ? "Circuito fechado" : "Rota aberta"),
    },
    {
      header: "Extensão",
      cell: (t) => (t.extensaoMetros ? `≈ ${t.extensaoMetros} m` : "—"),
    },
    {
      header: "Recorde",
      cell: (t) => {
        const recorde = getRecordeDoTracado(t.id);
        return recorde ? formatTempoVolta(recorde.melhorVoltaMs) : "—";
      },
      numerica: true,
    },
    {
      header: "",
      cell: (t) => (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => abrirForm(t)}
            className="text-orange-ink min-h-11 text-xs font-medium hover:underline md:min-h-0"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => excluirTracado(t.id)}
            className="text-danger min-h-11 text-xs font-medium hover:underline md:min-h-0"
          >
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setMostrarExportacao((v) => !v)}>
          {mostrarExportacao ? "Fechar exportação" : "Exportar dados"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => (formAberto ? fecharForm() : abrirForm())}
        >
          {formAberto ? "Cancelar" : "Novo traçado"}
        </Button>
      </div>

      {mostrarExportacao ? (
        <div className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-ink-2 text-xs">
            Dados de todos os traçados salvos neste navegador (inclui os criados
            aqui, que só existem localmente). Selecione tudo e copie pra enviar
            — é assim que dá pra levar um traçado feito aqui pra fora deste
            navegador.
          </p>
          <textarea
            readOnly
            aria-label="Dados dos traçados em JSON"
            value={JSON.stringify(tracados, null, 2)}
            onFocus={(e) => e.currentTarget.select()}
            className="border-border-strong h-64 w-full rounded-md border p-2 font-mono text-xs"
          />
        </div>
      ) : null}

      {formAberto ? (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-ink text-sm font-semibold">
            {editandoId ? "Editar traçado" : "Novo traçado"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="tracado-nome"
                className="text-ink text-sm font-medium"
              >
                Nome
              </label>
              <input
                id="tracado-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                placeholder="Traçado Principal"
                className="border-border-strong focus:border-orange min-h-11 rounded-md border px-3 py-2 text-sm outline-none md:min-h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="tracado-descricao"
                className="text-ink text-sm font-medium"
              >
                Descrição (opcional)
              </label>
              <input
                id="tracado-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: configuração usada nas etapas da temporada"
                className="border-border-strong focus:border-orange min-h-11 rounded-md border px-3 py-2 text-sm outline-none md:min-h-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-ink text-sm font-medium">Percurso no asfalto</p>
            <TracadoEditor
              key={chaveForm}
              inicial={
                inicial
                  ? { pontos: inicial.pontos, fechado: inicial.fechado }
                  : undefined
              }
              nomeDoArquivo={nome.trim() || "tracado"}
              onChange={setRota}
            />
          </div>
          {erro ? (
            <p role="alert" className="text-orange-ink text-sm">
              {erro}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={salvarTracado}>
              {editandoId ? "Salvar alterações" : "Criar traçado"}
            </Button>
          </div>
        </div>
      ) : null}

      <DataTable
        colunas={colunas}
        linhas={tracados}
        chave={(t) => t.id}
        vazio="Nenhum traçado cadastrado ainda."
      />
    </div>
  );
}
