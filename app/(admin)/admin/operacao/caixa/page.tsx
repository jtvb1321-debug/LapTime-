import type { Metadata } from "next";
import Link from "next/link";
import { Campo, FormAcao, Selecao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  abrirCaixaAction,
  estornarAction,
  fecharCaixaAction,
  suprimentoOuSangriaAction,
} from "@/lib/operacao-actions";
import {
  caixaAberto,
  caixasFechados,
  lerMovimentos,
  resumoDoCaixa,
  type MovimentoDoCaixa,
} from "@/lib/operacao/caixa-store";
import {
  diaLocal,
  formatarDataHora,
  formatarHora,
  formatarReais,
  hojeEmSaoPaulo,
} from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Caixa" };
export const dynamic = "force-dynamic";

const ROTULO_FORMA = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão" };
const ROTULO_TIPO = {
  pagamento: "Pagamento",
  estorno: "Estorno",
  suprimento: "Suprimento",
  sangria: "Sangria",
};

export default async function CaixaPage() {
  const sessao = await exigirPermissao("caixa.operar");
  if (!sessao) return <SemPermissao />;
  const podeEstornar = pode(sessao.papel, "caixa.estornar");

  const caixa = await caixaAberto();
  const fechados = await caixasFechados();

  const historico = (
    <div className="flex flex-col gap-3">
      <h2 className="text-ink text-sm font-semibold">Últimos fechamentos</h2>
      <DataTable
        colunas={[
          {
            header: "Aberto",
            cell: (c) => (
              <Link
                href={`/admin/operacao/caixa/${c.id}`}
                className="text-orange-ink hover:underline"
              >
                {formatarDataHora(c.abertoEm)}
              </Link>
            ),
          },
          {
            header: "Fechado",
            cell: (c) => (c.fechadoEm ? formatarDataHora(c.fechadoEm) : ""),
          },
          {
            header: "Dinheiro esperado",
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
          { header: "Observação", cell: (c) => c.observacao ?? "" },
        ]}
        linhas={fechados}
        chave={(c) => c.id}
        vazio="Nenhum caixa fechado ainda."
      />
    </div>
  );

  if (!caixa) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Caixa"
          description="O caixa está fechado. Abra para começar a receber."
        />
        <Card className="max-w-md">
          <CardHeader>
            <h2 className="text-ink text-sm font-semibold">Abrir o caixa</h2>
          </CardHeader>
          <CardBody>
            <FormAcao action={abrirCaixaAction} rotulo="Abrir caixa">
              <Campo
                id="fundo"
                rotulo="Fundo de troco (R$)"
                inputMode="decimal"
                defaultValue="0,00"
                dica="Dinheiro que já está na gaveta ao abrir."
              />
            </FormAcao>
          </CardBody>
        </Card>
        {historico}
      </div>
    );
  }

  const [resumo, movimentos] = await Promise.all([
    resumoDoCaixa(caixa),
    lerMovimentos(caixa.id),
  ]);
  const abertoEmOutroDia = diaLocal(caixa.abertoEm) !== hojeEmSaoPaulo();

  const colunas: Coluna<MovimentoDoCaixa>[] = [
    { header: "Hora", cell: (m) => formatarHora(m.criadoEm) },
    {
      header: "Tipo",
      cell: (m) => (
        <StatusPill
          tone={
            m.tipo === "pagamento" || m.tipo === "suprimento"
              ? "ink"
              : "orange-soft"
          }
        >
          {ROTULO_TIPO[m.tipo]}
        </StatusPill>
      ),
    },
    { header: "Forma", cell: (m) => ROTULO_FORMA[m.forma] },
    {
      header: "Cliente / motivo",
      cell: (m) => m.clienteNome ?? m.descricao ?? "",
    },
    {
      header: "Valor",
      cell: (m) => {
        const saida = m.tipo === "estorno" || m.tipo === "sangria";
        return `${saida ? "−" : "+"} ${formatarReais(m.valorCentavos)}`;
      },
      numerica: true,
    },
    {
      header: "",
      cell: (m) => {
        if (m.tipo !== "pagamento") return null;
        if (m.estornado)
          return <StatusPill tone="neutral">Estornado</StatusPill>;
        if (!podeEstornar) return null;
        return (
          <details>
            <summary className="text-ink-2 cursor-pointer text-xs">
              Estornar
            </summary>
            <FormAcao
              action={estornarAction}
              rotulo="Confirmar estorno"
              variante="secondary"
              className="mt-2 w-56"
            >
              <input type="hidden" name="movimentoId" value={m.id} />
              <Campo id="motivo" rotulo="Motivo" required minLength={3} />
            </FormAcao>
          </details>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Caixa aberto"
        description={`Aberto em ${formatarDataHora(caixa.abertoEm)} · fundo de ${formatarReais(caixa.fundoCentavos)}`}
      />

      {abertoEmOutroDia ? (
        <Card>
          <CardBody>
            <p className="text-ink text-sm font-medium">
              Este caixa foi aberto em outro dia.
            </p>
            <p className="text-ink-2 mt-1 text-sm">
              Feche-o abaixo antes de começar o dia de hoje.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total recebido"
          value={formatarReais(resumo.totalRecebido)}
          hint="Já descontados os estornos"
        />
        <StatCard
          label="Dinheiro"
          value={formatarReais(resumo.recebido.dinheiro)}
        />
        <StatCard label="Pix" value={formatarReais(resumo.recebido.pix)} />
        <StatCard
          label="Cartão"
          value={formatarReais(resumo.recebido.cartao)}
        />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-ink-3 text-xs tracking-wide uppercase">
              Dinheiro que deve estar na gaveta
            </p>
            <p className="text-ink mt-1 font-mono text-2xl font-semibold">
              {formatarReais(resumo.esperadoDinheiro)}
            </p>
          </div>
          <p className="text-ink-2 max-w-sm text-xs">
            Fundo {formatarReais(caixa.fundoCentavos)} + dinheiro recebido{" "}
            {formatarReais(resumo.recebido.dinheiro)} + suprimentos{" "}
            {formatarReais(resumo.suprimentos)} − sangrias{" "}
            {formatarReais(resumo.sangrias)}
          </p>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-ink text-sm font-semibold">Movimentos do caixa</h2>
        <DataTable
          colunas={colunas}
          linhas={movimentos}
          chave={(m) => String(m.id)}
          vazio="Nenhum movimento ainda. Os pagamentos são lançados na Agenda de baterias."
        />
        <Link
          href="/admin/operacao/agenda"
          className="text-orange-ink text-sm font-medium hover:underline"
        >
          Ir para a agenda e receber pagamentos →
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-ink text-sm font-semibold">
              Suprimento ou sangria
            </h2>
          </CardHeader>
          <CardBody>
            <FormAcao action={suprimentoOuSangriaAction} rotulo="Registrar">
              <Selecao id="tipo" rotulo="O que aconteceu" defaultValue="">
                <option value="" disabled>
                  Escolha…
                </option>
                <option value="suprimento">
                  Suprimento — entrou dinheiro no caixa
                </option>
                <option value="sangria">
                  Sangria — retirou dinheiro do caixa
                </option>
              </Selecao>
              <Campo
                id="valor"
                rotulo="Valor (R$)"
                inputMode="decimal"
                required
              />
              <Campo id="descricao" rotulo="Motivo" required minLength={3} />
            </FormAcao>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-ink text-sm font-semibold">Fechar o caixa</h2>
          </CardHeader>
          <CardBody>
            <FormAcao
              action={fecharCaixaAction}
              rotulo="Fechar caixa"
              variante="secondary"
              limpar={false}
            >
              <input type="hidden" name="caixaId" value={caixa.id} />
              <Campo
                id="contado"
                rotulo="Dinheiro contado na gaveta (R$)"
                inputMode="decimal"
                required
                dica={`O sistema espera ${formatarReais(resumo.esperadoDinheiro)}. Pix e cartão são conferidos pelos totais acima.`}
              />
              <Campo
                id="observacao"
                rotulo="Observação"
                dica="Obrigatória se o valor contado não bater."
              />
            </FormAcao>
          </CardBody>
        </Card>
      </div>

      {historico}
    </div>
  );
}
