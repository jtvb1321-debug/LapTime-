import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { PendenciasDaPista } from "@/components/cronometragem/pendencias-da-pista";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  abrirBateriaDaAgendaAction,
  novaBateriaAction,
} from "@/lib/corrida-actions";
import { lerPainel } from "@/lib/cronometragem/corridas-store";
import {
  bateriaEmFoco,
  dadosDoPainel,
  passosDoFluxo,
  type Passo,
} from "@/lib/cronometragem/passo-a-passo";
import { ESTADO_CORRIDA } from "@/lib/cronometragem/rotulos";
import { lerAgendaDoDia } from "@/lib/operacao/agenda-store";
import {
  agoraMs,
  formatarHora,
  formatarReais,
  hojeEmSaoPaulo,
} from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Visão do dia" };
export const dynamic = "force-dynamic";

const COMO_FUNCIONA = [
  [
    "O cliente entra em contato",
    "Em Agenda, use “Agendar uma bateria”: dia, hora, quem reservou, telefone e quantos pilotos.",
  ],
  [
    "Cadastrar os pilotos",
    "Na reserva, “Cadastrar piloto” (nome e telefone). Cada um recebe um número de cadastro. Pode ser antes ou na chegada.",
  ],
  [
    "Receber o pagamento",
    "Com o caixa aberto, “Receber” no piloto ou na reserva (dinheiro, Pix ou cartão). Aparece ao lado do nome.",
  ],
  [
    "Chegada: abrir a bateria",
    "Na agenda, “Abrir bateria”. Os pilotos da reserva já entram com o nome.",
  ],
  [
    "Termo de responsabilidade",
    "“Enviar termos”: cada piloto abre o link ou lê o QR no celular e assina. Sem o termo, não larga.",
  ],
  [
    "Sorteio dos karts",
    "“Sortear karts”: cada piloto recebe um kart e, com ele, o sensor que já está no kart. Termo + kart = apto.",
  ],
  [
    "Classificação",
    "Com todos aptos, inicie a classificação. Os sensores são lidos desde a largada. Ao fim, finalize.",
  ],
  [
    "Corrida",
    "“Criar a corrida”: larga na ordem da melhor volta da classificação. Inicie e acompanhe ao vivo.",
  ],
  [
    "Resultados",
    "Ao terminar, abra, imprima ou baixe os PDFs (qualificação, volta a volta, resultado final).",
  ],
] as const;

function Marca({ situacao }: { situacao: Passo["situacao"] }) {
  const base =
    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold";
  if (situacao === "feito") {
    return (
      <span aria-label="feito" className={clsx(base, "bg-ink text-bg")}>
        ✓
      </span>
    );
  }
  if (situacao === "agora") {
    return (
      <span
        aria-label="agora"
        className={clsx(base, "bg-orange text-on-orange")}
      >
        ▶
      </span>
    );
  }
  return (
    <span
      aria-label={situacao === "opcional" ? "opcional" : "pendente"}
      className={clsx(
        base,
        "border-border-strong text-ink-3 border",
        situacao === "opcional" && "border-dashed",
      )}
    >
      ·
    </span>
  );
}

