import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import Link from "next/link";
import { AberturaGridLap } from "@/components/site/abertura-gridlap";
import { CalendarioEtapas } from "@/components/site/calendario-etapas";
import { CapaDoCampeonato } from "@/components/ui/capa-do-campeonato";
import { HeroHome } from "@/components/site/hero-home";
import { PilotosDestaque } from "@/components/site/pilotos-destaque";
import { MapaDoCircuito } from "@/components/site/mapa-do-circuito";
import { ProximaEtapaCard } from "@/components/site/proxima-etapa-card";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { etapasDoCampeonatoAtivo } from "@/lib/etapas-store";
import { lerImagemDoCampeonato } from "@/lib/campeonato-imagem-store";
import { categorias } from "@/lib/mock/data";
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
  await aplicarAjustesDeCategoria();
  const [campeonato, pilotos, etapas] = await Promise.all([
    lerCampeonatoAtivo(),
    lerPilotos(),
    etapasDoCampeonatoAtivo(),
  ]);
  const imagemDoCampeonato = campeonato
    ? await lerImagemDoCampeonato(campeonato.id).catch(() => null)
    : null;

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
          <CapaDoCampeonato
            src={`/api/campeonatos/${encodeURIComponent(campeonato.id)}/imagem?v=${imagemDoCampeonato.atualizadoEm.getTime()}`}
            alt={imagemDoCampeonato.alt}
            enquadramento={imagemDoCampeonato.enquadramento}
            focoY={imagemDoCampeonato.focoY}
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

      {campeonato && campeonato.logos.length > 0 ? (
        <section aria-labelledby="patrocinadores-titulo">
          <TituloDaSecao id="patrocinadores-titulo">
            Patrocinadores
          </TituloDaSecao>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-2xl border border-white/10 bg-black/20 px-6 py-6">
            {campeonato.logos.map((l) => (
              <li key={l.id} className="flex h-14 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.logo}
                  alt={l.nome}
                  loading="lazy"
                  className="max-h-full max-w-[9rem] object-contain"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
