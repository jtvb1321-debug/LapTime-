import type { Metadata } from "next";
import Link from "next/link";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissao } from "@/lib/auth";
import {
  aniversariantesDoMes,
  clientesSumidos,
  type ClienteResumo,
} from "@/lib/operacao/clientes-store";
import {
  diaLocal,
  formatarDiaCurto,
  formatarMes,
  hojeEmSaoPaulo,
  mesAtual,
  somarMeses,
} from "@/lib/operacao/tempo";
import { linkWhatsApp } from "@/lib/operacao/whatsapp";

export const metadata: Metadata = { title: "Relacionamento" };
export const dynamic = "force-dynamic";

const DIAS_SUMIDO = [30, 60, 90, 180];

function BotaoWhatsApp({
  cliente,
  mensagem,
}: {
  cliente: ClienteResumo;
  mensagem: string;
}) {
  return (
    <a
      href={linkWhatsApp(cliente.telefone, mensagem)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-orange-ink text-sm font-medium hover:underline"
    >
      Chamar no WhatsApp
    </a>
  );
}

export default async function RelacionamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; dias?: string }>;
}) {
  if (!(await exigirPermissao("cliente.gerenciar"))) return <SemPermissao />;

  const { mes: mesPedido, dias: diasPedido } = await searchParams;
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesPedido ?? "")
    ? (mesPedido as string)
    : mesAtual();
  const dias = DIAS_SUMIDO.includes(Number(diasPedido))
    ? Number(diasPedido)
    : 60;
  const hoje = hojeEmSaoPaulo();

  const [aniversariantes, sumidos] = await Promise.all([
    aniversariantesDoMes(Number(mes.slice(5, 7))),
    clientesSumidos(dias),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Relacionamento"
        description="O sistema não envia nada sozinho: cada botão abre o WhatsApp com a mensagem pronta, e você decide se manda."
        actions={
          <Link
            href="/admin/operacao/clientes"
            className="text-ink-2 hover:text-orange-ink text-sm"
          >
            ← Clientes
          </Link>
        }
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-ink text-sm font-semibold">
            Aniversariantes de {formatarMes(mes)}
          </h2>
          <div className="flex gap-2">
            <ButtonLink
              href={`/admin/operacao/clientes/relacionamento?mes=${somarMeses(mes, -1)}&dias=${dias}`}
              variant="secondary"
            >
              ← Mês anterior
            </ButtonLink>
            <ButtonLink
              href={`/admin/operacao/clientes/relacionamento?mes=${somarMeses(mes, 1)}&dias=${dias}`}
              variant="secondary"
            >
              Próximo mês →
            </ButtonLink>
          </div>
        </div>
        <DataTable<ClienteResumo>
          colunas={[
            {
              header: "Dia",
              cell: (c) => (c.nascimento ? c.nascimento.slice(8, 10) : ""),
            },
            {
              header: "Cliente",
              cell: (c) => (
                <Link
                  href={`/admin/operacao/clientes/${c.id}`}
                  className="text-ink font-medium hover:underline"
                >
                  {c.nome}
                </Link>
              ),
            },
            {
              header: "Idade que faz",
              cell: (c) =>
                c.nascimento
                  ? Number(mes.slice(0, 4)) - Number(c.nascimento.slice(0, 4))
                  : "",
              numerica: true,
            },
            {
              header: "",
              cell: (c) => (
                <BotaoWhatsApp
                  cliente={c}
                  mensagem={`Parabéns, ${c.nome.split(" ")[0]}! 🎉 Toda a equipe do kartódromo deseja um ótimo aniversário. Venha comemorar na pista!`}
                />
              ),
            },
          ]}
          linhas={aniversariantes}
          chave={(c) => c.id}
          vazio="Nenhum aniversariante neste mês. A data de nascimento é preenchida no cadastro do cliente."
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-ink text-sm font-semibold">
            Clientes que não voltam há {dias} dias ou mais
          </h2>
          <div className="flex gap-2">
            {DIAS_SUMIDO.map((d) => (
              <ButtonLink
                key={d}
                href={`/admin/operacao/clientes/relacionamento?mes=${mes}&dias=${d}`}
                variant={d === dias ? "primary" : "secondary"}
              >
                {d} dias
              </ButtonLink>
            ))}
          </div>
        </div>
        <DataTable<ClienteResumo>
          colunas={[
            {
              header: "Cliente",
              cell: (c) => (
                <Link
                  href={`/admin/operacao/clientes/${c.id}`}
                  className="text-ink font-medium hover:underline"
                >
                  {c.nome}
                </Link>
              ),
            },
            { header: "Visitas", cell: (c) => c.visitas, numerica: true },
            {
              header: "Última visita",
              cell: (c) =>
                c.ultimaVisita
                  ? formatarDiaCurto(diaLocal(c.ultimaVisita))
                  : "",
            },
            {
              header: "",
              cell: (c) => (
                <BotaoWhatsApp
                  cliente={c}
                  mensagem={`Oi, ${c.nome.split(" ")[0]}! Sentimos sua falta na pista. Que tal marcar uma bateria nesta semana? Responda aqui e a gente reserva o seu horário.`}
                />
              ),
            },
          ]}
          linhas={sumidos}
          chave={(c) => c.id}
          vazio={`Ninguém sumido há ${dias} dias (hoje é ${formatarDiaCurto(hoje)}).`}
        />
      </section>
    </div>
  );
}
