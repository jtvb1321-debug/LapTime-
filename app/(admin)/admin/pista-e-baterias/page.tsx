import type { Metadata } from "next";
import Link from "next/link";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { TabelaBateria } from "@/components/pilotos/tabela-bateria";
import { getSession } from "@/lib/auth";
import {
  ESTADOS_ATIVOS,
  lerPainel,
  listarCorridas,
} from "@/lib/cronometragem/corridas-store";
import { encontrarPilotoPorId } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Pista e baterias" };
export const dynamic = "force-dynamic";

const PAINEL = "rounded-xl border border-white/10 bg-[#0c1630]";

const quando = (d: Date | null | undefined) =>
  d
    ? d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

// "Pista e baterias" do piloto: baterias ao vivo e as que já aconteceram, só para consulta. Quem
// controla as baterias é a equipe; aqui o piloto acompanha e vê o próprio resultado.
export default async function PistaEBateriasPage() {
  const sessao = await getSession();
  const piloto = sessao?.pilotoId
    ? await encontrarPilotoPorId(sessao.pilotoId)
    : undefined;
  const meus = [sessao?.nome, piloto?.nome, piloto?.apelido].filter(
    (x): x is string => Boolean(x),
  );

  const corridas = await listarCorridas(40);
  const aoVivo = corridas.filter((c) => ESTADOS_ATIVOS.includes(c.estado));
  const finalizadas = corridas.filter((c) => c.estado === "finalizada");
  const paineis = await Promise.all(aoVivo.map((c) => lerPainel(c.id)));

  return (
    <div className="flex flex-col gap-6">
      {aoVivo.length > 0 ? <AtualizacaoPeriodica intervaloMs={3000} /> : null}
      <div>
        <h1 className="font-display text-ink text-2xl font-bold">
          Pista e baterias
        </h1>
        <p className="text-sm text-[#9fb2d4]">
          Acompanhe as baterias ao vivo e veja o seu resultado quando terminar
          de correr.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink flex items-center gap-2 text-base font-semibold">
          Ao vivo
          {aoVivo.length > 0 ? (
            <span className="rounded-full bg-[#ff5d7a]/15 px-2 py-0.5 text-[11px] font-medium text-[#ff8da1]">
              {aoVivo.length} em andamento
            </span>
          ) : null}
        </h2>
        {aoVivo.length === 0 ? (
          <div
            className={`${PAINEL} px-5 py-8 text-center text-sm text-[#9fb2d4]`}
          >
            Nenhuma bateria rodando agora.
          </div>
        ) : (
          aoVivo.map((c, i) => (
            <div key={c.id} className={`${PAINEL} overflow-hidden`}>
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
                <p className="font-medium">{c.nome}</p>
                <Link
                  href={`/admin/pista-e-baterias/${c.id}`}
                  className="text-xs font-medium text-[#4cc9ff] hover:underline"
                >
                  Abrir
                </Link>
              </div>
              <TabelaBateria
                linhas={paineis[i]?.classificacao ?? []}
                meus={meus}
              />
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ink text-base font-semibold">Já aconteceram</h2>
        {finalizadas.length === 0 ? (
          <div
            className={`${PAINEL} px-5 py-8 text-center text-sm text-[#9fb2d4]`}
          >
            Nenhuma bateria finalizada ainda.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {finalizadas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/pista-e-baterias/${c.id}`}
                  className={`${PAINEL} flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-[#4cc9ff]/40`}
                >
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-xs text-[#9fb2d4]">
                    {quando(c.encerradaEm ?? c.iniciadaEm ?? c.criadoEm)} ·{" "}
                    {c.pilotos} pilotos
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
