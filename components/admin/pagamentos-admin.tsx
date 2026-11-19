"use client";

import { useState } from "react";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import type { InscricaoCompleta } from "@/lib/inscricoes-store";
import { formatMoeda } from "@/lib/mock/data";
import type { AcaoState } from "@/lib/operacao-actions";
import { AcoesDePagamento } from "@/components/admin/inscricoes-admin";

const ROTULO = {
  aguardando: "a receber",
  confirmado: "recebido",
  cancelado: "cancelado",
} as const;
const TOM = {
  aguardando: "warning",
  confirmado: "success",
  cancelado: "neutral",
} as const;
const METODO = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão" };

// Pagamentos das inscrições: totais no topo e a lista com confirmação (forma de pagamento) e estorno.
export function PagamentosAdmin({
  inscricoes,
  podeEditar,
  podeEstornar,
}: {
  inscricoes: InscricaoCompleta[];
  podeEditar: boolean;
  podeEstornar: boolean;
}) {
  const [filtro, setFiltro] = useState<
    "" | "aguardando" | "confirmado" | "cancelado"
  >("");
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const comPagamento = inscricoes.filter((i) => i.pagamento);
  const soma = (s: string) =>
    comPagamento
      .filter((i) => i.pagamento?.status === s)
      .reduce((t, i) => t + (i.pagamento?.valorCentavos ?? 0), 0);
  const linhas = comPagamento.filter(
    (i) => !filtro || i.pagamento?.status === filtro,
  );

  const colunas: Coluna<InscricaoCompleta>[] = [
    { header: "Nº", cell: (i) => i.pilotoNumero, numerica: true },
    { header: "Piloto", cell: (i) => i.pilotoNome },
    { header: "Etapa", cell: (i) => i.etapaNome },
    {
      header: "Valor",
      cell: (i) => formatMoeda(i.pagamento?.valorCentavos ?? 0),
      numerica: true,
    },
    {
      header: "Forma",
      cell: (i) => (i.pagamento?.metodo ? METODO[i.pagamento.metodo] : "—"),
    },
    {
      header: "Situação",
      cell: (i) =>
        i.pagamento ? (
          <StatusPill tone={TOM[i.pagamento.status]}>
            {ROTULO[i.pagamento.status]}
          </StatusPill>
        ) : null,
    },
    {
      header: "",
      cell: (i) => (
        <AcoesDePagamento
          inscricao={i}
          podeEditar={podeEditar}
          podeEstornar={podeEstornar}
          aoResponder={setResultado}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["A receber", soma("aguardando"), "text-warning"],
          ["Recebido", soma("confirmado"), "text-success"],
          ["Cancelado", soma("cancelado"), "text-ink-3"],
        ].map(([rotulo, valor, cor]) => (
          <div
            key={rotulo as string}
            className="border-border bg-surface rounded-xl border p-4"
          >
            <dt className="text-ink-3 text-xs tracking-wide uppercase">
              {rotulo}
            </dt>
            <dd className={`font-display text-xl font-bold ${cor}`}>
              {formatMoeda(valor as number)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="filtro-pag" className="text-ink text-sm font-medium">
          Situação
        </label>
        <select
          id="filtro-pag"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as typeof filtro)}
          className="campo max-w-xs"
        >
          <option value="">Todos</option>
          <option value="aguardando">A receber</option>
          <option value="confirmado">Recebidos</option>
          <option value="cancelado">Cancelados</option>
        </select>
      </div>

      <DataTable
        colunas={colunas}
        linhas={linhas}
        chave={(i) => i.id}
        vazio="Nenhum pagamento ainda. Eles aparecem quando os pilotos se inscrevem em etapas com valor."
        rotulo="Pagamentos"
      />
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
  );
}
