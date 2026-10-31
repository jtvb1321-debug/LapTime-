import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Relatórios" };

const RELATORIOS = [
  {
    titulo: "Resultados por etapa",
    descricao: "Exporta os resultados de todas as baterias de uma etapa.",
  },
  {
    titulo: "Inscrições por categoria",
    descricao: "Lista de inscritos e status de pagamento por categoria.",
  },
  {
    titulo: "Financeiro",
    descricao: "Resumo de pagamentos confirmados, pendentes e cancelados.",
  },
  {
    titulo: "Punições da temporada",
    descricao: "Histórico completo de punições aplicadas.",
  },
];

export default function AdminRelatoriosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="Exportações em CSV para uso externo."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {RELATORIOS.map((relatorio) => (
          <Card key={relatorio.titulo}>
            <CardBody className="flex flex-col gap-2">
              <h2 className="text-ink text-sm font-medium">
                {relatorio.titulo}
              </h2>
              <p className="text-ink-2 text-sm">{relatorio.descricao}</p>
              <Button variant="secondary" disabled className="mt-2 self-start">
                Exportar CSV (em breve)
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
