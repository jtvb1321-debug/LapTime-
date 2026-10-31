import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { Campo, FormAcao, Selecao } from "@/components/operacao/form-acao";
import { PilotosDaReserva } from "@/components/operacao/pilotos-da-reserva";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  abrirBateriaDaAgendaAction,
  novaBateriaAction,
} from "@/lib/corrida-actions";
import {
  cancelarBateriaAction,
  cancelarReservaAction,
  gerarGradeAction,
  agendarBateriaAction,
  pagamentoAction,
} from "@/lib/operacao-actions";
import {
  lerAgendaDoDia,
  type ReservaDoSlot,
  type SlotDoDia,
} from "@/lib/operacao/agenda-store";
import { padroesDeAgenda } from "@/lib/operacao/agenda-store";
import { caixaAberto } from "@/lib/operacao/caixa-store";
import {
  listarPilotosDasReservas,
  type PilotoDaReserva,
} from "@/lib/operacao/reserva-pilotos-store";
import { clientesComTermoValido } from "@/lib/operacao/termo-store";
import { pode } from "@/lib/permissoes";
import {
  agoraMs,
  centavosParaCampo,
  ehDiaValido,
  formatarDiaLongo,
  formatarHora,
  formatarReais,
  hojeEmSaoPaulo,
  somarDias,
} from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Agenda de baterias" };
export const dynamic = "force-dynamic";

function SituacaoPagamento({ reserva }: { reserva: ReservaDoSlot }) {
  if (reserva.status === "cancelada") {
    return <StatusPill tone="neutral">Cancelada</StatusPill>;
  }
  const saldo = reserva.valorCentavos - reserva.pagoCentavos;
  if (saldo <= 0) return <StatusPill tone="ink">Pago</StatusPill>;
  if (reserva.pagoCentavos > 0) {
    return <StatusPill tone="orange">Falta {formatarReais(saldo)}</StatusPill>;
  }
  return <StatusPill tone="orange-soft">Em aberto</StatusPill>;
}

function LinhaReserva({
  reserva,
  caixaEstaAberto,
  termoValido,
  pilotos,
}: {
  reserva: ReservaDoSlot;
  caixaEstaAberto: boolean;
  termoValido: boolean;
  pilotos: PilotoDaReserva[];
}) {
  const ativa = reserva.status === "reservada";
  const saldo = reserva.valorCentavos - reserva.pagoCentavos;

  return (
    <li className="border-border flex flex-col gap-3 border-t py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={clsx(!ativa && "text-ink-3 line-through")}>
          <p className="text-ink text-sm font-medium">{reserva.clienteNome}</p>
          <p className="text-ink-2 text-xs">
            {reserva.telefone} · {reserva.pilotos}{" "}
            {reserva.pilotos === 1 ? "piloto" : "pilotos"} ·{" "}
            {formatarReais(reserva.valorCentavos)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ativa && !termoValido ? (
            <Link href={`/admin/operacao/clientes/${reserva.clienteId}`}>
              <StatusPill tone="orange">Termo pendente</StatusPill>
            </Link>
          ) : null}
          <SituacaoPagamento reserva={reserva} />
        </div>
      </div>

      {ativa ? (
        <PilotosDaReserva
          reservaId={reserva.id}
          total={reserva.pilotos}
          pilotos={pilotos}
          caixaEstaAberto={caixaEstaAberto}
        />
      ) : null}

      {ativa ? (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {saldo > 0 ? (
            caixaEstaAberto ? (
              <details className="min-w-0">
                <summary className="text-orange-ink cursor-pointer text-sm font-medium">
                  Receber pagamento
                </summary>
                <FormAcao
                  action={pagamentoAction}
                  rotulo="Registrar pagamento"
                  className="mt-3 max-w-xs"
                >
                  <input type="hidden" name="reservaId" value={reserva.id} />
                  <Selecao
                    id="forma"
                    rotulo="Forma de pagamento"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Escolha…
                    </option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">Pix</option>
                    <option value="cartao">Cartão</option>
                  </Selecao>
                  <Campo
                    id="valor"
                    rotulo="Valor (R$)"
                    defaultValue={centavosParaCampo(saldo)}
                    inputMode="decimal"
                    dica="Pode receber só uma parte e completar depois."
                  />
                </FormAcao>
              </details>
            ) : (
              <p className="text-ink-3 text-sm">Abra o caixa para receber.</p>
            )
          ) : null}

          <Link
            href={`/admin/operacao/recibo/${reserva.id}`}
            className="text-ink-2 hover:text-orange-ink text-sm"
          >
            Recibo
          </Link>

          <details className="min-w-0">
            <summary className="text-ink-2 cursor-pointer text-sm">
              Cancelar reserva
            </summary>
            <FormAcao
              action={cancelarReservaAction}
              rotulo="Cancelar reserva"
              variante="secondary"
              className="mt-3 max-w-xs"
            >
              <input type="hidden" name="reservaId" value={reserva.id} />
              <Campo
                id="motivo"
                rotulo="Motivo"
                required
                minLength={3}
                dica={
                  reserva.pagoCentavos > 0
                    ? "Há pagamento: peça ao administrador para estornar antes."
                    : undefined
                }
              />
            </FormAcao>
          </details>
        </div>
      ) : null}
    </li>
  );
}