export default async function BalcaoPage() {
  const sessao =
    (await exigirPermissao("cronometragem.ver")) ??
    (await exigirPermissao("agenda.gerenciar"));
  if (!sessao) return <SemPermissao />;
  const podeVerPista = pode(sessao.papel, "cronometragem.ver");
  const podeOperar = pode(sessao.papel, "sessao.operar");
  const podeAgenda = pode(sessao.papel, "agenda.gerenciar");

  const hoje = hojeEmSaoPaulo();
  const [focoId, agenda] = await Promise.all([
    podeVerPista ? bateriaEmFoco() : Promise.resolve(null),
    podeAgenda ? lerAgendaDoDia(hoje) : Promise.resolve([]),
  ]);
  const painel = focoId ? await lerPainel(focoId) : null;
  const fluxo = painel ? passosDoFluxo(dadosDoPainel(painel)) : null;

  const agora = agoraMs();
  const naAgenda = agenda
    .filter(
      (s) =>
        !s.cancelada &&
        s.reservas.some((r) => r.status === "reservada") &&
        s.inicio.getTime() + s.duracaoMin * 60_000 >= agora,
    )
    .slice(0, 8);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <AtualizacaoPeriodica intervaloMs={5000} />
      <PageHeader
        title="Visão do dia"
        description="O que fazer agora: a bateria em andamento, quem falta liberar e as próximas da agenda."
        actions={
          <>
            {podeAgenda ? (
              <ButtonLink href="/admin/operacao/agenda">
                Agendar uma bateria
              </ButtonLink>
            ) : null}
            {podeOperar ? (
              <FormAcao
                action={novaBateriaAction}
                rotulo="Bateria agora (sem agendamento)"
                variante="secondary"
                className="w-auto"
              >
                <input type="hidden" name="duasFases" value="1" />
              </FormAcao>
            ) : null}
          </>
        }
      />

      {painel && fluxo ? (
        <>
          {fluxo.proximo ? (
            <Card className="bg-graphite! border-graphite! border-l-orange! border-l-4">
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-orange text-xs font-semibold tracking-wide uppercase">
                    Próximo passo
                  </p>
                  <p className="font-display text-2xl leading-tight font-bold text-white">
                    {fluxo.proximo.titulo}
                  </p>
                  <p className="text-sm text-white/80">
                    {fluxo.proximo.detalhe}
                  </p>
                </div>
                {fluxo.proximo.href && fluxo.proximo.acao ? (
                  <ButtonLink href={fluxo.proximo.href}>
                    {fluxo.proximo.acao}
                  </ButtonLink>
                ) : null}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <p className="text-ink text-sm font-medium">
                  Tudo feito nesta bateria. Para a próxima, agende ou use
                  “Bateria agora”.
                </p>
              </CardBody>
            </Card>
          )}

          {/* Sem pilotos, o "Próximo passo" e a lista da bateria já dizem isso. */}
          {painel.grid.length > 0 ? (
            <PendenciasDaPista
              grid={painel.grid}
              href={`/admin/cronometragem/corridas/${painel.corrida.id}`}
            />
          ) : null}

          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-ink-3 text-xs">
                  Bateria avulsa em foco (balcão)
                </p>
                <h2 className="text-ink text-base font-semibold">
                  {painel.corrida.nome}
                </h2>
              </div>
              <StatusPill tone={ESTADO_CORRIDA[painel.corrida.estado].tom}>
                {ESTADO_CORRIDA[painel.corrida.estado].rotulo}
              </StatusPill>
            </CardHeader>
            <CardBody>
              <ol className="flex flex-col gap-3">
                {fluxo.passos.map((p) => (
                  <li key={p.chave} className={clsx("flex items-start gap-3")}>
                    <Marca situacao={p.situacao} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={clsx(
                          "text-sm font-medium",
                          p.situacao === "feito" || p.situacao === "pendente"
                            ? "text-ink-2"
                            : "text-ink",
                        )}
                      >
                        {p.titulo}
                        {p.situacao === "opcional" ? (
                          <span className="text-ink-3 text-xs">
                            {" "}
                            · opcional
                          </span>
                        ) : null}
                      </p>
                      <p className="text-ink-3 text-xs">{p.detalhe}</p>
                    </div>
                    {p.href && p.acao && p.situacao !== "pendente" ? (
                      <Link
                        href={p.href}
                        className="text-orange-ink shrink-0 text-sm font-medium hover:underline"
                      >
                        {p.acao}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <p className="text-ink text-base font-semibold">
              Nenhuma bateria em andamento
            </p>
            <p className="text-ink-2 text-sm">
              Cliente entrou em contato? Use “Agendar uma bateria”. Cliente
              chegou sem reserva? Use “Bateria agora”. Se há reserva para hoje,
              ela aparece abaixo: clique em “Abrir bateria” quando eles
              chegarem.
            </p>
          </CardBody>
        </Card>
      )}

      {podeAgenda ? (
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <h2 className="text-ink text-sm font-semibold">
              Próximas baterias de hoje
            </h2>
            <Link
              href="/admin/operacao/agenda"
              className="text-orange-ink inline-flex min-h-11 items-center text-sm font-medium hover:underline md:min-h-0"
            >
              Abrir a agenda
            </Link>
          </CardHeader>
          <CardBody>
            {naAgenda.length === 0 ? (
              <p className="text-ink-3 text-sm">
                Nenhuma bateria agendada para o resto de hoje.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {naAgenda.map((s) => {
                  const ativas = s.reservas.filter(
                    (r) => r.status === "reservada",
                  );
                  const valor = ativas.reduce((t, r) => t + r.valorCentavos, 0);
                  const pago = ativas.reduce((t, r) => t + r.pagoCentavos, 0);
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm">
                          <span className="font-display text-base font-bold">
                            {formatarHora(s.inicio)}
                          </span>{" "}
                          · {ativas.map((r) => r.clienteNome).join(", ")}
                        </p>
                        <p className="text-ink-3 text-xs">
                          {ativas.reduce((t, r) => t + r.pilotos, 0)} piloto(s)
                          · {formatarReais(pago)} de {formatarReais(valor)}{" "}
                          recebidos
                        </p>
                      </div>
                      {podeOperar ? (
                        <FormAcao
                          action={abrirBateriaDaAgendaAction}
                          rotulo="Abrir bateria"
                          variante="secondary"
                          className="w-auto"
                        >
                          <input type="hidden" name="slotId" value={s.id} />
                        </FormAcao>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}

      <details className="border-border bg-surface rounded-lg border">
        <summary className="text-ink cursor-pointer px-5 py-4 text-sm font-semibold">
          Como funciona (resumo para quem está começando)
        </summary>
        <ol className="border-border text-ink-2 flex list-decimal flex-col gap-3 border-t px-5 py-4 pl-9 text-sm">
          {COMO_FUNCIONA.map(([titulo, texto]) => (
            <li key={titulo}>
              <span className="text-ink font-medium">{titulo}.</span> {texto}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
