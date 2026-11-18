import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";

// Seção principal da página inicial: identidade GridLap, destaque para o VeloKart, a próxima
// etapa cadastrada e o caminho para pilotos e competições. Só apresentação: os dados vêm da
// mesma fonte de sempre. `lateral` recebe o desenho animado da pista e o card da próxima etapa.
export function HeroHome({ lateral }: { lateral?: React.ReactNode }) {
  return (
    <section
      aria-labelledby="hero-titulo"
      className="relative grid gap-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] px-6 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:px-12 sm:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center"
    >
      <div className="flex flex-col items-start gap-6">
        <h1 id="hero-titulo" className="m-0">
          <Image
            src="/logo-gridlap-claro.svg"
            alt="Grid Lap"
            width={1000}
            height={334}
            unoptimized
            priority
            className="h-auto w-full max-w-[420px]"
          />
        </h1>
        <p className="text-ink-2 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          Classificação, calendário, resultados e live timing em um só lugar.
          Acompanhe os pilotos, as etapas e cada volta do campeonato.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/pilotos" className="min-h-12 px-6 text-base">
            Conhecer os pilotos
          </ButtonLink>
          <ButtonLink
            href="/campeonato"
            variant="secondary"
            className="min-h-12 px-6 text-base"
          >
            Ver o campeonato
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-col gap-5">{lateral}</div>
    </section>
  );
}
