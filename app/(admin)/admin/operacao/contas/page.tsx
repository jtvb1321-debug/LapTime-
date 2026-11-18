import type { Metadata } from "next";
import { Campo, FormAcao, Selecao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  cancelarContaAction,
  criarContaAction,
  pagarContaAction,
} from "@/lib/operacao-actions";
import {
  CATEGORIAS_CONTA,
  listarContas,
  type ContaPagar,
} from "@/lib/operacao/financeiro-store";
import {
  ehMesValido,
  formatarDiaCurto,
  formatarMes,
  formatarReais,
  hojeEmSaoPaulo,
  mesAtual,
  somarMeses,
} from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Contas a pagar" };
export const dynamic = "force-dynamic";

const FORMA = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  transferencia: "Transferência",
};

function Situacao({ conta }: { conta: ContaPagar }) {
  switch (conta.situacao) {
    case "paga":
      return (
        <StatusPill tone="ink">
          Paga{conta.pagoForma ? ` · ${FORMA[conta.pagoForma]}` : ""}
        </StatusPill>
      );
    case "vencida":
      return <StatusPill tone="orange">Vencida</StatusPill>;
    case "cancelada":
      return <StatusPill tone="neutral">Cancelada</StatusPill>;
    default:
      return <StatusPill tone="orange-soft">A vencer</StatusPill>;
  }
}

function Acoes({ conta }: { conta: ContaPagar }) {
  if (conta.situacao === "paga" || conta.situacao === "cancelada") return null;
  return (
    <div className="flex flex-col gap-2">
      <details>
        <summary className="text-orange-ink cursor-pointer text-sm font-medium">
          Marcar como paga
        </summary>
        <FormAcao
          action={pagarContaAction}
          rotulo="Confirmar pagamento"
          className="mt-2 w-56"
        >
          <input type="hidden" name="contaId" value={conta.id} />
          <Selecao id="forma" rotulo="Como foi paga" defaultValue="">
            <option value="" disabled>
              Escolha…
            </option>
            {Object.entries(FORMA).map(([valor, nome]) => (
              <option key={valor} value={valor}>
                {nome}
              </option>
            ))}
          </Selecao>
        </FormAcao>
      </details>
      <details>
        <summary className="text-ink-2 cursor-pointer text-sm">
          Cancelar
        </summary>
        <FormAcao
          action={cancelarContaAction}
          rotulo="Cancelar conta"
          variante="secondary"
          className="mt-2 w-56"
        >
          <input type="hidden" name="contaId" value={conta.id} />
          <Campo id="motivo" rotulo="Motivo" required minLength={3} />
        </FormAcao>
      </details>
    </div>
  );
}

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  if (!(await exigirPermissao("financeiro.gerenciar"))) return <SemPermissao />;

  const { mes: pedido } = await searchParams;
  const atual = mesAtual();
  const mes = pedido && ehMesValido(pedido) ? pedido : atual;
  const contas = await listarContas(mes);
  const hoje = hojeEmSaoPaulo();

  const soma = (filtro: (c: ContaPagar) => boolean) =>
    contas.filter(filtro).reduce((t, c) => t + c.valorCentavos, 0);
  const emAberto = soma((c) => c.situacao === "aberta");
  const vencidas = soma((c) => c.situacao === "vencida");
  const pagas = soma((c) => c.situacao === "paga");

  const colunas: Coluna<ContaPagar>[] = [
    {
      header: "Vencimento",
      cell: (c) => (
        <span
          className={
            c.situacao === "vencida" ? "font-semibold text-danger" : undefined
          }
        >
          {formatarDiaCurto(c.vencimento)}
        </span>
      ),
    },
    {
      header: "Conta",
      cell: (c) => (
        <div>
          <p className="text-ink font-medium">{c.descricao}</p>
          <p className="text-ink-3 text-xs">
            {c.categoria}
            {c.fornecedor ? ` · ${c.fornecedor}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Valor",
      cell: (c) => formatarReais(c.valorCentavos),
      numerica: true,
    },
    { header: "Situação", cell: (c) => <Situacao conta={c} /> },
    { header: "", cell: (c) => <Acoes conta={c} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contas a pagar"
        description={`${formatarMes(mes)} — inclui contas vencidas de meses anteriores que ainda estão em aberto (hoje: ${formatarDiaCurto(hoje)}).`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink
              href={`/admin/operacao/contas?mes=${somarMeses(mes, -1)}`}
              variant="secondary"
            >
              ← Mês anterior
            </ButtonLink>
            {mes !== atual ? (
              <ButtonLink href="/admin/operacao/contas" variant="secondary">
                Este mês
              </ButtonLink>
            ) : null}
            <ButtonLink
              href={`/admin/operacao/contas?mes=${somarMeses(mes, 1)}`}
              variant="secondary"
            >
              Próximo mês →
            </ButtonLink>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="A vencer" value={formatarReais(emAberto)} />
        <StatCard label="Vencidas" value={formatarReais(vencidas)} />
        <StatCard label="Pagas" value={formatarReais(pagas)} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <DataTable
          colunas={colunas}
          linhas={contas}
          chave={(c) => c.id}
          vazio="Nenhuma conta neste mês."
        />

        <Card>
          <CardHeader>
            <h2 className="text-ink text-sm font-semibold">Lançar conta</h2>
          </CardHeader>
          <CardBody>
            <FormAcao action={criarContaAction} rotulo="Lançar conta">
              <Campo id="descricao" rotulo="Descrição" required minLength={3} />
              <Selecao
                id="categoria"
                rotulo="Categoria"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Escolha…
                </option>
                {CATEGORIAS_CONTA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Selecao>
              <Campo id="fornecedor" rotulo="Fornecedor (opcional)" />
              <Campo
                id="valor"
                rotulo="Valor (R$)"
                inputMode="decimal"
                required
              />
              <Campo id="vencimento" rotulo="Vencimento" type="date" required />
              <Campo
                id="repetirMeses"
                rotulo="Repetir por quantos meses"
                type="number"
                min={1}
                max={24}
                defaultValue={1}
                dica="Para contas fixas (aluguel, internet): cria uma por mês."
              />
              <Campo id="observacao" rotulo="Observação (opcional)" />
            </FormAcao>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
