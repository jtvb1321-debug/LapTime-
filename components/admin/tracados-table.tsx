"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { TracadoEditor } from "@/components/admin/tracado-editor";
import { TracadoPreview } from "@/components/tracado-preview";
import { formatTempoVolta, getRecordeDoTracado } from "@/lib/mock/data";
import { useMockStore } from "@/lib/use-mock-store";
import type {
  CurvaNomeada,
  PontoTracado,
  SentidoProva,
  Tracado,
} from "@/lib/types";

export function TracadosTable({
  tracadosIniciais,
}: {
  tracadosIniciais: Tracado[];
}) {
  const [tracados, setTracados] = useMockStore(
    "gridlap:tracados",
    tracadosIniciais,
  );
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [extensao, setExtensao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pontos, setPontos] = useState<PontoTracado[]>([]);
  const [linhaChegada, setLinhaChegada] = useState<PontoTracado>();
  const [sentido, setSentido] = useState<SentidoProva>();
  const [curvas, setCurvas] = useState<CurvaNomeada[]>([]);
  const [erro, setErro] = useState("");
  const [mostrarExportacao, setMostrarExportacao] = useState(false);

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

  function criarTracado() {
    if (!nome.trim()) {
      setErro("Preencha o nome do traçado.");
      return;
    }
    if (pontos.length < 3) {
      setErro("Marque pelo menos 3 pontos sobre o desenho da pista.");
      return;
    }
    const novo: Tracado = {
      id: `tracado-${Date.now()}`,
      nome: nome.trim(),
      extensaoMetros: extensao.trim() ? Number(extensao) : undefined,
      descricao: descricao.trim() || undefined,
      pontos,
      linhaChegada,
      sentido,
      curvas: curvas.length > 0 ? curvas : undefined,
    };
    setTracados((prev) => [...prev, novo]);
    setNome("");
    setExtensao("");
    setDescricao("");
    setPontos([]);
    setLinhaChegada(undefined);
    setSentido(undefined);
    setCurvas([]);
    setErro("");
    setFormAberto(false);
  }

  const colunas: Coluna<Tracado>[] = [
    {
      header: "Traçado",
      cell: (t) => (
        <TracadoPreview
          pontos={t.pontos}
          linhaChegada={t.linhaChegada}
          sentido={t.sentido}
          aspectRatio={20 / 12}
          className="border-border h-12 w-20 rounded border"
        />
      ),
    },
    { header: "Nome", cell: (t) => t.nome },
    {
      header: "Extensão",
      cell: (t) => (t.extensaoMetros ? `${t.extensaoMetros} m` : "—"),
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
        <button
          type="button"
          onClick={() => excluirTracado(t.id)}
          className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
        >
          Excluir
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => setMostrarExportacao((v) => !v)}
        >
          {mostrarExportacao ? "Fechar exportação" : "Exportar dados"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setFormAberto((aberto) => !aberto)}
        >
          {formAberto ? "Cancelar" : "Novo traçado"}
        </Button>
      </div>

      {mostrarExportacao ? (
        <div className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-ink-2 text-xs">
            Dados de todos os traçados salvos neste navegador (inclui os
            criados aqui, que só existem localmente). Selecione tudo e copie
            pra enviar — é assim que dá pra levar um traçado feito aqui pra
            fora deste navegador.
          </p>
          <textarea
            readOnly
            value={JSON.stringify(tracados, null, 2)}
            onFocus={(e) => e.currentTarget.select()}
            className="border-border-strong h-64 w-full rounded-md border p-2 font-mono text-xs"
          />
        </div>
      ) : null}

      {formAberto ? (
        <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-ink text-sm font-medium">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Traçado Principal"
                className="border-border-strong focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink text-sm font-medium">
                Extensão (metros, opcional)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={extensao}
                onChange={(e) => setExtensao(e.target.value)}
                placeholder="1200"
                className="border-border-strong focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink text-sm font-medium">
              Descrição (opcional)
            </label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: configuração usada nas etapas de temporada regular"
              className="border-border-strong focus:border-orange rounded-md border px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink text-sm font-medium">
              Percurso e linha de chegada
            </label>
            <TracadoEditor
              onChangePontos={setPontos}
              onChangeLinhaChegada={setLinhaChegada}
              onChangeSentido={setSentido}
              onChangeCurvas={setCurvas}
            />
          </div>
          {erro ? <p className="text-orange text-sm">{erro}</p> : null}
          <div className="flex justify-end">
            <Button onClick={criarTracado}>Criar traçado</Button>
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
