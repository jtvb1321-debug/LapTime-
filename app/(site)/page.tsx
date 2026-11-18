import Link from "next/link";
import { AberturaGridLap } from "@/components/site/abertura-gridlap";
import { CalendarioEtapas } from "@/components/site/calendario-etapas";
import { HeroHome } from "@/components/site/hero-home";
import { PilotosDestaque } from "@/components/site/pilotos-destaque";
import { MapaDoCircuito } from "@/components/site/mapa-do-circuito";
import { ProximaEtapaCard } from "@/components/site/proxima-etapa-card";
import { lerImagemDoCampeonato } from "@/lib/campeonato-imagem-store";
import { campeonato, categorias, etapas } from "@/lib/mock/data";
import { lerPilotos } from "@/lib/pilotos-store";

function TituloDaSecao({
  id,
  children,
  href,
  rotuloDoLink,
}: {
  id: string;
  children: React.ReactNode;
  href?: string;
  rotuloDoLink?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2
        id={id}
        className="font-display text-ink text-3xl font-bold tracking-tight"
      >
        {children}
      </h2>
      {href ? (
        <Link
          href={href}
          className="text-ink-2 hover:text-ink inline-flex min-h-11 items-center text-sm font-medium"
        >
          {rotuloDoLink}
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const [imagemDoCampeonato, pilotos] = await Promise.all([
    campeonato
      ? lerImagemDoCampeonato(campeonato.id).catch(() => null)
      : Promise.resolve(null),
    lerPilotos(),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <AberturaGridLap />
      <HeroHome
        lateral={
          <>
            <MapaDoCircuito />
            <ProximaEtapaCard etapasIniciais={etapas} />
          </>
        }
      />

      {campeonato && imagemDoCampeonato ? (
        <section aria-label={`Apresentação: ${campeonato.nome}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/campeonatos/${encodeURIComponent(campeonato.id)}/imagem?v=${imagemDoCampeonato.atualizadoEm.getTime()}`}
            alt={imagemDoCampeonato.alt}
            className="border-border aspect-[16/7] w-full rounded-lg border object-cover"
          />
        </section>
      ) : null}

      <section aria-labelledby="calendario-titulo">
        <TituloDaSecao
          id="calendario-titulo"
          href="/campeonato/calendario"
          rotuloDoLink="Ver todas"
        >
          Calendário
        </TituloDaSecao>
        <CalendarioEtapas etapasIniciais={etapas} />
      </section>

      <section aria-labelledby="pilotos-titulo">
        <TituloDaSecao
          id="pilotos-titulo"
          href="/pilotos"
          rotuloDoLink="Ver todos os pilotos"
        >
          Pilotos
        </TituloDaSecao>
        <PilotosDestaque pilotos={pilotos} categoriasIniciais={categorias} />
      </section>
    </div>
  );
}
