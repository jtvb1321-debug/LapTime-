import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill, type Tone } from "@/components/ui/status-pill";
import type { PilotoDaCorrida } from "@/lib/cronometragem/corridas-store";
import {
  pilotosComPendencia,
  type TipoPendencia,
} from "@/lib/cronometragem/pendencias";

// Termo, kart e sensor impedem de ir à pista (regra atual); pagamento e
// check-in são avisos.
const TOM: Record<TipoPendencia, Tone> = {
  vaga: "warning",
  termo: "danger",
  kart: "danger",
  transponder: "danger",
  pagamento: "warning",
  checkin: "info",
};

export function PendenciasDaPista({
  grid,
  href,
}: {
  grid: PilotoDaCorrida[];
  // Quando informado, leva à tela da bateria.
  href?: string;
}) {
  const itens = pilotosComPendencia(grid);
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <h2 className="text-ink text-sm font-semibold">
          Pendências para entrar na pista
        </h2>
        {href ? (
          <Link
            href={href}
            className="text-orange-ink inline-flex min-h-11 items-center text-sm font-medium hover:underline md:min-h-0"
          >
            Abrir a bateria
          </Link>
        ) : null}
      </CardHeader>
      <CardBody>
        {grid.length === 0 ? (
          <p className="text-ink-2 text-sm">Nenhum piloto cadastrado ainda.</p>
        ) : itens.length === 0 ? (
          <p className="text-ink-2 text-sm">
            Nenhuma pendência: todos com termo, kart, pagamento e check-in.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {itens.map(({ piloto, pendencias }) => (
              <li
                key={piloto.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <p className="text-ink min-w-0 truncate text-sm font-medium">
                  {piloto.vaga ? "Vaga aberta" : piloto.nome}
                  {piloto.kartNumero ? (
                    <span className="text-ink-3 font-mono text-xs">
                      {" "}
                      · kart {piloto.kartNumero}
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pendencias.map((p) => (
                    <StatusPill key={p.tipo} tone={TOM[p.tipo]}>
                      {p.texto}
                    </StatusPill>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
