import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { BotaoImprimir } from "@/components/cronometragem/botao-imprimir";
import { Contador } from "@/components/cronometragem/contador";
import {
  GradeDePassagens,
  Legenda,
  TabelaDoPainel,
} from "@/components/cronometragem/painel-ao-vivo";
import { FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  encerrarAgoraAction,
  finalizarCorridaAction,
  iniciarCorridaAction,
} from "@/lib/corrida-actions";
import { lerModeloDeVinculo } from "@/lib/cronometragem/cadastros-store";
import { lerPainel } from "@/lib/cronometragem/corridas-store";
import {
  criterioDaSessao,
  lerConfigDeClassificacao,
  painelDaSessao,
} from "@/lib/cronometragem/classificacao-oficial";
import { ESTADO_CORRIDA } from "@/lib/cronometragem/rotulos";
import {
  formatarDuracao,
  formatarTempoVolta,
} from "@/lib/cronometragem/voltas";
import { formatarDataHora } from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Painel de cronometragem" };
export const dynamic = "force-dynamic";

const NOME_DA_FASE = {
  unica: "Bateria",
  classificacao: "Classificação (melhor volta)",
  corrida: "Corrida",
} as const;

// Painel de cronometragem: a bateria numa tela só, com o resultado, a grade de
// passagens e os dados da prova. Os controles e as regras são os da própria
// bateria; esta tela só reúne e organiza o que o sistema já registra.
export default async function PainelDeCronometragemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeIniciar = pode(sessao.papel, "prova.iniciar_encerrar");

  const { id } = await params;
  const painel = await lerPainel(id);
  if (!painel) notFound();
  const { corrida, classificacao, historico, agoraMs, prazoMs } = painel;
  const modelo = await lerModeloDeVinculo();

  const estado = ESTADO_CORRIDA[corrida.estado];
  const aoVivo =
    corrida.estado === "em_andamento" || corrida.estado === "encerrando";
  const encerrada = corrida.estado === "finalizada";
  const ehQuali = corrida.fase === "classificacao";
  // Fonte única da sessão (camada compartilhada); no critério atual, idêntico a antes.
  const criterio = criterioDaSessao(corrida, lerConfigDeClassificacao());
  const { linhas, melhor } = painelDaSessao(classificacao, ehQuali, criterio);
  const fim = corrida.encerradaEm ?? corrida.canceladaEm;
  const decorridoMs = corrida.iniciadaEm
    ? (fim?.getTime() ?? agoraMs) - corrida.iniciadaEm.getTime()
    : 0;
  const oculto = <input type="hidden" name="corridaId" value={corrida.id} />;
  const podeComecar =
    podeIniciar &&
    (corrida.estado === "pronta" ||
      (corrida.estado === "preparada" && modelo === "kart"));

  return (
    <div className="flex flex-col gap-4">
      {aoVivo ? <AtualizacaoPeriodica intervaloMs={2000} /> : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-ink-3 text-xs tracking-wide uppercase">
            {NOME_DA_FASE[corrida.fase]}
          </p>
          <h1 className="text-ink text-xl font-semibold">{corrida.nome}</h1>
          <p className="text-ink-2 mt-1 text-sm">
            {corrida.iniciadaEm
              ? `Iniciada em ${formatarDataHora(corrida.iniciadaEm)}`
              : "Ainda não iniciada"}
            {fim ? ` · encerrada em ${formatarDataHora(fim)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <StatusPill tone={estado.tom}>{estado.rotulo}</StatusPill>
          {aoVivo ? (
            <span className="text-ink-3 text-xs">atualiza sozinho</span>
          ) : null}
          <Link
            href={`/admin/cronometragem/corridas/${corrida.id}`}
            className="text-ink-2 min-h-11 content-center text-sm hover:underline"
          >
            ← Pilotos e controles da bateria
          </Link>
          <Link
            href="/tv"
            className="text-ink-2 min-h-11 content-center text-sm hover:underline"
          >
            Tela de TV
          </Link>
          <BotaoImprimir />
        </div>
      </header>

      {encerrada ? (
        <p
          role="status"
          className="bg-ink rounded-lg py-2 text-center text-sm font-semibold tracking-widest text-white uppercase"
        >
          Prova encerrada
        </p>
      ) : null}

      {podeComecar || (aoVivo && podeIniciar) ? (
        <div className="flex flex-wrap items-start gap-3 print:hidden">
          {podeComecar ? (
            <FormAcao
              action={iniciarCorridaAction}
              rotulo={ehQuali ? "Iniciar classificação" : "Iniciar a bateria"}
            >
              {oculto}
            </FormAcao>
          ) : null}
          {corrida.estado === "em_andamento" && !ehQuali ? (
            <FormAcao
              action={encerrarAgoraAction}
              rotulo="Dar bandeira (encerrar agora)"
              variante="secondary"
            >
              {oculto}
            </FormAcao>
          ) : null}
          {aoVivo ? (
            <FormAcao
              action={finalizarCorridaAction}
              confirmar={
                ehQuali
                  ? "Encerrar a classificação agora? Os pilotos param de pontuar voltas."
                  : "Finalizar a bateria? Depois disso o resultado é fechado."
              }
              rotulo={
                ehQuali ? "Encerrar a classificação agora" : "Finalizar bateria"
              }
              variante="secondary"
            >
              {oculto}
            </FormAcao>
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Indicador rotulo="Tempo restante">
          {aoVivo && prazoMs !== null && corrida.estado === "em_andamento" ? (
            <Contador
              modo="regressivo"
              referenciaMs={prazoMs}
              agoraServidorMs={agoraMs}
            />
          ) : encerrada ? (
            "00:00"
          ) : (
            "—"
          )}
        </Indicador>
        <Indicador rotulo="Tempo decorrido">
          {aoVivo && corrida.iniciadaEm ? (
            <Contador
              modo="progressivo"
              referenciaMs={corrida.iniciadaEm.getTime()}
              agoraServidorMs={agoraMs}
            />
          ) : corrida.iniciadaEm ? (
            formatarDuracao(decorridoMs)
          ) : (
            "—"
          )}
        </Indicador>
        <Indicador rotulo="Tempo mínimo de volta">
          {formatarDuracao(corrida.tempoMinimoMs)}
        </Indicador>
        <Indicador rotulo="Passagens">{painel.totalPassagens}</Indicador>
        <Indicador rotulo="Melhor volta" destaque>
          {melhor ? formatarTempoVolta(melhor.ms) : "—"}
          {melhor ? (
            <span className="text-ink-2 mt-1 block text-xs font-normal">
              {melhor.linha.kartNumero
                ? `Kart ${melhor.linha.kartNumero} · `
                : ""}
              {melhor.linha.nome}
              {melhor.numero ? ` · volta ${melhor.numero}` : ""}
            </span>
          ) : null}
        </Indicador>
      </dl>

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="titulo-resultado"
          className="flex flex-col gap-2"
        >
          <h2 id="titulo-resultado" className="text-ink text-sm font-semibold">
            {encerrada
              ? "Resultado oficial"
              : ehQuali
                ? "Classificação pela melhor volta"
                : "Classificação ao vivo"}
          </h2>
          <TabelaDoPainel linhas={linhas} corrida={!ehQuali} />
        </section>
        <div className="print:hidden">
          <GradeDePassagens passagens={historico} />
        </div>
      </div>

      <Legenda corrida={!ehQuali} />
    </div>
  );
}

function Indicador({
  rotulo,
  destaque = false,
  children,
}: {
  rotulo: string;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        destaque
          ? "bg-success-bg border-success/30 rounded-lg border px-4 py-3"
          : "border-border bg-surface rounded-lg border px-4 py-3"
      }
    >
      <dt className="text-ink-3 text-xs">{rotulo}</dt>
      <dd className="text-ink mt-1 font-display text-2xl font-semibold tabular-nums">
        {children}
      </dd>
    </div>
  );
}
