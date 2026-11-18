import type { Metadata } from "next";
import Link from "next/link";
import { BotaoImprimir } from "@/components/operacao/botao-imprimir";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import { relatorioDoDia } from "@/lib/operacao/relatorios-store";
import {
  ehDiaValido,
  formatarDataHora,
  formatarDiaLongo,
  formatarReais,
  hojeEmSaoPaulo,
  somarDias,
} from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Relatório do dia" };
export const dynamic = "force-dynamic";

export default async function RelatorioDoDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  if (!(await exigirPermissao("financeiro.gerenciar"))) return <SemPermissao />;

  const { dia: pedido } = await searchParams;
  const hoje = hojeEmSaoPaulo();
  const dia = pedido && ehDiaValido(pedido) ? pedido : hoje;
  const r = await relatorioDoDia(dia);
  const ocupacao =
    r.baterias.capacidade > 0
      ? Math.round((r.reservas.pilotos / r.baterias.capacidade) * 100)
      : 0;
  const ticket =
    r.reservas.pilotos > 0
      ? Math.round(r.reservas.valorCentavos / r.reservas.pilotos)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatório do dia"
        description={`${formatarDiaLongo(dia)}${dia === hoje ? " (hoje)" : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <ButtonLink
              href={`/admin/operacao/relatorio?dia=${somarDias(dia, -1)}`}
              variant="secondary"
            >
              ← Dia anterior
            </ButtonLink>
            {dia !== hoje ? (
              <ButtonLink href="/admin/operacao/relatorio" variant="secondary">
                Hoje
              </ButtonLink>
            ) : null}
            <ButtonLink
              href={`/admin/operacao/relatorio?dia=${somarDias(dia, 1)}`}
              variant="secondary"
            >
              Próximo dia →
            </ButtonLink>
            <BotaoImprimir />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Recebido (líquido)"
          value={formatarReais(r.totalRecebido)}
          hint="Pagamentos − estornos"
        />
        <StatCard label="Dinheiro" value={formatarReais(r.recebido.dinheiro)} />
        <StatCard label="Pix" value={formatarReais(r.recebido.pix)} />
        <StatCard label="Cartão" value={formatarReais(r.recebido.cartao)} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pilotos agendados"
          value={r.reservas.pilotos}
          hint={`${r.baterias.total} baterias · ${ocupacao}% dos karts`}
        />
        <StatCard
          label="Reservado"
          value={formatarReais(r.reservas.valorCentavos)}
          hint={ticket ? `${formatarReais(ticket)} por piloto` : undefined}
        />
        <StatCard
          label="Estornos"
          value={formatarReais(r.estornos.centavos)}
          hint={`${r.estornos.quantidade} lançamento(s)`}
        />
        <StatCard
          label="Sangrias"
          value={formatarReais(r.sangriasCentavos)}
          hint={`Suprimentos: ${formatarReais(r.suprimentosCentavos)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-ink text-sm font-semibold">Por operador</h2>
          <DataTable
            colunas={[
              { header: "Operador", cell: (o) => o.operador },
              {
                header: "Recebido líquido",
                cell: (o) => formatarReais(o.recebidoCentavos),
                numerica: true,
              },
            ]}
            linhas={r.porOperador}
            chave={(o) => o.operador}
            vazio="Nenhum recebimento neste dia."
          />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-ink text-sm font-semibold">Caixas fechados</h2>
          <DataTable
            colunas={[
              {
                header: "Fechado às",
                cell: (c) => (
                  <Link
                    href={`/admin/operacao/caixa/${c.id}`}
                    className="text-orange-ink hover:underline"
                  >
                    {c.fechadoEm ? formatarDataHora(c.fechadoEm) : ""}
                  </Link>
                ),
              },
              {
                header: "Esperado",
                cell: (c) => formatarReais(c.esperadoDinheiroCentavos ?? 0),
                numerica: true,
              },
              {
                header: "Contado",
                cell: (c) => formatarReais(c.contadoDinheiroCentavos ?? 0),
                numerica: true,
              },
              {
                header: "Diferença",
                cell: (c) =>
                  c.diferencaCentavos ? (
                    <StatusPill tone="orange">
                      {formatarReais(c.diferencaCentavos)}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="ink">Bateu</StatusPill>
                  ),
              },
            ]}
            linhas={r.caixasFechados}
            chave={(c) => c.id}
            vazio="Nenhum caixa fechado neste dia."
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-ink text-sm font-semibold">Reservas</h2>
        </CardHeader>
        <CardBody className="text-ink-2 text-sm">
          {r.reservas.ativas} ativa(s) e {r.reservas.canceladas} cancelada(s)
          para as baterias deste dia. O recebido acima considera tudo que entrou
          no caixa neste dia, mesmo de reservas para outras datas.
        </CardBody>
      </Card>
    </div>
  );
}
