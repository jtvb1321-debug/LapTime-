"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import {
  TracadoEditor,
  type RotaEditada,
} from "@/components/admin/tracado-editor";
import { TracadoMiniatura } from "@/components/tracado/tracado-miniatura";
import { formatTempoVolta, getRecordeDoTracado } from "@/lib/mock/data";
import {
  excluirTracadoAction,
  importarTracadosAction,
  salvarTracadoAction,
} from "@/lib/campeonatos-actions";
import { CHAVE_TRACADOS } from "@/lib/tracado3d/rota";
import type { Tracado } from "@/lib/types";

export function TracadosTable({
  tracados,
  podeEditar,
}: {
  tracados: Tracado[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);
  // Traçados desenhados antes, guardados só neste navegador: dá para levá-los para o banco.
  const bruto = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(CHAVE_TRACADOS);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [jaImportados, setJaImportados] = useState(false);
  const locais = useMemo(() => {
    if (!bruto || jaImportados) return [];
    try {
      const lista = JSON.parse(bruto) as Tracado[];
      return lista.filter(
        (l) =>
          Array.isArray(l.pontos) &&
          l.pontos.length >= 2 &&
          !tracados.some((t) => t.nome === l.nome),
      );
    } catch {
      return [];
    }
  }, [bruto, jaImportados, tracados]);
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
      !window.confirm("Excluir este traçado? Essa ação não pode ser desfeita.")
    ) {
      return;
    }
    iniciar(async () => {
      const r = await excluirTracadoAction(id);
      setAviso(
        r.erro
          ? { tipo: "erro", texto: r.erro }
          : { tipo: "ok", texto: r.ok ?? "Traçado excluído." },
      );
      router.refresh();
    });
  }

  function importarLocais() {
    iniciar(async () => {
      const r = await importarTracadosAction(
        locais.map((l) => ({
          nome: l.nome,
          descricao: l.descricao,
          pontos: l.pontos,
          fechado: l.fechado,
          extensaoMetros: l.extensaoMetros,
        })),
      );
      if (r.ok) {
        try {
          window.localStorage.removeItem(CHAVE_TRACADOS);
        } catch {
          // sem acesso ao armazenamento local: tudo bem
        }
        setJaImportados(true);
      }
      setAviso(
        r.erro
          ? { tipo: "erro", texto: r.erro }
          : { tipo: "ok", texto: r.ok ?? "Importado." },
      );
      router.refresh();
    });
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
    iniciar(async () => {
      const r = await salvarTracadoAction(editandoId, dados);
      if (r.erro) return setErro(r.erro);
      setAviso({ tipo: "ok", texto: r.ok ?? "Traçado salvo." });
      fecharForm();
      router.refresh();
    });
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
      cell: (t) =>
        !podeEditar ? null : (
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
      {locais.length > 0 && podeEditar ? (
        <div
          role="status"
          className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        >
          <p className="text-ink-2 max-w-xl text-sm">
            Este navegador tem {locais.length} traçado(s) desenhado(s) antes que
            ainda não estão no sistema:{" "}
            <span className="text-ink font-medium">
              {locais.map((l) => l.nome).join(", ")}
            </span>
            . Importe para usá-los nos campeonatos.
          </p>
          <Button
            disabled={pendente}
            carregando={pendente}
            onClick={importarLocais}
          >
            Importar para o sistema
          </Button>
        </div>
      ) : null}

      {aviso ? (
        <p
          role={aviso.tipo === "erro" ? "alert" : "status"}
          className={
            aviso.tipo === "erro"
              ? "text-danger text-sm"
              : "text-success text-sm"
          }
        >
          {aviso.texto}
        </p>
      ) : null}

      {podeEditar ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => (formAberto ? fecharForm() : abrirForm())}
          >
            {formAberto ? "Cancelar" : "Novo traçado"}
          </Button>
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
                className="campo min-h-11 md:min-h-9"
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
                className="campo min-h-11 md:min-h-9"
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
            <Button
              onClick={salvarTracado}
              disabled={pendente}
              carregando={pendente}
            >
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
