import { CampeonatoTabs } from "@/components/site/campeonato-tabs";

export default function CampeonatoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-ink before:bg-orange text-3xl font-bold tracking-tight before:mb-2 before:block before:h-1 before:w-9 before:rounded-full before:content-['']">
          Campeonato
        </h1>
        <p className="text-ink-2 mt-1 text-sm">
          Classificação, calendário, resultados e live timing.
        </p>
      </div>
      <CampeonatoTabs />
      {children}
    </div>
  );
}
