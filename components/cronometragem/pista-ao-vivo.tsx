import Link from "next/link";
import type { ReactNode } from "react";
import { Contador } from "@/components/cronometragem/contador";
import { ComparacaoDeClassificacao } from "@/components/cronometragem/comparacao-de-classificacao";
import { AtualizacaoAoVivo } from "@/components/cronometragem/atualizacao-ao-vivo";
import type { PainelDaCorrida } from "@/lib/cronometragem/corridas-store";
import type { Decoder } from "@/lib/cronometragem/decoders-store";
import { mostrarComparacao } from "@/lib/cronometragem/comparacao-visual";
import {
  criterioDaSessao,
  lerConfigDeClassificacao,
  ROTULO_DO_CRITERIO,
  type CriterioDaSessao,
} from "@/lib/cronometragem/classificacao-oficial";
import type { Faixa } from "@/lib/cronometragem/painel-visual";
import {
  atencaoDaSessao,
  bandeiraDaSessao,
  comunicacaoDaPista,
  dadosPodemEstarDefasados,
  formatarIdade,
  kartsSemPiloto,
  linhasDaTorreDaSessao,
  melhorDaProva,
  sinalDoKart,
  ultimasVoltas,
  type EstadoDoSinal,
  type LinhaDaTorre,
  type TomDaBandeira,
} from "@/lib/cronometragem/pista-visual";
import { SITUACAO } from "@/lib/cronometragem/rotulos";
import {
  formatarHoraComMs,
  formatarTempoVolta,
} from "@/lib/cronometragem/voltas";

// Cronometragem ao vivo (pit wall). Só APRESENTAÇÃO: tudo vem pronto de `lerPainel` e
// da lista de decoders que a página já lê. Os comandos (bandeira, finalizar,
// ocorrências) NÃO nascem aqui: quem usa este componente decide o que passa em
// `controles`. A tela "Ao vivo" não passa nada e só oferece o link para a bateria.

const COR_DA_BANDEIRA: Record<TomDaBandeira, string> = {
  verde: "var(--pw-verde)",
  ambar: "var(--pw-ambar)",
  quadriculada: "var(--pw-ink)",
  neutra: "var(--pw-dim)",
};

const COR_DA_FAIXA: Record<Faixa, string> = {
  mesma: "var(--pw-verde)",
  ate2: "var(--pw-ambar)",
  ate5: "var(--pw-vermelho)",
  mais5: "var(--pw-ink)",
};
const TEXTO_DA_FAIXA: Record<Faixa, string> = {
  mesma: "Na mesma volta do líder",
  ate2: "Até 2 voltas atrás do líder",
  ate5: "Até 5 voltas atrás do líder",
  mais5: "Mais de 5 voltas atrás do líder",
};

const COR_DO_SINAL: Record<EstadoDoSinal, string> = {
  recente: "var(--pw-verde)",
  antiga: "var(--pw-dim)",
  "sem-passagem": "var(--pw-dim)",
  "sem-sensor": "var(--pw-ambar)",
};
const SIMBOLO_DO_SINAL: Record<EstadoDoSinal, string> = {
  recente: "●",
  antiga: "○",
  "sem-passagem": "–",
  "sem-sensor": "!",
};

const NOME_DA_FASE = {
  classificacao: "Classificação",
  corrida: "Corrida",
  unica: "Bateria",
} as const;

