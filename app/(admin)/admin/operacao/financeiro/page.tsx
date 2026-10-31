import type { Metadata } from "next";
import Link from "next/link";
import { BotaoImprimir } from "@/components/operacao/botao-imprimir";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { exigirPermissao } from "@/lib/auth";
import { fluxoDoMes } from "@/lib/operacao/financeiro-store";
import {
  ehMesValido,
  formatarDiaCurto,
  formatarMes,
  formatarReais,
  mesAtual,
  somarMeses,
} from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Fluxo de caixa" };
export const dynamic = "force-dynamic";

export default async function FluxoDeCaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  if (!(await exigirPermissao("financeiro.gerenciar"))) return <SemPermissao />;

  const { mes: pedido } = await searchParams;
  const atual = mesAtual();
  const mes = pedido && ehMesValido(pedido) ? pedido : atual;
  const fluxo = await fluxoDoMes(mes);
  const positivo = fluxo.resultadoCentavos >= 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fluxo de caixa"
        description={`${formatarMes(mes)} — o que entrou das reservas e o que saiu em contas pagas.`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ButtonLink
              href={`/admin/operacao/financeiro?mes=${somarMeses(mes, -1)}`}
              variant="secondary"
            >
              ← Mês anterior
            </ButtonLink>
            {mes !== atual ? (
              <ButtonLink href="/admin/operacao/financeiro" variant="secondary">
                Este mês
              </ButtonLink>
            ) : null}
            <ButtonLink
              href={`/admin/operacao/financeiro?mes=${somarMeses(mes, 1)}`}
              variant="secondary"
            >
              Próximo mês →
            </ButtonLink>
            <BotaoImprimir />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Entradas"
          value={formatarReais(fluxo.entradas.totalCentavos)}
          hint="Reservas recebidas, já sem estornos"
        />
        <StatCard
          label="Saídas pagas"
          value={formatarReais(fluxo.saidasPagas.totalCentavos)}
        />
        <StatCard
          label={positivo ? "Resultado do mês" : "Resultado do mês (negativo)"}
          value={formatarReais(fluxo.resultadoCentavos)}
          hint="Entradas − saídas pagas"
        />
        <StatCard
          label="A pagar neste mês"
          value={formatarReais(fluxo.aPagarNoMes.centavos)}
          hint={`${fluxo.aPagarNoMes.quantidade} conta(s) em aberto`}
        />
      </div>

      {fluxo.atrasadas.quantidade > 0 ? (
        <p className="text-ink text-sm">
          <span className="font-semibold text-red-700">
            {fluxo.atrasadas.quantidade} conta(s) atrasada(s),{" "}
            {formatarReais(fluxo.atrasadas.centavos)}.
          </span>{" "}
          <Link
            href="/admin/operacao/contas"
            className="text-orange-ink font-medium hover:underline"
          >
            Ver contas a pagar
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-ink text-sm font-semibold">Entradas por forma</h2>
          <DataTable
            colunas={[
              { header: "Forma", cell: (l) => l.nome },
              {
                header: "Valor",
                cell: (l) => formatarReais(l.centavos),
                numerica: true,
              },
            ]}
            linhas={[
              { nome: "Dinheiro", centavos: fluxo.entradas.dinheiro },
              { nome: "Pix", centavos: fluxo.entradas.pix },
              { nome: "Cartão", centavos: fluxo.entradas.cartao },
            ]}
            chave={(l) => l.nome}
          />
          <h2 className="text-ink mt-2 text-sm font-semibold">
            Entradas por dia
          </h2>
          <DataTable
            colunas={[
              { header: "Dia", cell: (l) => formatarDiaCurto(l.dia) },
              {
                header: "Recebido",
                cell: (l) => formatarReais(l.centavos),
                numerica: true,
              },
            ]}
            linhas={fluxo.entradas.porDia}
            chave={(l) => l.dia}
            vazio="Nenhuma entrada neste mês."
          />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-ink text-sm font-semibold">
            Saídas pagas por categoria
          </h2>
          <DataTable
            colunas={[
              { header: "Categoria", cell: (l) => l.categoria },
              {
                header: "Pago",
                cell: (l) => formatarReais(l.centavos),
                numerica: true,
              },
            ]}
            linhas={fluxo.saidasPagas.porCategoria}
            chave={(l) => l.categoria}
            vazio="Nenhuma conta paga neste mês."
          />
          <p className="text-ink-3 text-xs">
            As contas são lançadas em Contas a pagar. Pagamentos em dinheiro
            tirados do caixa devem ser registrados também como sangria, para a
            gaveta bater.
          </p>
        </div>
      </div>
    </div>
  );
}
