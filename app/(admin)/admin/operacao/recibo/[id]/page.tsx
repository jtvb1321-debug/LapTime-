import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoImprimir } from "@/components/operacao/botao-imprimir";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { exigirPermissao } from "@/lib/auth";
import { lerReserva } from "@/lib/operacao/agenda-store";
import { lerPagamentosDaReserva } from "@/lib/operacao/relatorios-store";
import {
  diaLocal,
  formatarDataHora,
  formatarDiaLongo,
  formatarHora,
  formatarReais,
} from "@/lib/operacao/tempo";
import { linkWhatsApp } from "@/lib/operacao/whatsapp";

export const metadata: Metadata = { title: "Recibo da reserva" };
export const dynamic = "force-dynamic";

const FORMA = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão" };

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await exigirPermissao("agenda.gerenciar"))) return <SemPermissao />;
  const { id } = await params;
  const reserva = await lerReserva(id);
  if (!reserva) notFound();
  const pagamentos = await lerPagamentosDaReserva(id);
  const dia = diaLocal(reserva.inicio);
  const saldo = reserva.valorCentavos - reserva.pagoCentavos;

  const mensagem = [
    `Olá, ${reserva.clienteNome}! Sua reserva no kartódromo está confirmada.`,
    `Bateria: ${formatarDiaLongo(dia)}, ${formatarHora(reserva.inicio)}`,
    `Pilotos: ${reserva.pilotos}`,
    `Valor: ${formatarReais(reserva.valorCentavos)}`,
    saldo > 0
      ? `Falta pagar: ${formatarReais(saldo)} (no balcão)`
      : "Pagamento: quitado ✔",
  ].join("\n");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/operacao/agenda?dia=${dia}`}
          className="text-ink-2 hover:text-orange-ink text-sm"
        >
          ← Voltar à agenda
        </Link>
        <div className="flex gap-2">
          <a
            href={linkWhatsApp(reserva.telefone, mensagem)}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border-strong text-ink hover:border-orange/50 hover:text-orange-ink inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            Enviar por WhatsApp
          </a>
          <BotaoImprimir />
        </div>
      </div>

      <div className="border-border bg-surface rounded-lg border p-6 print:border-0 print:p-0">
        <p className="text-ink-3 text-xs tracking-wide uppercase">
          Recibo de reserva · Grid Lap
        </p>
        <h1 className="text-ink mt-1 text-xl font-semibold">
          {reserva.clienteNome}
        </h1>
        <p className="text-ink-2 text-sm">{reserva.telefone}</p>

        <dl className="border-border mt-5 grid grid-cols-2 gap-y-2 border-t pt-4 text-sm">
          <dt className="text-ink-2">Bateria</dt>
          <dd className="text-right">
            {formatarDiaLongo(dia)}, {formatarHora(reserva.inicio)}
          </dd>
          <dt className="text-ink-2">Pilotos</dt>
          <dd className="font-display text-right text-base">
            {reserva.pilotos}
          </dd>
          {reserva.descontoCentavos > 0 ? (
            <>
              <dt className="text-ink-2">Desconto</dt>
              <dd className="font-display text-right text-base">
                − {formatarReais(reserva.descontoCentavos)}
              </dd>
            </>
          ) : null}
          <dt className="text-ink font-medium">Total</dt>
          <dd className="font-display text-right text-base font-semibold">
            {formatarReais(reserva.valorCentavos)}
          </dd>
          <dt className="text-ink-2">Pago</dt>
          <dd className="font-display text-right text-base">
            {formatarReais(reserva.pagoCentavos)}
          </dd>
          <dt className="text-ink font-medium">Saldo</dt>
          <dd className="font-display text-right text-base font-semibold">
            {formatarReais(Math.max(saldo, 0))}
          </dd>
        </dl>

        {pagamentos.length > 0 ? (
          <div className="border-border mt-5 border-t pt-4">
            <p className="text-ink mb-2 text-sm font-medium">Pagamentos</p>
            <ul className="text-ink-2 flex flex-col gap-1 text-sm">
              {pagamentos.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span>
                    {formatarDataHora(p.criadoEm)} ·{" "}
                    {p.tipo === "estorno" ? "Estorno" : FORMA[p.forma]}
                  </span>
                  <span className="font-display text-base">
                    {p.tipo === "estorno" ? "− " : ""}
                    {formatarReais(p.valorCentavos)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {reserva.status === "cancelada" ? (
          <p className="text-danger mt-5 text-sm font-semibold">
            RESERVA CANCELADA
          </p>
        ) : null}

        <p className="text-ink-3 mt-6 text-xs">
          Documento de controle interno. Não tem valor fiscal.
        </p>
      </div>
      <div className="print:hidden">
        <ButtonLink
          href={`/admin/operacao/clientes/${reserva.clienteId}`}
          variant="ghost"
        >
          Ver histórico do cliente
        </ButtonLink>
      </div>
    </div>
  );
}
