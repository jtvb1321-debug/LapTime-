import type { Metadata } from "next";
import Link from "next/link";
import { PunicoesAdmin } from "@/components/admin/resultados-admin";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { consultar } from "@/lib/db/conexao";
import { carregarCampeonatoAtivo } from "@/lib/dados-do-campeonato";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Punições" };
export const dynamic = "force-dynamic";

interface Ocorrencia {
  piloto: string;
  categoria_id: string;
  etapa_nome: string;
  situacao_manual: string | null;
  penalidade_ms: number;
  ocorrencia_motivo: string | null;
  corrida_id: string;
}

const SITUACAO = {
  dns: "Não largou",
  dnf: "Não terminou",
  dsq: "Desclassificado",
};

export default async function AdminPunicoesPage() {
  const [dados, sessao] = await Promise.all([
    carregarCampeonatoAtivo(),
    getSession(),
  ]);
  if (!dados) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Punições" description="Punições do campeonato." />
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Não há campeonato ativo. Ative um em{" "}
          <Link
            href="/admin/campeonatos"
            className="text-orange-ink font-medium hover:underline"
          >
            Campeonatos
          </Link>
          .
        </p>
      </div>
    );
  }
  // Ocorrências decididas na própria corrida (DNS, DNF, DSQ e tempo somado), só para consulta.
  const ocorrencias = await consultar<Ocorrencia>(
    `select cp.nome as piloto, b.categoria_id, e.nome as etapa_nome, cp.situacao_manual,
            cp.penalidade_ms, cp.ocorrencia_motivo, c.id as corrida_id
       from corrida_piloto cp
       join corrida c on c.id = cp.corrida_id
       join bateria_campeonato b on b.corrida_id = c.id or b.corrida_id = c.classificacao_id
       join etapa e on e.id = b.etapa_id
      where e.campeonato_id = $1 and (cp.situacao_manual is not null or cp.penalidade_ms > 0)
      order by e.data, c.criado_em`,
    [dados.campeonato.id],
  ).catch(() => []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Punições"
        description="Advertência, perda de pontos ou desclassificação da etapa. Cada uma entra na conta da classificação."
      />
      <PunicoesAdmin
        campeonatoId={dados.campeonato.id}
        punicoes={dados.resultados.punicoes}
        etapas={dados.etapas.map((e) => ({ id: e.id, nome: e.nome }))}
        pilotos={dados.pilotos
          .map((p) => ({
            id: p.id,
            nome: p.apelido?.trim() || p.nome,
            numero: p.numero,
          }))
          .sort((a, b) => a.numero - b.numero)}
        podeEditar={Boolean(sessao && pode(sessao.papel, "cadastro.gerenciar"))}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-ink text-base font-semibold">
          Ocorrências nas corridas
        </h2>
        <p className="text-ink-3 text-xs">
          Decididas pelo operador na cronometragem (não largou, não terminou,
          desclassificado e tempo somado). Aparecem aqui só para consulta; para
          alterar, abra a bateria na cronometragem.
        </p>
        {ocorrencias.length === 0 ? (
          <p className="text-ink-2 text-sm">Nenhuma ocorrência registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ocorrencias.map((o, i) => (
              <li
                key={`${o.corrida_id}-${i}`}
                className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span className="text-ink">
                  <span className="font-semibold">{o.piloto}</span>{" "}
                  <span className="text-ink-3">· {o.etapa_nome}</span>
                  <span className="text-ink-2 block text-xs">
                    {o.situacao_manual
                      ? SITUACAO[o.situacao_manual as keyof typeof SITUACAO]
                      : ""}
                    {o.penalidade_ms > 0
                      ? `${o.situacao_manual ? " · " : ""}+${Math.round(o.penalidade_ms / 1000)} s de penalidade`
                      : ""}
                    {o.ocorrencia_motivo ? ` — ${o.ocorrencia_motivo}` : ""}
                  </span>
                </span>
                <Link
                  href={`/admin/cronometragem/corridas/${o.corrida_id}`}
                  className="text-orange-ink text-xs font-medium hover:underline"
                >
                  Abrir bateria →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
