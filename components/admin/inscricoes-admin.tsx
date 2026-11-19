"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDataEHora } from "@/lib/etapa-formato";
import {
  cancelarInscricaoAction,
  confirmarPagamentoAction,
  estornarPagamentoAction,
  inscreverPilotoAction,
} from "@/lib/inscricoes-actions";
import type { InscricaoCompleta } from "@/lib/inscricoes-store";
import { formatMoeda } from "@/lib/mock/data";
import type { AcaoState } from "@/lib/operacao-actions";

export interface EtapaDaLista {
  id: string;
  numero: number;
  nome: string;
  data: string;
  hora: string;
  status: string;
  valorCentavos: number;
}

export interface PilotoDaLista {
  id: string;
  nome: string;
  numero: number;
  categoriaId: string;
  categoriaNome: string;
}

const ROTULO_INSC = {
  pendente: "aguardando pagamento",
  confirmada: "confirmada",
  cancelada: "cancelada",
} as const;
const TOM_INSC = {
  pendente: "warning",
  confirmada: "success",
  cancelada: "neutral",
} as const;
const ROTULO_PAG = {
  aguardando: "a receber",
  confirmado: "recebido",
  cancelado: "cancelado",
} as const;
const TOM_PAG = {
  aguardando: "warning",
  confirmado: "success",
  cancelado: "neutral",
} as const;
const ROTULO_METODO = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão" };

function Mensagem({ estado }: { estado: AcaoState | null }) {
  if (!estado) return null;
  if (estado.erro)
    return (
      <p role="alert" className="text-danger text-sm">
        {estado.erro}
      </p>
    );
  if (estado.ok)
    return (
      <p role="status" className="text-success text-sm">
        {estado.ok}
      </p>
    );
  return null;
}

// Confirmar pagamento (com a forma de pagamento) e estornar: usado nas duas telas.
export function AcoesDePagamento({
  inscricao,
  podeEditar,
  podeEstornar,
  aoResponder,
}: {
  inscricao: InscricaoCompleta;
  podeEditar: boolean;
  podeEstornar: boolean;
  aoResponder: (e: AcaoState) => void;
}) {
  const [metodo, setMetodo] = useState("pix");
  const [pendente, iniciar] = useTransition();
  const g = inscricao.pagamento;
  if (!g) return null;
  if (g.status === "aguardando" && podeEditar) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <select
          aria-label={`Forma de pagamento de ${inscricao.pilotoNome}`}
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          className="campo min-h-9 py-1 text-xs"
        >
          {Object.entries(ROTULO_METODO).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
        <Button
          disabled={pendente}
          carregando={pendente}
          onClick={() =>
            iniciar(async () =>
              aoResponder(await confirmarPagamentoAction(g.id, metodo)),
            )
          }
        >
          Confirmar
        </Button>
      </span>
    );
  }
  if (g.status === "confirmado" && podeEstornar) {
    return (
      <button
        type="button"
        disabled={pendente}
        onClick={() => {
          if (
            !window.confirm(
              `Estornar o pagamento de ${inscricao.pilotoNome}? A inscrição também será cancelada.`,
            )
          )
            return;
          iniciar(async () => aoResponder(await estornarPagamentoAction(g.id)));
        }}
        className="text-danger min-h-11 text-xs font-medium hover:underline md:min-h-0"
      >
        Estornar
      </button>
    );
  }
  return null;
}

