import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { definirSimulacaoAction } from "@/lib/simulacao-actions";
import { simulacaoEstaAtiva } from "@/lib/mock/data";

// Liga/desliga os dados de demonstração. Desligado (padrão), o sistema fica
// só com os dados reais; ligado, carrega 10 pilotos fictícios, a Etapa 1 com
// a final ao vivo e a Etapa 2 encerrada — o mesmo cenário usado nas
// demonstrações. Vale pra todos que acessam o sistema (fica salvo no servidor).
export function SimulacaoCard() {
  const ativa = simulacaoEstaAtiva();

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-ink text-sm font-semibold">
              Dados de demonstração
            </h2>
            <StatusPill tone={ativa ? "orange" : "neutral"}>
              {ativa ? "Simulação ativa" : "Desligada"}
            </StatusPill>
          </div>
          <p className="text-ink-2 text-sm">
            {ativa
              ? "Pilotos, baterias e resultados fictícios estão carregados (final ao vivo na Etapa 1). Limpe para voltar só aos dados reais."
              : "O sistema está só com dados reais. Simule para carregar 10 pilotos fictícios, uma final ao vivo e resultados de duas etapas."}
          </p>
        </div>
        <form action={definirSimulacaoAction}>
          <input type="hidden" name="ativa" value={ativa ? "0" : "1"} />
          <Button type="submit" variant={ativa ? "secondary" : "primary"}>
            {ativa ? "Limpar simulação" : "Simular dados"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
