import type { Metadata } from "next";
import { LiveTimingCampeonato } from "@/components/campeonato/live-timing-campeonato";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Live timing" };
export const dynamic = "force-dynamic";

export default function AdminLiveTimingPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Live timing"
        description="Classificação ao vivo da bateria do campeonato em andamento, direto do decoder."
      />
      <LiveTimingCampeonato linkDeBaterias="/admin/baterias" />
      <p className="text-ink-3 text-xs">
        Para iniciar, pausar ou encerrar a bateria, use a tela dela na
        cronometragem (Baterias → Abrir na cronometragem).
      </p>
    </div>
  );
}
