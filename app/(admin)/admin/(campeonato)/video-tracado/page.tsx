import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { VideoTracadoStudio } from "@/components/admin/video-tracado-studio";
import { lerTracados } from "@/lib/tracados-store";

export const metadata: Metadata = { title: "Vídeo do traçado" };

export const dynamic = "force-dynamic";

export default async function AdminVideoTracadoPage() {
  const tracados = await lerTracados();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vídeo do traçado"
        description="Grava um vídeo da câmera do piloto percorrendo o traçado sobre o modelo 3D da pista."
      />
      <VideoTracadoStudio tracadosIniciais={tracados} />
    </div>
  );
}
