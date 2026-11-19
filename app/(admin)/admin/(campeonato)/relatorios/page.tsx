import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = { title: "Relatórios" };

const RELATORIOS = [
  {
    tipo: "resultados",
    titulo: "Resultados das corridas",
    descricao:
      "Posição, voltas, melhor volta, pole, volta mais rápida e pontos de cada piloto em cada corrida finalizada.",
  },
  {
    tipo: "inscricoes",
    titulo: "Inscrições por etapa",
    descricao:
      "Lista de inscritos por etapa, com categoria, situação da inscrição e do pagamento.",
  },
  {
    tipo: "financeiro",
    titulo: "Financeiro das inscrições",
    descricao:
      "Resumo por etapa de pagamentos recebidos, a receber e cancelados, com o total.",
  },
  {
    tipo: "punicoes",
    titulo: "Punições do campeonato",
    descricao:
      "Histórico completo de punições, com motivo e se ainda estão valendo.",
  },
];

export default function AdminRelatoriosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="Exportações em CSV do campeonato ativo, para abrir no Excel ou Google Planilhas."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {RELATORIOS.map((r) => (
          <Card key={r.tipo}>
            <CardBody className="flex flex-col gap-2">
              <h2 className="text-ink text-sm font-medium">{r.titulo}</h2>
              <p className="text-ink-2 text-sm">{r.descricao}</p>
              <a
                href={`/api/relatorios/campeonato?tipo=${r.tipo}`}
                download
                className="bg-surface text-ink border-border-strong hover:border-orange hover:text-orange-ink mt-2 inline-flex min-h-11 items-center self-start rounded-md border px-4 text-sm font-medium md:min-h-9"
              >
                Baixar CSV
              </a>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
