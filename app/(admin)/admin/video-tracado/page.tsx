import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { VideoTracadoStudio } from "@/components/admin/video-tracado-studio";
import { tracados } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Vídeo do traçado" };

export default function AdminVideoTracadoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vídeo do traçado"
        description="Gera um vídeo cinematográfico 3D do traçado, com o circuito sendo desenhado por linhas luminosas — mesmo modelo reutilizável pra qualquer traçado/campeonato."
      />
      <VideoTracadoStudio tracadosIniciais={tracados} />
    </div>
  );
}
