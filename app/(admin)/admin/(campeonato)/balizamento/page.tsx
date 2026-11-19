import { AvisoEmDesenvolvimento } from "@/components/admin/aviso-em-desenvolvimento";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { BalizamentoCategoria } from "@/components/admin/balizamento-categoria";
import { categorias, getPilotosPorCategoria } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Balizamento" };

export default function AdminBalizamentoPage() {
  return (
    <div className="flex flex-col gap-8">
      <AvisoEmDesenvolvimento />
      <PageHeader
        title="Balizamento"
        description="Sorteio de kart, pesagem e lastro por categoria. O número do kart pode ser sorteado ou digitado manualmente, e cada troca solicitada pelo piloto fica registrada."
      />
      {categorias.length === 0 ? (
        <p className="text-ink-2 text-sm">
          Nenhuma categoria cadastrada ainda.
        </p>
      ) : (
        categorias.map((categoria) => (
          <BalizamentoCategoria
            key={categoria.id}
            categoria={categoria}
            pilotos={getPilotosPorCategoria(categoria.id)}
          />
        ))
      )}
    </div>
  );
}
