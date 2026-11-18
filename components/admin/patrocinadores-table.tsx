"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { PatrocinadorLogo } from "@/components/overlay/patrocinador-logo";
import type { Patrocinador } from "@/lib/types";

// Sem upload de arquivo de verdade ainda (sem Supabase Storage), a imagem
// escolhida vira um data URL. Diferente de traçados/etapas/campeonatos (que
// guardam rascunho no localStorage do navegador), patrocinador precisa
// aparecer também no overlay dentro do OBS — um navegador isolado que nunca
// veria esse localStorage — então aqui persistimos via /api/patrocinadores,
// que grava num arquivo no servidor.
const TAMANHO_MAXIMO_BYTES = 2 * 1024 * 1024;

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === "string") resolve(leitor.result);
      else reject(new Error("Falha ao ler o arquivo."));
    };
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

export function PatrocinadoresTable({
  patrocinadoresIniciais,
}: {
  patrocinadoresIniciais: Patrocinador[];
}) {
  const [patrocinadores, setPatrocinadores] = useState<Patrocinador[]>(
    patrocinadoresIniciais,
  );
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [novaLogo, setNovaLogo] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const resposta = await fetch("/api/patrocinadores", {
          cache: "no-store",
        });
        const lista: Patrocinador[] = await resposta.json();
        if (ativo) setPatrocinadores(lista);
      } catch {
        // Falha pontual de rede: mantém os patrocinadores semeados.
      }
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  async function persistir(lista: Patrocinador[]) {
    setPatrocinadores(lista);
    try {
      await fetch("/api/patrocinadores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lista),
      });
    } catch {
      setErro("Não foi possível salvar — tente novamente.");
    }
  }

  async function aoEscolherArquivo(
    evento: React.ChangeEvent<HTMLInputElement>,
    aplicar: (dataUrl: string) => void,
  ) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      setErro("Imagem muito grande — escolha um arquivo de até 2 MB.");
      return;
    }
    try {
      aplicar(await lerComoDataUrl(arquivo));
      setErro("");
    } catch {
      setErro("Não foi possível ler a imagem selecionada.");
    }
  }

  function criarPatrocinador() {
    if (!nome.trim()) {
      setErro("Preencha o nome do patrocinador.");
      return;
    }
    const novo: Patrocinador = {
      id: `patro-${Date.now()}`,
      nome: nome.trim(),
      logoUrl: novaLogo || undefined,
      ativo: true,
    };
    persistir([...patrocinadores, novo]);
    setNome("");
    setNovaLogo("");
    setErro("");
    setFormAberto(false);
  }

  function atualizarLogo(id: string, logoUrl: string) {
    persistir(patrocinadores.map((p) => (p.id === id ? { ...p, logoUrl } : p)));
  }

  function removerLogo(id: string) {
    persistir(
      patrocinadores.map((p) =>
        p.id === id ? { ...p, logoUrl: undefined } : p,
      ),
    );
  }

  function alternarAtivo(id: string) {
    persistir(
      patrocinadores.map((p) => (p.id === id ? { ...p, ativo: !p.ativo } : p)),
    );
  }

  const colunas: Coluna<Patrocinador>[] = [
    {
      header: "Logo",
      cell: (p) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-24 shrink-0 items-center justify-center">
            <PatrocinadorLogo
              nome={p.nome}
              logoUrl={p.logoUrl}
              className="h-9 w-auto max-w-24"
            />
          </span>
          <label className="text-orange-ink inline-flex min-h-11 cursor-pointer items-center px-1 text-xs font-medium hover:underline">
            {p.logoUrl ? "Trocar" : "Subir logo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                aoEscolherArquivo(e, (dataUrl) => atualizarLogo(p.id, dataUrl))
              }
            />
          </label>
          {p.logoUrl ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remover o logo de ${p.nome}?`)) {
                  removerLogo(p.id);
                }
              }}
              className="text-ink-3 min-h-11 px-1 text-xs hover:underline"
            >
              Remover
            </button>
          ) : null}
        </div>
      ),
    },
    { header: "Nome", cell: (p) => p.nome },
    {
      header: "Status",
      cell: (p) => (
        <button type="button" onClick={() => alternarAtivo(p.id)}>
          <StatusPill tone={p.ativo ? "ink" : "neutral"}>
            {p.ativo ? "ativo" : "inativo"}
          </StatusPill>
        </button>
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
          {formAberto ? "Cancelar" : "Novo patrocinador"}
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
                placeholder="Oficina Boxes Prime"
                className="campo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-ink text-sm font-medium">
                Logo (opcional)
              </label>
              <div className="flex items-center gap-3">
                <PatrocinadorLogo
                  nome={nome || "Logo"}
                  logoUrl={novaLogo || undefined}
                  className="h-10 w-20"
                />
                <label className="text-orange-ink cursor-pointer text-sm font-medium hover:underline">
                  {novaLogo ? "Trocar imagem" : "Escolher imagem"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => aoEscolherArquivo(e, setNovaLogo)}
                  />
                </label>
              </div>
            </div>
          </div>
          <p className="text-ink-3 text-xs">
            Sem uma logo cadastrada, o nome aparece como selo no lugar dela.
          </p>
          {erro ? <p className="text-orange-ink text-sm">{erro}</p> : null}
          <div className="flex justify-end">
            <Button onClick={criarPatrocinador}>Criar patrocinador</Button>
          </div>
        </div>
      ) : null}

      <DataTable
        colunas={colunas}
        linhas={patrocinadores}
        chave={(p) => p.id}
        vazio="Nenhum patrocinador cadastrado."
      />
    </div>
  );
}
