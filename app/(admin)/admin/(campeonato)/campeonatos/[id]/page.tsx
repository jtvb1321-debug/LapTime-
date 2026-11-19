import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AtivacaoDoCampeonato,
  DadosDoCampeonatoForm,
  EscolherCategorias,
  EscolherTracados,
  LogosDoCampeonato,
} from "@/components/admin/campeonato-passos";
import { ImagemCampeonato } from "@/components/admin/imagem-campeonato";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { getSession } from "@/lib/auth";
import { lerImagemDoCampeonato } from "@/lib/campeonato-imagem-store";
import {
  lerCampeonatoPorId,
  MINIMO_DE_CATEGORIAS,
  MINIMO_DE_LOGOS,
  MINIMO_DE_TRACADOS,
  prontidaoDe,
} from "@/lib/campeonatos-store";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import { categorias } from "@/lib/mock/data";
import { pode } from "@/lib/permissoes";
import { lerTracados } from "@/lib/tracados-store";

export const metadata: Metadata = { title: "Campeonato" };
export const dynamic = "force-dynamic";

function Passo({
  numero,
  titulo,
  feito,
  children,
}: {
  numero: number;
  titulo: string;
  feito: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`passo-${numero}`}
      className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
    >
      <h2
        id={`passo-${numero}`}
        className="text-ink flex items-center gap-3 text-base font-semibold"
      >
        <span
          aria-hidden="true"
          className={`font-display flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            feito ? "bg-success-bg text-success" : "bg-graphite text-white"
          }`}
        >
          {feito ? "✓" : numero}
        </span>
        {titulo}
        <span className="sr-only">
          {feito ? " (concluído)" : " (pendente)"}
        </span>
      </h2>
      {children}
    </section>
  );
}

export default async function CampeonatoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await aplicarAjustesDeCategoria();
  const [campeonato, sessao, tracados, imagem] = await Promise.all([
    lerCampeonatoPorId(id),
    getSession(),
    lerTracados(),
    lerImagemDoCampeonato(id).catch(() => null),
  ]);
  if (!campeonato) notFound();
  const podeEditar = Boolean(
    sessao && pode(sessao.papel, "cadastro.gerenciar"),
  );
  const p = prontidaoDe(campeonato);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/admin/campeonatos"
          className="text-ink-2 hover:text-ink text-sm"
        >
          ← Todos os campeonatos
        </Link>
      </div>
      <PageHeader
        title={campeonato.nome}
        description={`Temporada ${campeonato.temporada}. Siga os passos na ordem.`}
        actions={
          <StatusPill
            tone={
              campeonato.status === "ativo"
                ? "success"
                : campeonato.status === "encerrado"
                  ? "neutral"
                  : "warning"
            }
          >
            {campeonato.status === "rascunho"
              ? "em preparo"
              : campeonato.status}
          </StatusPill>
        }
      />

      <Passo numero={1} titulo="Dados do campeonato" feito>
        <DadosDoCampeonatoForm
          id={campeonato.id}
          nome={campeonato.nome}
          temporada={campeonato.temporada}
          descricao={campeonato.descricao}
          podeEditar={podeEditar}
        />
      </Passo>

      <Passo numero={2} titulo="Imagem do campeonato" feito={p.imagem}>
        <ImagemCampeonato
          campeonatoId={campeonato.id}
          nomeCampeonato={campeonato.nome}
          existente={Boolean(imagem)}
          altAtual={imagem?.alt ?? ""}
          versao={imagem?.atualizadoEm.getTime() ?? 0}
          podeEditar={podeEditar}
        />
      </Passo>

      <Passo numero={3} titulo="Categorias do campeonato" feito={p.categorias}>
        <EscolherCategorias
          key={campeonato.categoriaIds.join(",")}
          campeonatoId={campeonato.id}
          categorias={categorias.map((c) => ({
            id: c.id,
            nome: c.nome,
            pesoMinimoKg: c.pesoMinimoKg,
          }))}
          escolhidas={campeonato.categoriaIds}
          podeEditar={podeEditar}
        />
      </Passo>

      <Passo
        numero={4}
        titulo={`Traçados (mínimo ${MINIMO_DE_TRACADOS})`}
        feito={p.tracados}
      >
        <EscolherTracados
          key={campeonato.tracadoIds.join(",")}
          campeonatoId={campeonato.id}
          tracados={tracados}
          escolhidos={campeonato.tracadoIds}
          minimo={MINIMO_DE_TRACADOS}
          podeEditar={podeEditar}
        />
      </Passo>

      <Passo numero={5} titulo="Logos dos patrocinadores" feito={p.logos}>
        <LogosDoCampeonato
          campeonatoId={campeonato.id}
          logos={campeonato.logos}
          podeEditar={podeEditar}
        />
      </Passo>

      <Passo
        numero={6}
        titulo={campeonato.status === "ativo" ? "Campeonato ativo" : "Ativar"}
        feito={campeonato.status === "ativo"}
      >
        <AtivacaoDoCampeonato
          campeonatoId={campeonato.id}
          status={campeonato.status}
          podeEditar={podeEditar}
          itens={[
            { rotulo: "Dados do campeonato", feito: true },
            { rotulo: "Imagem enviada", feito: p.imagem },
            {
              rotulo: `Pelo menos ${MINIMO_DE_CATEGORIAS} categoria escolhida (${campeonato.categoriaIds.length})`,
              feito: p.categorias,
            },
            {
              rotulo: `Pelo menos ${MINIMO_DE_TRACADOS} traçados escolhidos (${campeonato.tracadoIds.length})`,
              feito: p.tracados,
            },
            {
              rotulo: `Pelo menos ${MINIMO_DE_LOGOS} logo de patrocinador (${campeonato.logos.length})`,
              feito: p.logos,
            },
          ]}
        />
      </Passo>
    </div>
  );
}
