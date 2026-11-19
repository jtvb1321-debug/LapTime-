import type { Metadata } from "next";
import Link from "next/link";
import {
  InscricoesAdmin,
  type EtapaDaLista,
  type PilotoDaLista,
} from "@/components/admin/inscricoes-admin";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { lerEtapasDoCampeonato } from "@/lib/etapas-store";
import { lerInscricoesDoCampeonato } from "@/lib/inscricoes-store";
import { categorias } from "@/lib/mock/data";
import { pode } from "@/lib/permissoes";
import { lerPilotos } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Inscrições" };
export const dynamic = "force-dynamic";

export default async function AdminInscricoesPage() {
  await aplicarAjustesDeCategoria();
  const [campeonato, sessao] = await Promise.all([
    lerCampeonatoAtivo(),
    getSession(),
  ]);
  if (!campeonato) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Inscrições" description="Inscrições por etapa." />
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Não há campeonato ativo. Ative um em{" "}
          <Link
            href="/admin/campeonatos"
            className="text-orange-ink font-medium hover:underline"
          >
            Campeonatos
          </Link>{" "}
          para receber inscrições.
        </p>
      </div>
    );
  }
  const [etapas, inscricoes, todosPilotos] = await Promise.all([
    lerEtapasDoCampeonato(campeonato.id),
    lerInscricoesDoCampeonato(campeonato.id),
    lerPilotos(),
  ]);
  const etapasLista: EtapaDaLista[] = etapas.map((e) => ({
    id: e.id,
    numero: e.numero,
    nome: e.nome,
    data: e.data,
    hora: e.hora ?? "",
    status: e.status,
    valorCentavos: e.valorInscricaoCentavos ?? 0,
  }));
  const pilotos: PilotoDaLista[] = todosPilotos
    .filter((p) => campeonato.pilotoIds.includes(p.id))
    .map((p) => ({
      id: p.id,
      nome: p.apelido?.trim() || p.nome,
      numero: p.numero,
      categoriaId: p.categoriaId,
      categoriaNome: categorias.find((c) => c.id === p.categoriaId)?.nome ?? "",
    }))
    .sort((a, b) => a.numero - b.numero);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inscrições"
        description={`Inscrições por etapa do ${campeonato.nome}.`}
      />
      <InscricoesAdmin
        etapas={etapasLista}
        inscricoes={inscricoes}
        pilotos={pilotos}
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
        podeEditar={Boolean(sessao && pode(sessao.papel, "cadastro.gerenciar"))}
        podeEstornar={Boolean(sessao && pode(sessao.papel, "caixa.estornar"))}
      />
    </div>
  );
}