export function InscricoesAdmin({
  etapas,
  inscricoes,
  pilotos,
  categorias,
  podeEditar,
  podeEstornar,
}: {
  etapas: EtapaDaLista[];
  inscricoes: InscricaoCompleta[];
  pilotos: PilotoDaLista[];
  categorias: { id: string; nome: string }[];
  podeEditar: boolean;
  podeEstornar: boolean;
}) {
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();
  const [novaEtapa, setNovaEtapa] = useState("");
  const [novoPiloto, setNovoPiloto] = useState("");

  const visiveis = inscricoes.filter(
    (i) =>
      (!filtroEtapa || i.etapaId === filtroEtapa) &&
      (mostrarCanceladas || i.status !== "cancelada"),
  );
  const abertas = etapas.filter((e) => e.status === "agendada");
  const jaInscritos = new Set(
    inscricoes
      .filter((i) => i.etapaId === novaEtapa && i.status !== "cancelada")
      .map((i) => i.pilotoId),
  );
  const candidatos = pilotos.filter((p) => !jaInscritos.has(p.id));
  const ativas = inscricoes.filter((i) => i.status !== "cancelada");
  const confirmadas = ativas.filter((i) => i.status === "confirmada").length;

  const colunas: Coluna<InscricaoCompleta>[] = [
    { header: "Nº", cell: (i) => i.pilotoNumero, numerica: true },
    { header: "Piloto", cell: (i) => i.pilotoNome },
    {
      header: "Categoria",
      cell: (i) => (
        <NomeCategoria
          categoriaId={i.categoriaId}
          className="inline-block rounded bg-[#0c1630] px-1.5"
        >
          {categorias.find((c) => c.id === i.categoriaId)?.nome ??
            i.categoriaId}
        </NomeCategoria>
      ),
    },
    {
      header: "Etapa",
      cell: (i) => (
        <span>
          {i.etapaNome}
          <span className="text-ink-3 block text-xs">
            {formatDataEHora({ data: i.etapaData, hora: i.etapaHora })}
          </span>
        </span>
      ),
    },
    {
      header: "Inscrição",
      cell: (i) => (
        <StatusPill tone={TOM_INSC[i.status]}>
          {ROTULO_INSC[i.status]}
        </StatusPill>
      ),
    },
    {
      header: "Pagamento",
      cell: (i) =>
        i.pagamento ? (
          <span className="flex flex-col gap-0.5">
            <span className="text-ink text-sm">
              {formatMoeda(i.pagamento.valorCentavos)}
            </span>
            <StatusPill tone={TOM_PAG[i.pagamento.status]}>
              {ROTULO_PAG[i.pagamento.status]}
              {i.pagamento.metodo
                ? ` · ${ROTULO_METODO[i.pagamento.metodo]}`
                : ""}
            </StatusPill>
          </span>
        ) : (
          <span className="text-ink-3 text-xs">gratuita</span>
        ),
    },
    {
      header: "",
      cell: (i) => (
        <span className="flex flex-col items-end gap-1">
          <AcoesDePagamento
            inscricao={i}
            podeEditar={podeEditar}
            podeEstornar={podeEstornar}
            aoResponder={setResultado}
          />
          {podeEditar &&
          i.status !== "cancelada" &&
          i.pagamento?.status !== "confirmado" ? (
            <button
              type="button"
              disabled={pendente}
              onClick={() => {
                if (!window.confirm(`Cancelar a inscrição de ${i.pilotoNome}?`))
                  return;
                iniciar(async () =>
                  setResultado(await cancelarInscricaoAction(i.id)),
                );
              }}
              className="text-danger min-h-11 text-xs font-medium hover:underline md:min-h-0"
            >
              Cancelar inscrição
            </button>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-ink-2 text-sm">
        {ativas.length} inscrição(ões) ativa(s), {confirmadas} confirmada(s).
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filtro-etapa"
            className="text-ink text-sm font-medium"
          >
            Etapa
          </label>
          <select
            id="filtro-etapa"
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value)}
            className="campo"
          >
            <option value="">Todas as etapas</option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
        <label className="text-ink-2 flex min-h-11 items-center gap-2 text-sm md:min-h-9">
          <input
            type="checkbox"
            checked={mostrarCanceladas}
            onChange={(e) => setMostrarCanceladas(e.target.checked)}
          />
          Mostrar canceladas
        </label>
      </div>

      <DataTable
        colunas={colunas}
        linhas={visiveis}
        chave={(i) => i.id}
        vazio="Nenhuma inscrição ainda. Os pilotos se inscrevem em Inscrição, no site, ou você inscreve abaixo."
        rotulo="Inscrições"
      />
      <Mensagem estado={resultado} />

      {podeEditar ? (
        <section className="border-border bg-surface flex max-w-2xl flex-col gap-3 rounded-xl border p-4">
          <h2 className="text-ink text-base font-semibold">
            Inscrever um piloto
          </h2>
          {abertas.length === 0 ? (
            <p className="text-ink-2 text-sm">
              Não há etapa aberta (agendada) para inscrições.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="nova-etapa"
                  className="text-ink text-sm font-medium"
                >
                  Etapa
                </label>
                <select
                  id="nova-etapa"
                  value={novaEtapa}
                  onChange={(e) => {
                    setNovaEtapa(e.target.value);
                    setNovoPiloto("");
                  }}
                  className="campo"
                >
                  <option value="">Escolha a etapa</option>
                  {abertas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome} ·{" "}
                      {e.valorCentavos > 0
                        ? formatMoeda(e.valorCentavos)
                        : "gratuita"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="novo-piloto"
                  className="text-ink text-sm font-medium"
                >
                  Piloto
                </label>
                <select
                  id="novo-piloto"
                  value={novoPiloto}
                  onChange={(e) => setNovoPiloto(e.target.value)}
                  disabled={!novaEtapa}
                  className="campo"
                >
                  <option value="">Escolha o piloto</option>
                  {candidatos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numero} · {p.nome} ({p.categoriaNome})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={pendente || !novaEtapa || !novoPiloto}
                carregando={pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await inscreverPilotoAction(
                      novaEtapa,
                      novoPiloto,
                    );
                    setResultado(r);
                    if (r.ok) setNovoPiloto("");
                  })
                }
              >
                Inscrever
              </Button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
