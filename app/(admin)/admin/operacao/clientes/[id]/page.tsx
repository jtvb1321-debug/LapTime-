import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Campo, FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  atualizarClienteAction,
  registrarAceiteAction,
} from "@/lib/operacao-actions";
import {
  lerClienteComResumo,
  lerVisitasDoCliente,
  type VisitaDoCliente,
} from "@/lib/operacao/clientes-store";
import {
  situacaoDoTermo,
  termoAtual,
  VALIDADE_ACEITE_DIAS,
  ultimoAceiteDoCliente,
} from "@/lib/operacao/termo-store";
import {
  diaLocal,
  formatarDataHora,
  formatarDiaCurto,
  formatarReais,
  hojeEmSaoPaulo,
  idadeEm,
} from "@/lib/operacao/tempo";
import { linkWhatsApp } from "@/lib/operacao/whatsapp";

export const metadata: Metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await exigirPermissao("cliente.gerenciar"))) return <SemPermissao />;
  const { id } = await params;
  const cliente = await lerClienteComResumo(id);
  if (!cliente) notFound();

  const [visitas, termo, situacao, aceite] = await Promise.all([
    lerVisitasDoCliente(id),
    termoAtual(),
    situacaoDoTermo(id),
    ultimoAceiteDoCliente(id),
  ]);
  const idade = cliente.nascimento
    ? idadeEm(cliente.nascimento, hojeEmSaoPaulo())
    : null;

  const precisaAssinar = situacao.situacao !== "valido";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={cliente.nome}
        description={`Cadastro nº ${cliente.numero} · ${cliente.telefone}${idade !== null ? ` · ${idade} anos` : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <a
              href={linkWhatsApp(cliente.telefone, `Olá, ${cliente.nome}!`)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-ink text-sm font-medium hover:underline"
            >
              Chamar no WhatsApp
            </a>
            <Link
              href="/admin/operacao/clientes"
              className="text-ink-2 hover:text-orange-ink text-sm"
            >
              ← Clientes
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Visitas" value={cliente.visitas} />
        <StatCard
          label="Última visita"
          value={
            cliente.ultimaVisita
              ? formatarDiaCurto(diaLocal(cliente.ultimaVisita))
              : "—"
          }
        />
        <StatCard
          label="Já pagou"
          value={formatarReais(cliente.gastoCentavos)}
        />
        <StatCard
          label="Termo de responsabilidade"
          value={
            situacao.situacao === "valido"
              ? "Válido"
              : situacao.situacao === "pendente"
                ? "Pendente"
                : situacao.situacao === "vencido"
                  ? "Vencido"
                  : "Desatualizado"
          }
          hint={
            situacao.situacao === "valido"
              ? `Assinado em ${formatarDataHora(situacao.aceitoEm)}`
              : undefined
          }
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <h2 className="text-ink text-sm font-semibold">
              Termo de responsabilidade (versão {termo.versao})
            </h2>
            {situacao.situacao === "valido" ? (
              <StatusPill tone="ink">Assinado</StatusPill>
            ) : (
              <StatusPill tone="orange">Precisa assinar</StatusPill>
            )}
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div className="border-border bg-ink/5 max-h-56 overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap">
              {termo.texto}
            </div>
            {precisaAssinar ? (
              <FormAcao
                action={registrarAceiteAction}
                rotulo="Registrar assinatura"
              >
                <input type="hidden" name="clienteId" value={cliente.id} />
                <Campo
                  id="assinante"
                  rotulo="Nome completo de quem assina"
                  defaultValue={cliente.nome}
                  required
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="porMenor" />
                  Quem assina é o responsável legal por um menor de idade
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="leu" />O cliente leu o termo
                  acima e concorda
                </label>
              </FormAcao>
            ) : (
              <p className="text-ink-2 text-sm">
                Assinado por {situacao.assinante}. Vale por{" "}
                {VALIDADE_ACEITE_DIAS} dias ou até o texto do termo mudar.
              </p>
            )}
            {aceite ? (
              <div className="border-border flex flex-col gap-2 rounded-md border p-3">
                <p className="text-ink-3 text-xs font-semibold tracking-wide uppercase">
                  Comprovante da última assinatura
                </p>
                <p className="text-ink-2 text-sm">
                  {aceite.assinante}
                  {aceite.porMenor ? " (responsável legal)" : ""} ·{" "}
                  {formatarDataHora(aceite.aceitoEm)} · versão {aceite.versao} ·{" "}
                  {aceite.canal === "link"
                    ? "pelo link, no celular"
                    : "no balcão"}
                  {aceite.documento ? ` · doc. ${aceite.documento}` : ""}
                </p>
                {aceite.assinaturaPng ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={aceite.assinaturaPng}
                    alt={`Assinatura de ${aceite.assinante}`}
                    className="h-24 w-auto self-start rounded border border-black/10 bg-white"
                  />
                ) : null}
              </div>
            ) : null}
            {situacao.situacao === "vencido" ||
            situacao.situacao === "desatualizado" ? (
              <p className="text-ink-2 text-xs">
                {situacao.situacao === "vencido"
                  ? "O último termo passou da validade."
                  : "O texto do termo mudou desde a última assinatura."}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-ink text-sm font-semibold">Dados do cliente</h2>
          </CardHeader>
          <CardBody>
            <FormAcao
              action={atualizarClienteAction}
              rotulo="Salvar dados"
              limpar={false}
            >
              <input type="hidden" name="clienteId" value={cliente.id} />
              <Campo
                id="apelido"
                rotulo="Apelido"
                defaultValue={cliente.apelido ?? ""}
                maxLength={40}
              />
              <Campo
                id="telefone"
                rotulo="Telefone com DDD"
                defaultValue={cliente.telefone}
                inputMode="tel"
                required
              />
              <Campo
                id="email"
                rotulo="E-mail"
                type="email"
                defaultValue={cliente.email ?? ""}
              />
              <Campo
                id="documento"
                rotulo="CPF"
                defaultValue={cliente.documento ?? ""}
                inputMode="numeric"
              />
              <Campo
                id="nascimento"
                rotulo="Data de nascimento"
                type="date"
                defaultValue={cliente.nascimento ?? ""}
                dica="Usada para aniversariantes e para saber se é menor de idade."
              />
            </FormAcao>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-ink text-sm font-semibold">Reservas</h2>
        <DataTable<VisitaDoCliente>
          colunas={[
            {
              header: "Bateria",
              cell: (v) => (
                <Link
                  href={`/admin/operacao/recibo/${v.reservaId}`}
                  className="text-orange-ink hover:underline"
                >
                  {formatarDataHora(v.inicio)}
                </Link>
              ),
            },
            { header: "Pilotos", cell: (v) => v.pilotos, numerica: true },
            {
              header: "Valor",
              cell: (v) => formatarReais(v.valorCentavos),
              numerica: true,
            },
            {
              header: "Pago",
              cell: (v) => formatarReais(v.pagoCentavos),
              numerica: true,
            },
            {
              header: "Situação",
              cell: (v) =>
                v.status === "cancelada" ? (
                  <StatusPill tone="neutral">Cancelada</StatusPill>
                ) : v.pagoCentavos >= v.valorCentavos ? (
                  <StatusPill tone="ink">Paga</StatusPill>
                ) : (
                  <StatusPill tone="orange-soft">Em aberto</StatusPill>
                ),
            },
          ]}
          linhas={visitas}
          chave={(v) => v.reservaId}
          vazio="Este cliente ainda não tem reservas."
        />
      </div>
    </div>
  );
}