function Cabecalho({
  painel,
  linkBateria,
  intervaloMs,
  melhor,
  totalVoltas,
}: {
  painel: PainelDaCorrida;
  linkBateria?: string;
  intervaloMs: number;
  melhor: ReturnType<typeof melhorDaProva>;
  totalVoltas: number;
}) {
  const { corrida } = painel;
  const bandeira = bandeiraDaSessao(corrida.estado);
  const cor = COR_DA_BANDEIRA[bandeira.tom];
  const emAndamento = corrida.estado === "em_andamento";
  return (
    <header className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p
          className="text-xs font-semibold tracking-[0.18em] uppercase"
          style={{ color: "var(--pw-laranja)" }}
        >
          {NOME_DA_FASE[corrida.fase]}
          {corrida.duracaoMin ? ` · ${corrida.duracaoMin} min` : ""}
        </p>
        <h2 className="mt-1 truncate text-xl font-semibold md:text-2xl">
          {corrida.nome}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            data-bandeira={bandeira.tom}
            className="inline-flex items-center gap-2 rounded-sm border px-3 py-1 text-xs font-bold tracking-wider uppercase"
            style={{ color: cor, borderColor: cor }}
          >
            <span
              aria-hidden="true"
              className="inline-block size-2.5"
              style={{
                background:
                  bandeira.tom === "quadriculada"
                    ? "repeating-conic-gradient(#eceef2 0 25%, #14171d 0 50%) 0 0 / 6px 6px"
                    : cor,
              }}
            />
            {bandeira.rotulo}
          </span>
          {linkBateria ? (
            <Link
              href={linkBateria}
              className="inline-flex min-h-11 items-center text-sm font-semibold underline md:min-h-0"
              style={{ color: "var(--pw-ink)" }}
            >
              Abrir a bateria
            </Link>
          ) : null}
        </div>
        <div className="mt-2">
          <AtualizacaoAoVivo
            agoraServidorMs={painel.agoraMs}
            intervaloMs={intervaloMs}
          />
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-7 gap-y-3 lg:justify-end">
        <div>
          <dt
            className="text-[10px] tracking-[0.14em] uppercase"
            style={{ color: "var(--pw-dim)" }}
          >
            {emAndamento && painel.prazoMs !== null
              ? "Tempo restante"
              : "Tempo"}
          </dt>
          <dd className="font-display text-4xl leading-none font-bold md:text-5xl">
            {emAndamento && corrida.iniciadaEm ? (
              painel.prazoMs !== null ? (
                <Contador
                  modo="regressivo"
                  referenciaMs={painel.prazoMs}
                  agoraServidorMs={painel.agoraMs}
                />
              ) : (
                <Contador
                  modo="progressivo"
                  referenciaMs={corrida.iniciadaEm.getTime()}
                  agoraServidorMs={painel.agoraMs}
                />
              )
            ) : corrida.estado === "encerrando" ? (
              "00:00"
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt
            className="text-[10px] tracking-[0.14em] uppercase"
            style={{ color: "var(--pw-dim)" }}
          >
            Voltas concluídas
          </dt>
          <dd className="font-display text-2xl font-bold">{totalVoltas}</dd>
        </div>
        <div>
          <dt
            className="text-[10px] tracking-[0.14em] uppercase"
            style={{ color: "var(--pw-dim)" }}
          >
            Melhor volta
          </dt>
          <dd
            className="font-display text-2xl font-bold"
            style={{ color: "var(--pw-roxo)" }}
          >
            {melhor ? formatarTempoVolta(melhor.ms) : "—"}
          </dd>
          {melhor ? (
            <dd className="text-[11px]" style={{ color: "var(--pw-dim)" }}>
              Kart {melhor.linha.kartNumero ?? "—"} · {melhor.linha.nome}
            </dd>
          ) : null}
        </div>
        <div>
          <dt
            className="text-[10px] tracking-[0.14em] uppercase"
            style={{ color: "var(--pw-dim)" }}
          >
            Leituras
          </dt>
          <dd className="font-display text-2xl font-bold">
            {painel.totalPassagens}
          </dd>
        </div>
      </dl>
    </header>
  );
}

function Torre({
  painel,
  linhas,
  hrefNomes,
  criterio,
}: {
  painel: PainelDaCorrida;
  linhas: LinhaDaTorre[];
  hrefNomes: string;
  criterio: CriterioDaSessao;
}) {
  const ehQuali = painel.corrida.fase === "classificacao";
  const semNome = new Set(
    painel.grid.filter((p) => !p.nomeado).map((p) => p.id),
  );
  return (
    <section aria-labelledby="pw-torre" className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <h3
          id="pw-torre"
          className="text-sm font-semibold tracking-wide uppercase"
        >
          Classificação ao vivo
        </h3>
        <p className="text-xs" style={{ color: "var(--pw-dim)" }}>
          {ROTULO_DO_CRITERIO[criterio]}
        </p>
      </div>
      {linhas.length === 0 ? (
        <p className="px-5 pb-5 text-sm" style={{ color: "var(--pw-dim)" }}>
          Nenhum piloto no grid ainda. Os karts entram sozinhos quando passam
          pelo sensor depois da largada.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 text-left text-sm">
            <thead>
              <tr
                className="text-[10px] tracking-[0.12em] uppercase"
                style={{ color: "var(--pw-dim)" }}
              >
                <th scope="col" className="px-2 py-2 font-medium sm:px-3">
                  Pos
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Kart
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Piloto
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Voltas
                </th>
                <th
                  scope="col"
                  className="hidden px-2 py-2 text-right font-medium md:table-cell"
                >
                  Última
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Melhor
                </th>
                <th
                  scope="col"
                  className="hidden px-2 py-2 text-right font-medium sm:table-cell"
                >
                  Dif. líder
                </th>
                <th
                  scope="col"
                  className="hidden px-2 py-2 text-right font-medium md:table-cell"
                >
                  Dif. anterior
                </th>
                <th
                  scope="col"
                  className="hidden px-2 py-2 font-medium lg:table-cell"
                >
                  Últimas voltas
                </th>
                <th
                  scope="col"
                  className="hidden px-3 py-2 font-medium 2xl:table-cell"
                >
                  Situação
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const x = l.linha;
                const barras = ultimasVoltas(x);
                return (
                  <tr
                    key={x.participanteId}
                    data-posicao={l.pos ?? ""}
                    data-kart={x.kartNumero ?? ""}
                    className="border-t"
                    style={{
                      borderColor: "var(--pw-line)",
                      background:
                        l.pos === 1 ? "rgba(255,90,0,0.08)" : undefined,
                      opacity: l.naoCompletou ? 0.6 : 1,
                    }}
                  >
                    <td className="font-display px-3 py-2.5 text-lg font-extrabold whitespace-nowrap">
                      {!ehQuali && l.faixa ? (
                        <span
                          role="img"
                          aria-label={TEXTO_DA_FAIXA[l.faixa]}
                          title={TEXTO_DA_FAIXA[l.faixa]}
                          className="mr-1.5 inline-block size-2 rounded-full"
                          style={{ background: COR_DA_FAIXA[l.faixa] }}
                        />
                      ) : null}
                      {l.pos ?? "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className="pw-placa"
                        data-estado={x.kartNumero ? "em-uso" : "vazio"}
                      >
                        {x.kartNumero ?? "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-semibold">
                      <span className="block max-w-[7.5rem] truncate sm:max-w-[11rem] md:max-w-none">
                        {x.nome}
                      </span>
                      {l.paraLider !== "—" ? (
                        <span
                          className="font-display text-[11px] font-normal sm:hidden"
                          style={{ color: "var(--pw-dim)" }}
                        >
                          dif. {l.paraLider}
                        </span>
                      ) : null}
                      {semNome.has(x.participanteId) ? (
                        <a
                          href={hrefNomes}
                          className="text-[11px] font-medium underline"
                          style={{ color: "var(--pw-ambar)" }}
                        >
                          sem nome: dar nome
                        </a>
                      ) : null}
                    </td>
                    <td className="font-display px-2 py-2.5 text-right text-[0.95rem] font-semibold">
                      {x.voltas}
                    </td>
                    <td className="font-display hidden px-2 py-2.5 text-right text-[0.95rem] font-semibold md:table-cell">
                      {x.ultimaVoltaMs !== null
                        ? formatarTempoVolta(x.ultimaVoltaMs)
                        : "—"}
                    </td>
                    <td
                      className="font-display px-2 py-2.5 text-right text-[0.95rem] font-semibold"
                      style={
                        l.temMelhorGeral
                          ? { color: "var(--pw-roxo)", fontWeight: 700 }
                          : undefined
                      }
                    >
                      {x.melhorVoltaMs !== null
                        ? formatarTempoVolta(x.melhorVoltaMs)
                        : "—"}
                    </td>
                    <td
                      className="font-display hidden px-2 py-2.5 text-right text-sm font-semibold sm:table-cell"
                      style={{ color: "var(--pw-dim)" }}
                    >
                      {l.paraLider}
                    </td>
                    <td
                      className="font-display hidden px-2 py-2.5 text-right text-sm font-semibold md:table-cell"
                      style={{ color: "var(--pw-dim)" }}
                    >
                      {l.paraAnterior}
                    </td>
                    <td className="hidden px-2 py-2.5 lg:table-cell">
                      <span
                        className="inline-flex h-6 items-end gap-0.5"
                        role="img"
                        aria-label={
                          barras.length
                            ? `Últimas voltas: ${barras.map((b) => formatarTempoVolta(b.ms)).join(", ")}`
                            : "Sem voltas ainda"
                        }
                      >
                        {barras.map((b) => (
                          <i
                            key={b.numero}
                            className="block w-1.5"
                            style={{
                              height: `${Math.round(b.altura * 100)}%`,
                              background: b.melhor
                                ? "var(--pw-roxo)"
                                : "var(--pw-azul)",
                              opacity: b.melhor ? 1 : 0.75,
                            }}
                          />
                        ))}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 2xl:table-cell">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px]"
                        style={{
                          background: "var(--pw-panel)",
                          color: "var(--pw-dim)",
                        }}
                      >
                        {SITUACAO[x.situacao]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SemPiloto({
  painel,
  hrefNomes,
}: {
  painel: PainelDaCorrida;
  hrefNomes: string;
}) {
  const sem = kartsSemPiloto(painel.grid);
  if (sem.length === 0) return null;
  return (
    <section aria-labelledby="pw-sempiloto" data-karts-sem-piloto={sem.length}>
      <h3
        id="pw-sempiloto"
        className="text-sm font-semibold tracking-wide uppercase"
        style={{ color: "var(--pw-ambar)" }}
      >
        Karts sem piloto identificado
      </h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {sem.map((p) => (
          <li key={p.id}>
            <span className="pw-placa" data-estado="em-uso">
              {p.kartNumero ?? "—"}
            </span>
          </li>
        ))}
      </ul>
      <a
        href={hrefNomes}
        className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline md:min-h-0"
        style={{ color: "var(--pw-ink)" }}
      >
        Dar nome {sem.length === 1 ? "ao kart" : "aos karts"}
      </a>
    </section>
  );
}

function Equipamentos({
  painel,
  decoders,
}: {
  painel: PainelDaCorrida;
  decoders: Decoder[];
}) {
  const com = comunicacaoDaPista(decoders);
  const cor =
    com.estado === "ok"
      ? "var(--pw-verde)"
      : com.estado === "falha-confirmada"
        ? "var(--pw-vermelho)"
        : "var(--pw-ambar)";
  const karts = painel.classificacao;
  return (
    <section aria-labelledby="pw-equip">
      <h3
        id="pw-equip"
        className="text-sm font-semibold tracking-wide uppercase"
      >
        Equipamentos
      </h3>
      <p className="mt-2 text-sm" data-comunicacao={com.estado}>
        <span aria-hidden="true" style={{ color: cor }}>
          ●{" "}
        </span>
        <b style={{ color: cor }}>{com.titulo}</b>
        <span style={{ color: "var(--pw-dim)" }}> · {com.detalhe}</span>
      </p>
      {com.ultimoSinal ? (
        <p className="text-xs" style={{ color: "var(--pw-dim)" }}>
          Último sinal do coletor há{" "}
          {formatarIdade(
            Math.max(0, painel.agoraMs - com.ultimoSinal.getTime()),
          )}
        </p>
      ) : null}
      {karts.length > 0 ? (
        <>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
            {karts.map((l) => {
              const s = sinalDoKart(l, painel.agoraMs);
              return (
                <li
                  key={l.participanteId}
                  data-sinal={s.estado}
                  className="flex flex-col items-center gap-0.5 text-center"
                  title={`Kart ${l.kartNumero ?? "—"}: ${s.estado === "recente" || s.estado === "antiga" ? `última passagem ${s.texto}` : s.texto}`}
                >
                  <span
                    className="pw-placa"
                    data-estado={l.kartNumero ? "em-uso" : "vazio"}
                  >
                    {l.kartNumero ?? "—"}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: COR_DO_SINAL[s.estado] }}
                  >
                    <span aria-hidden="true">
                      {SIMBOLO_DO_SINAL[s.estado]}{" "}
                    </span>
                    {s.texto}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px]" style={{ color: "var(--pw-dim)" }}>
            Última passagem de cada kart pelo sensor. Só informa: passagem
            antiga não significa defeito (o kart pode estar no box).
          </p>
        </>
      ) : null}
    </section>
  );
}

function Atencao({
  painel,
  decoders,
}: {
  painel: PainelDaCorrida;
  decoders: Decoder[];
}) {
  const { atencao, avisos } = atencaoDaSessao(
    painel.alertas,
    comunicacaoDaPista(decoders),
  );
  if (atencao.length === 0 && avisos.length === 0) return null;
  return (
    <section aria-labelledby="pw-atencao">
      <h3
        id="pw-atencao"
        className="text-sm font-semibold tracking-wide uppercase"
      >
        Eventos e avisos
      </h3>
      {atencao.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 text-sm" role="alert">
          {atencao.map((t, i) => (
            <li key={i} style={{ color: "var(--pw-vermelho)" }}>
              <span aria-hidden="true">⚠ </span>
              {t}
            </li>
          ))}
        </ul>
      ) : null}
      {avisos.length > 0 ? (
        <ul
          className="mt-2 flex flex-col gap-1 text-xs"
          style={{ color: "var(--pw-dim)" }}
        >
          {avisos.map((t, i) => (
            <li key={i}>• {t}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function UltimasPassagens({ painel }: { painel: PainelDaCorrida }) {
  const itens = painel.historico.slice(0, 5);
  if (itens.length === 0) return null;
  return (
    <section aria-labelledby="pw-passagens">
      <h3
        id="pw-passagens"
        className="text-sm font-semibold tracking-wide uppercase"
      >
        Últimas passagens
      </h3>
      <ul className="mt-2 flex flex-col text-xs">
        {itens.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 border-t py-1.5"
            style={{
              borderColor: "var(--pw-line)",
              opacity: p.contada ? 1 : 0.55,
            }}
          >
            <span className="font-display" style={{ color: "var(--pw-dim)" }}>
              {formatarHoraComMs(p.instanteMs)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {p.kartNumero ? (
                <span className="pw-placa mr-1.5">{p.kartNumero}</span>
              ) : null}
              {p.participante ?? "sem piloto"}
              {p.numeroVolta ? ` · volta ${p.numeroVolta}` : ""}
              {!p.contada ? " · não contou" : ""}
            </span>
            <span className="font-display">
              {p.tempoVoltaMs ? formatarTempoVolta(p.tempoVoltaMs) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PistaAoVivo({
  painel,
  decoders,
  controles,
  linkBateria,
  intervaloMs = 2000,
}: {
  painel: PainelDaCorrida;
  decoders: Decoder[];
  // Barra de comandos da bateria. Só a tela operacional passa; "Ao vivo" não.
  controles?: ReactNode;
  // "Ao vivo" aponta para a bateria, onde ficam os comandos.
  linkBateria?: string;
  intervaloMs?: number;
}) {
  // Ordem oficial pela camada compartilhada: no critério atual (padrão), exatamente a do motor.
  const criterio = criterioDaSessao(painel.corrida, lerConfigDeClassificacao());
  const linhas = linhasDaTorreDaSessao(painel.classificacao, criterio);
  const melhor = melhorDaProva(painel.classificacao);
  const hrefNomes = linkBateria
    ? `${linkBateria}#classificacao-detalhada`
    : "#classificacao-detalhada";
  const totalVoltas = painel.classificacao.reduce((t, l) => t + l.voltas, 0);
  const com = comunicacaoDaPista(decoders);
  const defasado = dadosPodemEstarDefasados(painel.corrida.estado, com);
  return (
    <div className="flex flex-col gap-4">
      {controles}
      <div className="pw" data-pista-ao-vivo>
        <Cabecalho
          painel={painel}
          linkBateria={linkBateria}
          intervaloMs={intervaloMs}
          melhor={melhor}
          totalVoltas={totalVoltas}
        />
        {defasado ? (
          <p
            role="alert"
            data-comunicacao-indisponivel
            className="mx-5 mb-4 rounded-sm px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--pw-vermelho)", color: "#14171d" }}
          >
            Comunicação indisponível: a classificação pode estar sem as últimas
            passagens. {com.falhas.join(" ")}
          </p>
        ) : null}
        <div
          className="grid grid-cols-1 border-t lg:grid-cols-[minmax(0,1fr)_21rem]"
          style={{ borderColor: "var(--pw-line)" }}
        >
          <Torre
            painel={painel}
            linhas={linhas}
            hrefNomes={hrefNomes}
            criterio={criterio}
          />
          <aside
            className="flex flex-col gap-6 border-t p-5 lg:border-t-0 lg:border-l"
            style={{ borderColor: "var(--pw-line)" }}
          >
            <SemPiloto painel={painel} hrefNomes={hrefNomes} />
            <Equipamentos painel={painel} decoders={decoders} />
            <Atencao painel={painel} decoders={decoders} />
            <UltimasPassagens painel={painel} />
          </aside>
        </div>
      </div>
      {/* Fase 1 (modo sombra): só em sessões de classificação; NÃO oficial. */}
      {mostrarComparacao(painel.corrida.fase) &&
      criterio !== "melhor_volta_v1" ? (
        <ComparacaoDeClassificacao painel={painel} />
      ) : null}
    </div>
  );
}