function CartaoBateria({
  slot,
  caixaEstaAberto,
  comTermo,
  podeCronometrar,
  pilotosDasReservas,
}: {
  slot: SlotDoDia;
  caixaEstaAberto: boolean;
  comTermo: Set<string>;
  podeCronometrar: boolean;
  pilotosDasReservas: Map<string, PilotoDaReserva[]>;
}) {
  const vagas = slot.capacidade - slot.ocupadas;
  const ativas = slot.reservas.filter((r) => r.status === "reservada");
  const terminou = slot.inicio.getTime() + slot.duracaoMin * 60_000 < agoraMs();

  return (
    <Card className={clsx(slot.cancelada && "opacity-60")}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-ink font-mono text-lg font-semibold">
            {formatarHora(slot.inicio)}
          </p>
          <p className="text-ink-2 text-xs">
            {slot.duracaoMin} min · {formatarReais(slot.precoCentavos)} por
            piloto
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {slot.cancelada ? (
            <StatusPill tone="neutral">Bateria cancelada</StatusPill>
          ) : terminou ? (
            <StatusPill tone="neutral">Encerrada</StatusPill>
          ) : vagas === 0 ? (
            <StatusPill tone="orange">Lotada</StatusPill>
          ) : (
            <StatusPill tone="ink">
              {vagas} {vagas === 1 ? "vaga" : "vagas"}
            </StatusPill>
          )}
          <span className="text-ink-2 font-mono text-sm">
            {slot.ocupadas}/{slot.capacidade} karts
          </span>
          {!slot.cancelada && !terminou && vagas > 0 ? (
            <ButtonLink href={`/admin/operacao/reservar?slot=${slot.id}`}>
              Reservar
            </ButtonLink>
          ) : null}
          {podeCronometrar && !slot.cancelada && ativas.length > 0 ? (
            <FormAcao
              action={abrirBateriaDaAgendaAction}
              rotulo="Abrir bateria"
              variante="secondary"
              className="w-auto"
            >
              <input type="hidden" name="slotId" value={slot.id} />
            </FormAcao>
          ) : null}
        </div>
      </CardHeader>
      {slot.reservas.length > 0 ? (
        <CardBody>
          <ul>
            {slot.reservas.map((reserva) => (
              <LinhaReserva
                key={reserva.id}
                reserva={reserva}
                caixaEstaAberto={caixaEstaAberto}
                termoValido={comTermo.has(reserva.clienteId)}
                pilotos={pilotosDasReservas.get(reserva.id) ?? []}
              />
            ))}
          </ul>
        </CardBody>
      ) : null}
      {!slot.cancelada && ativas.length === 0 ? (
        <CardBody className="border-border border-t">
          <FormAcao
            action={cancelarBateriaAction}
            rotulo="Cancelar esta bateria"
            variante="ghost"
            className="max-w-xs"
          >
            <input type="hidden" name="slotId" value={slot.id} />
          </FormAcao>
        </CardBody>
      ) : null}
    </Card>
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const sessao = await exigirPermissao("agenda.gerenciar");
  if (!sessao) return <SemPermissao />;
  const podeCronometrar = pode(sessao.papel, "cronometragem.ver");

  const { dia: diaPedido } = await searchParams;
  const hoje = hojeEmSaoPaulo();
  const dia = diaPedido && ehDiaValido(diaPedido) ? diaPedido : hoje;

  const [slots, caixa] = await Promise.all([
    lerAgendaDoDia(dia),
    caixaAberto(),
  ]);
  const reservasAtivas = slots
    .filter((s) => !s.cancelada)
    .flatMap((s) => s.reservas.filter((r) => r.status === "reservada"));
  const comTermo = await clientesComTermoValido([
    ...new Set(reservasAtivas.map((r) => r.clienteId)),
  ]);
  const pilotosDasReservas = await listarPilotosDasReservas(
    reservasAtivas.map((r) => r.id),
  );
  const padroes = await padroesDeAgenda();
  const agora = agoraMs();
  const terminou = (s: SlotDoDia) =>
    s.inicio.getTime() + s.duracaoMin * 60_000 < agora;
  const ativasDe = (s: SlotDoDia) =>
    s.reservas.filter((r) => r.status === "reservada").length;
  const agendadas = slots.filter(
    (s) => !s.cancelada && ativasDe(s) > 0 && !terminou(s),
  );
  const encerradas = slots.filter(
    (s) => !s.cancelada && ativasDe(s) > 0 && terminou(s),
  );
  const livres = slots.filter(
    (s) => !s.cancelada && ativasDe(s) === 0 && !terminou(s),
  );
  const reservado = reservasAtivas.reduce((t, r) => t + r.valorCentavos, 0);
  const recebido = reservasAtivas.reduce((t, r) => t + r.pagoCentavos, 0);
  const pilotos = reservasAtivas.reduce((t, r) => t + r.pilotos, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda de baterias"
        description={`${formatarDiaLongo(dia)}${dia === hoje ? " (hoje)" : ""}`}
        actions={
          <>
            <ButtonLink
              href={`/admin/operacao/agenda?dia=${somarDias(dia, -1)}`}
              variant="secondary"
            >
              ← Dia anterior
            </ButtonLink>
            {dia !== hoje ? (
              <ButtonLink href="/admin/operacao/agenda" variant="secondary">
                Hoje
              </ButtonLink>
            ) : null}
            <ButtonLink
              href={`/admin/operacao/agenda?dia=${somarDias(dia, 1)}`}
              variant="secondary"
            >
              Próximo dia →
            </ButtonLink>
            {podeCronometrar ? (
              <FormAcao
                action={novaBateriaAction}
                rotulo="Bateria agora (sem agendamento)"
                className="w-auto"
              >
                <input type="hidden" name="duasFases" value="1" />
              </FormAcao>
            ) : null}
          </>
        }
      />

      {!caixa ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink text-sm">
              O caixa está fechado — não dá para receber pagamentos.
            </p>
            <Link
              href="/admin/operacao/caixa"
              className="text-orange-ink text-sm font-medium hover:underline"
            >
              Abrir o caixa
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Baterias"
          value={slots.filter((s) => !s.cancelada).length}
        />
        <StatCard label="Pilotos reservados" value={pilotos} />
        <StatCard label="Reservado" value={formatarReais(reservado)} />
        <StatCard
          label="Recebido"
          value={formatarReais(recebido)}
          hint={
            reservado > recebido
              ? `Falta receber ${formatarReais(reservado - recebido)}`
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-ink text-sm font-semibold">
            Agendar uma bateria
          </h2>
          <p className="text-ink-3 mt-1 text-xs">
            Escolha o dia e a hora e informe quem reservou. O horário é criado
            na hora; os demais pilotos você cadastra depois, na própria reserva.
          </p>
        </CardHeader>
        <CardBody>
          <FormAcao action={agendarBateriaAction} rotulo="Agendar">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Campo
                id="dia"
                rotulo="Dia"
                type="date"
                defaultValue={dia}
                required
              />
              <Campo id="hora" rotulo="Hora" type="time" required />
              <Campo
                id="nome"
                rotulo="Quem reservou"
                placeholder="Nome completo"
                required
                minLength={2}
                className="col-span-2 sm:col-span-1"
              />
              <Campo
                id="telefone"
                rotulo="Telefone (WhatsApp)"
                inputMode="tel"
                placeholder="(11) 99999-0000"
                required
                className="col-span-2 sm:col-span-1"
              />
              <Campo
                id="pilotos"
                rotulo="Pilotos"
                type="number"
                min={1}
                max={60}
                defaultValue={1}
                required
              />
              {padroes.precoCentavos === null ? (
                <Campo
                  id="preco"
                  rotulo="Preço por piloto (R$)"
                  inputMode="decimal"
                  defaultValue="80,00"
                  required
                />
              ) : null}
            </div>
            {padroes.precoCentavos !== null ? (
              <p className="text-ink-3 text-xs">
                {formatarReais(padroes.precoCentavos)} por piloto ·{" "}
                {padroes.duracaoMin} min · até {padroes.capacidade} karts por
                bateria (os mesmos da última bateria criada).
              </p>
            ) : null}
          </FormAcao>
        </CardBody>
      </Card>

      {agendadas.length === 0 ? (
        <p className="text-ink-2 text-sm">
          Nenhuma bateria agendada para {dia === hoje ? "hoje" : "este dia"}
          {encerradas.length > 0 ? " (as já encerradas estão abaixo)" : ""}. Use
          “Agendar uma bateria” acima ou “Bateria agora”.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {agendadas.map((slot) => (
            <CartaoBateria
              key={slot.id}
              slot={slot}
              caixaEstaAberto={Boolean(caixa)}
              comTermo={comTermo}
              pilotosDasReservas={pilotosDasReservas}
              podeCronometrar={podeCronometrar}
            />
          ))}
        </div>
      )}

      {encerradas.length > 0 ? (
        <details className="border-border bg-surface rounded-lg border">
          <summary className="text-ink cursor-pointer px-5 py-4 text-sm font-medium">
            Já encerradas ({encerradas.length})
          </summary>
          <div className="border-border flex flex-col gap-4 border-t p-4">
            {encerradas.map((slot) => (
              <CartaoBateria
                key={slot.id}
                slot={slot}
                caixaEstaAberto={Boolean(caixa)}
                comTermo={comTermo}
                pilotosDasReservas={pilotosDasReservas}
                podeCronometrar={podeCronometrar}
              />
            ))}
          </div>
        </details>
      ) : null}

      {livres.length > 0 ? (
        <details className="border-border bg-surface rounded-lg border">
          <summary className="text-ink cursor-pointer px-5 py-4 text-sm font-medium">
            Horários livres ({livres.length})
          </summary>
          <div className="border-border flex flex-col gap-4 border-t p-4">
            {livres.map((slot) => (
              <CartaoBateria
                key={slot.id}
                slot={slot}
                caixaEstaAberto={Boolean(caixa)}
                comTermo={comTermo}
                pilotosDasReservas={pilotosDasReservas}
                podeCronometrar={podeCronometrar}
              />
            ))}
          </div>
        </details>
      ) : null}

      <details className="border-border bg-surface rounded-lg border">
        <summary className="text-ink cursor-pointer px-5 py-4 text-sm font-medium">
          Gerar vários horários de uma vez (opcional)
        </summary>
        <div className="border-border border-t px-5 py-4">
          <FormAcao
            action={gerarGradeAction}
            rotulo="Gerar baterias"
            limpar={false}
            className="max-w-2xl"
          >
            <input type="hidden" name="dia" value={dia} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Campo
                id="primeiraHora"
                rotulo="Primeira bateria"
                type="time"
                defaultValue="10:00"
                required
              />
              <Campo
                id="ultimaHora"
                rotulo="Última bateria"
                type="time"
                defaultValue="22:00"
                required
              />
              <Campo
                id="intervaloMin"
                rotulo="A cada (min)"
                type="number"
                defaultValue={20}
                min={5}
                max={240}
                required
              />
              <Campo
                id="duracaoMin"
                rotulo="Duração (min)"
                type="number"
                defaultValue={15}
                min={1}
                max={120}
                required
              />
              <Campo
                id="capacidade"
                rotulo="Karts por bateria"
                type="number"
                defaultValue={12}
                min={1}
                max={60}
                required
              />
              <Campo
                id="preco"
                rotulo="Preço por piloto (R$)"
                defaultValue="80,00"
                inputMode="decimal"
                required
              />
            </div>
            <p className="text-ink-3 text-xs">
              Só serve para abrir horários a reservas feitas pelo site. Horários
              que já existem neste dia são mantidos como estão.
            </p>
          </FormAcao>
        </div>
      </details>

      {slots.length === 0 ? (
        <p className="text-ink-2 text-sm">
          Nenhuma bateria neste dia. Gere a grade acima para começar a agendar.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {slots.map((slot) => (
            <CartaoBateria
              key={slot.id}
              slot={slot}
              caixaEstaAberto={Boolean(caixa)}
              comTermo={comTermo}
              pilotosDasReservas={pilotosDasReservas}
              podeCronometrar={podeCronometrar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
