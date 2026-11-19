import { AvisoEmDesenvolvimento } from "@/components/admin/aviso-em-desenvolvimento";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatData, getPilotoById, punicoes } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Recursos" };

export default function AdminRecursosPage() {
  return (
    <div className="flex flex-col gap-6">
      <AvisoEmDesenvolvimento />
      <PageHeader
        title="Recursos"
        description="Recursos contra punições ou resultados, protocolados pelos pilotos."
      />

      <p className="text-ink-2 text-sm">
        Nenhum recurso protocolado nesta etapa. Punições elegíveis para recurso:
      </p>

      <div className="flex flex-col gap-2">
        {punicoes.map((punicao) => (
          <Card key={punicao.id}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-ink text-sm font-medium">
                  {getPilotoById(punicao.pilotoId)?.nome}
                </p>
                <p className="text-ink-2 text-sm">
                  {punicao.tipo.replace("_", " ")} — {punicao.motivo}
                </p>
                <p className="text-ink-3 font-mono text-xs">
                  {formatData(punicao.aplicadaEm)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone="neutral">sem recurso</StatusPill>
                <Button variant="secondary">Registrar recurso</Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
