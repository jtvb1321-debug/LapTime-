import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { exigirPermissao } from "@/lib/auth";
import { classificarPorMelhorVolta } from "@/lib/cronometragem/classificacao-melhor-volta";
import { lerPainel } from "@/lib/cronometragem/corridas-store";
import {
  previaDoGrid,
  type EstadoDaVaga,
  type VagaDoGrid,
} from "@/lib/cronometragem/previa-do-grid";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";

export const metadata: Metadata = { title: "Prévia do grid" };
export const dynamic = "force-dynamic";

// PRÉVIA DO GRID pela classificação por melhor volta. SÓ LEITURA: não grava, não decide e não publica.
// O grid oficial continua sendo criado pela regra atual ao encerrar a classificação. Esta tela existe
// para o responsável ver posição classificatória × posição física, elegibilidade, exclusões e o que
// precisará de decisão autorizada, justificativa e auditoria quando a publicação for habilitada.

const ESTADO: Record<EstadoDaVaga, { rotulo: string; cor: string }> = {
  definida: { rotulo: "Definida", cor: "var(--pw-verde)" },
  a_decidir_empate: { rotulo: "Empate a decidir", cor: "var(--pw-azul)" },
  pendente_elegibilidade: {
    rotulo: "Elegibilidade pendente",
    cor: "var(--pw-ambar)",
  },
  aguarda_decisoes_anteriores: {
    rotulo: "Aguarda decisões acima",
    cor: "var(--pw-dim)",
  },
};

const tempo = (ms: number | null) =>
  ms === null ? "—" : formatarTempoVolta(ms);

function Estado({ v }: { v: VagaDoGrid }) {
  const e = ESTADO[v.estado];
  return (
    <span
      data-estado-vaga={v.estado}
      className="inline-flex rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ color: e.cor, borderColor: e.cor }}
    >
      {e.rotulo}
    </span>
  );
}

