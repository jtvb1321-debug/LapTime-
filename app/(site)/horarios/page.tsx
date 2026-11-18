import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { StatusPill } from "@/components/ui/status-pill";
import { lerHorariosPublicos } from "@/lib/operacao/agenda-store";
import {
  ehDiaValido,
  formatarHora,
  formatarReais,
  hojeEmSaoPaulo,
  instanteLocal,
  somarDias,
} from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Horários" };
export const dynamic = "force-dynamic";

const DIAS_VISIVEIS = 7;

function rotuloDoDia(
  dia: string,
  hoje: string,
): { curto: string; numero: string } {
  const data = instanteLocal(dia, "12:00");
  const semana = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(data);
  const numero = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(data);
  return { curto: dia === hoje ? "Hoje" : semana.replace(".", ""), numero };
}

export default async function HorariosPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const hoje = hojeEmSaoPaulo();
  const { dia: pedido } = await searchParams;
  const ultimo = somarDias(hoje, DIAS_VISIVEIS - 1);
  const dia =
    pedido && ehDiaValido(pedido) && pedido >= hoje && pedido <= ultimo
      ? pedido
      : hoje;
  const dias = Array.from({ length: DIAS_VISIVEIS }, (_, i) =>
    somarDias(hoje, i),
  );
  const horarios = await lerHorariosPublicos(dia);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-ink before:bg-orange text-3xl font-bold tracking-tight before:mb-2 before:block before:h-1 before:w-9 before:rounded-full before:content-['']">
          Horários das baterias
        </h1>
        <p className="text-ink-2 mt-1 text-sm">
          Veja os horários e as vagas. A reserva e o pagamento são feitos no
          balcão do kartódromo.
        </p>
      </div>

      <nav aria-label="Escolha o dia" className="flex flex-wrap gap-2">
        {dias.map((d) => {
          const r = rotuloDoDia(d, hoje);
          const ativo = d === dia;
          return (
            <Link
              key={d}
              href={d === hoje ? "/horarios" : `/horarios?dia=${d}`}
              aria-current={ativo ? "date" : undefined}
              className={clsx(
                "flex min-w-16 flex-col items-center rounded-md border px-3 py-2 text-xs transition-colors",
                ativo
                  ? "border-orange bg-orange/10 text-orange-ink"
                  : "border-border-strong text-ink-2 hover:border-orange/50 hover:text-orange-ink",
              )}
            >
              <span className="font-medium capitalize">{r.curto}</span>
              <span className="font-display">{r.numero}</span>
            </Link>
          );
        })}
      </nav>

      {horarios.length === 0 ? (
        <div className="border-border bg-surface text-ink-2 rounded-lg border px-5 py-10 text-center text-sm">
          Nenhuma bateria disponível neste dia. Confira outro dia ou fale com a
          gente no balcão.
        </div>
      ) : (
        <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
          {horarios.map((h) => (
            <li
              key={h.inicio.toISOString()}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div>
                <p className="text-ink font-display text-lg font-semibold">
                  {formatarHora(h.inicio)}
                </p>
                <p className="text-ink-2 text-xs">
                  {h.duracaoMin} minutos de pista
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-ink text-sm">
                  <span className="font-display font-semibold">
                    {formatarReais(h.precoCentavos)}
                  </span>{" "}
                  <span className="text-ink-2">por piloto</span>
                </p>
                {h.vagas === 0 ? (
                  <StatusPill tone="neutral">Lotada</StatusPill>
                ) : h.vagas <= 2 ? (
                  <StatusPill tone="orange">
                    {h.vagas === 1 ? "Última vaga" : "Últimas 2 vagas"}
                  </StatusPill>
                ) : (
                  <StatusPill tone="ink">Vagas disponíveis</StatusPill>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
