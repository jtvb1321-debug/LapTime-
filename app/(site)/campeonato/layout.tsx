import { CampeonatoTabs } from "@/components/site/campeonato-tabs";

export default function CampeonatoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-ink text-xl font-semibold">Campeonato</h1>
        <p className="text-ink-2 mt-1 text-sm">
          Classificação, calendário, resultados e live timing.
        </p>
      </div>
      <CampeonatoTabs />
      {children}
    </div>
  );
}