export default async function PreviaDoGridPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const { id } = await params;
  const painel = await lerPainel(id);
  if (!painel) notFound();
  const { corrida } = painel;
  const voltar = (
    <Link
      href={`/admin/cronometragem/corridas/${corrida.id}`}
      className="text-orange-ink inline-flex min-h-11 items-center text-sm font-medium hover:underline md:min-h-0"
    >
      ← Voltar à bateria
    </Link>
  );

  if (corrida.fase !== "classificacao") {
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        <p className="text-ink text-sm" data-previa-indisponivel>
          A prévia do grid só existe para sessões de classificação. Esta sessão
          segue a ordem oficial do motor.
        </p>
      </div>
    );
  }

  const publicado = corrida.resultadoFinal?.classificacao ?? null;
  const fonte = publicado ?? painel.classificacao;
  const previa = previaDoGrid(classificarPorMelhorVolta(fonte));
  const idDaCorrida = painel.fases?.corrida?.id;
  const corridaSeguinte = idDaCorrida ? await lerPainel(idDaCorrida) : null;
  const gridAtual = corridaSeguinte
    ? [...corridaSeguinte.grid]
        .filter((p) => p.posicaoGrid !== undefined)
        .sort((a, b) => (a.posicaoGrid ?? 0) - (b.posicaoGrid ?? 0))
    : [];

  return (
    <div className="flex flex-col gap-4">
      {voltar}
      <section className="pw" data-previa-grid>
        <header className="flex flex-col gap-2 p-5">
          <p
            className="text-xs font-semibold tracking-[0.18em] uppercase"
            style={{ color: "var(--pw-laranja)" }}
          >
            Grid de largada · prévia
          </p>
          <h1 className="text-xl font-semibold md:text-2xl">{corrida.nome}</h1>
          <p className="text-sm" style={{ color: "var(--pw-dim)" }}>
            Fonte:{" "}
            {publicado
              ? "resultado publicado da classificação (congelado ao encerrar)."
              : "classificação provisória (sessão ainda não encerrada)."}
          </p>
          <p
            role="note"
            className="rounded-sm px-3 py-2 text-sm font-semibold"
            style={{
              background: "rgba(255,176,32,0.12)",
              color: "var(--pw-ambar)",
            }}
          >
            PRÉVIA — NÃO PUBLICADA. Calculada pela classificação por melhor
            volta, que ainda não é a regra oficial. Nada aqui é gravado. O grid
            oficial continua sendo criado pela regra atual.
          </p>
        </header>

        <div
          className="flex flex-col gap-5 border-t p-5"
          style={{ borderColor: "var(--pw-line)" }}
        >
          <section aria-labelledby="pg-bloqueio" data-previa-bloqueios>
            <h2
              id="pg-bloqueio"
              className="text-sm font-semibold tracking-wide uppercase"
            >
              Publicação
            </h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {previa.motivosDoBloqueio.map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled
              aria-disabled="true"
              data-publicar-grid
              className="mt-3 min-h-11 cursor-not-allowed rounded-md border px-4 py-2 text-sm font-semibold opacity-60"
              style={{ borderColor: "var(--pw-dim)", color: "var(--pw-dim)" }}
              title="Publicação pela nova regra não habilitada nesta etapa"
            >
              Publicar grid (não habilitado)
            </button>
          </section>

          {previa.decisoes.length > 0 ? (
            <section aria-labelledby="pg-decisoes" data-previa-decisoes>
              <h2
                id="pg-decisoes"
                className="text-sm font-semibold tracking-wide uppercase"
              >
                Decisões necessárias ({previa.decisoes.length})
              </h2>
              <ol className="mt-2 flex flex-col gap-3">
                {previa.decisoes.map((d, i) => (
                  <li
                    key={i}
                    data-decisao={d.tipo}
                    className="rounded-sm px-3 py-2 text-sm"
                    style={{
                      background: "var(--pw-panel)",
                      boxShadow: `inset 3px 0 0 ${d.tipo === "empate_absoluto" ? "var(--pw-azul)" : "var(--pw-ambar)"}`,
                    }}
                  >
                    <p className="font-semibold">
                      {d.tipo === "empate_absoluto"
                        ? "Empate absoluto"
                        : "Elegibilidade"}
                    </p>
                    <p className="mt-0.5" style={{ color: "var(--pw-ink)" }}>
                      {d.descricao}
                    </p>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: "var(--pw-dim)" }}
                    >
                      Exigirá: {d.exige.join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs" style={{ color: "var(--pw-dim)" }}>
                Nenhuma decisão é registrada nesta tela: o registro com
                autorização, justificativa e auditoria será implementado junto
                com a publicação, mediante aprovação.
              </p>
            </section>
          ) : null}

          <section aria-labelledby="pg-vagas">
            <h2
              id="pg-vagas"
              className="text-sm font-semibold tracking-wide uppercase"
            >
              Prévia por melhor volta
            </h2>
            {previa.vagas.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: "var(--pw-dim)" }}>
                Nenhum piloto na classificação.
              </p>
            ) : (
              <>
                <div className="mt-2 hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead>
                      <tr
                        className="text-[10px] tracking-[0.12em] uppercase"
                        style={{ color: "var(--pw-dim)" }}
                      >
                        <th scope="col" className="px-2 py-2 font-medium">
                          Pos. física
                        </th>
                        <th scope="col" className="px-2 py-2 font-medium">
                          Pos. classificatória
                        </th>
                        <th scope="col" className="px-2 py-2 font-medium">
                          Kart
                        </th>
                        <th scope="col" className="px-2 py-2 font-medium">
                          Piloto
                        </th>
                        <th
                          scope="col"
                          className="px-2 py-2 text-right font-medium"
                        >
                          Melhor volta
                        </th>
                        <th
                          scope="col"
                          className="px-2 py-2 text-right font-medium"
                        >
                          Penalidade
                        </th>
                        <th scope="col" className="px-2 py-2 font-medium">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.vagas.map((v) => (
                        <tr
                          key={v.participanteId}
                          data-vaga-kart={v.kartNumero ?? ""}
                          className="border-t"
                          style={{ borderColor: "var(--pw-line)" }}
                        >
                          <td
                            className="px-2 py-2 font-display font-bold"
                            data-pos-fisica
                          >
                            {v.posicaoFisica ?? "—"}
                          </td>
                          <td className="px-2 py-2 font-display">
                            {v.posicaoClassificatoria ?? "—"}
                          </td>
                          <td className="px-2 py-2">
                            <span className="pw-placa" data-estado="em-uso">
                              {v.kartNumero ?? "—"}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-medium">{v.nome}</td>
                          <td className="px-2 py-2 text-right font-display">
                            {tempo(v.melhorVoltaMs)}
                          </td>
                          <td className="px-2 py-2 text-right font-display text-xs">
                            {v.penalidadeMs > 0
                              ? `+${v.penalidadeMs / 1000} s (não altera a volta)`
                              : "—"}
                          </td>
                          <td className="px-2 py-2">
                            <Estado v={v} />
                            {v.observacao ? (
                              <span
                                className="mt-0.5 block text-[11px]"
                                style={{ color: "var(--pw-dim)" }}
                              >
                                {v.observacao}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="mt-2 flex flex-col gap-2 md:hidden">
                  {previa.vagas.map((v) => (
                    <li
                      key={v.participanteId}
                      data-vaga-cartao={v.kartNumero ?? ""}
                      className="flex flex-col gap-1.5 rounded-sm px-3 py-2.5"
                      style={{ background: "var(--pw-panel)" }}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-display text-lg font-bold">
                          {v.posicaoFisica ?? "—"}
                        </span>
                        <span
                          className="pw-placa shrink-0"
                          data-estado="em-uso"
                        >
                          {v.kartNumero ?? "—"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {v.nome}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--pw-dim)" }}>
                        Classificatória {v.posicaoClassificatoria ?? "—"} ·
                        melhor {tempo(v.melhorVoltaMs)}
                        {v.penalidadeMs > 0
                          ? ` · penalidade +${v.penalidadeMs / 1000} s`
                          : ""}
                      </p>
                      <div>
                        <Estado v={v} />
                      </div>
                      {v.observacao ? (
                        <p
                          className="text-[11px]"
                          style={{ color: "var(--pw-dim)" }}
                        >
                          {v.observacao}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {previa.excluidos.length > 0 ? (
            <section aria-labelledby="pg-fora" data-previa-excluidos>
              <h2
                id="pg-fora"
                className="text-sm font-semibold tracking-wide uppercase"
              >
                Fora do grid
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {previa.excluidos.map((e) => (
                  <li key={e.participanteId}>
                    <span className="pw-placa mr-2" data-estado="fora">
                      {e.kartNumero ?? "—"}
                    </span>
                    {e.nome} · {e.motivo} (exceção só com regra regulamentar e
                    autorização específica)
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="pg-atual" data-grid-atual>
            <h2
              id="pg-atual"
              className="text-sm font-semibold tracking-wide uppercase"
            >
              Grid oficial atual (regra vigente)
            </h2>
            {gridAtual.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: "var(--pw-dim)" }}>
                Ainda não criado: ele é criado pela regra atual quando a
                classificação é encerrada.
              </p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1 text-sm">
                {gridAtual.map((p) => (
                  <li key={p.id} data-grid-atual-kart={p.kartNumero ?? ""}>
                    <span className="font-display">P{p.posicaoGrid}</span>{" "}
                    <span className="pw-placa mx-1" data-estado="em-uso">
                      {p.kartNumero ?? "—"}
                    </span>
                    {p.nome}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
