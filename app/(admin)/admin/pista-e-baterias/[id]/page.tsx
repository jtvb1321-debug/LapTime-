import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import {
  TabelaBateria,
  ehLinhaDoPiloto,
} from "@/components/pilotos/tabela-bateria";
import { getSession } from "@/lib/auth";
import {
  ESTADOS_ATIVOS,
  lerCorrida,
  lerPainel,
} from "@/lib/cronometragem/corridas-store";
import type { LinhaClassificacao } from "@/lib/cronometragem/motor";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";
import { encontrarPilotoPorId } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Bateria" };
export const dynamic = "force-dynamic";

const PAINEL = "rounded-xl border border-white/10 bg-[#0c1630]";

// Resultado de uma bateria, só leitura. Ao vivo mostra a classificação que está valendo agora; depois
// de finalizada, o resultado publicado. Se o piloto estiver na bateria, aparecem as voltas dele.
export default async function BateriaDoPilotoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const corrida = await lerCorrida(id);
  if (!corrida) notFound();

  const sessao = await getSession();
  const piloto = sessao?.pilotoId
    ? await encontrarPilotoPorId(sessao.pilotoId)
    : undefined;
  const meus = [sessao?.nome, piloto?.nome, piloto?.apelido].filter(
    (x): x is string => Boolean(x),
  );

  const aoVivo = ESTADOS_ATIVOS.includes(corrida.estado);
  let linhas: LinhaClassificacao[] = [];
  if (aoVivo || !corrida.resultadoFinal) {
    linhas = (await lerPainel(id))?.classificacao ?? [];
  } else {
    linhas = corrida.resultadoFinal.classificacao;
  }
  const minha = linhas.find((l) => ehLinhaDoPiloto(l.nome, meus));

  return (
    <div className="flex flex-col gap-5">
      {aoVivo ? <AtualizacaoPeriodica intervaloMs={3000} /> : null}
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/pista-e-baterias"
          className="w-fit text-sm text-[#4cc9ff] hover:underline"
        >
          ← Pista e baterias
        </Link>
        <h1 className="font-display text-ink text-2xl font-bold">
          {corrida.nome}
        </h1>
        <p className="text-sm text-[#9fb2d4]">
          {aoVivo
            ? "Ao vivo — atualiza sozinha."
            : corrida.estado === "finalizada"
              ? "Bateria finalizada."
              : "Bateria ainda não começou."}
        </p>
      </div>

      {minha ? (
        <section className={`${PAINEL} p-4`}>
          <h2 className="text-ink mb-3 text-base font-semibold">
            Seu resultado
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Posição", minha.posicao ? `${minha.posicao}º` : "—"],
              ["Voltas", String(minha.voltas)],
              [
                "Melhor volta",
                minha.melhorVoltaMs
                  ? formatarTempoVolta(minha.melhorVoltaMs)
                  : "—",
              ],
              ["Kart", minha.kartNumero ?? "—"],
            ].map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-[11px] tracking-wide text-[#9fb2d4] uppercase">
                  {rotulo}
                </dt>
                <dd className="font-display text-xl font-bold text-[#4cc9ff]">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>
          {minha.voltasLista.length > 0 ? (
            <ol className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {minha.voltasLista.map((v) => (
                <li
                  key={v.numero}
                  className="flex justify-between border-b border-white/5 py-1"
                >
                  <span className="text-[#9fb2d4]">Volta {v.numero}</span>
                  <span
                    className={
                      v.tempoMs === minha.melhorVoltaMs
                        ? "font-semibold text-[#35f2c2]"
                        : ""
                    }
                  >
                    {formatarTempoVolta(v.tempoMs)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      <section className={`${PAINEL} overflow-hidden`}>
        <TabelaBateria linhas={linhas} meus={meus} />
      </section>
    </div>
  );
}
