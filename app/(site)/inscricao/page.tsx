import type { Metadata } from "next";
import { InscricaoForm } from "@/components/site/inscricao-form";
import { categorias, etapas } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Inscrição" };

export default function InscricaoPage() {
  const etapasAbertas = etapas.filter((e) => e.status === "agendada");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-ink text-2xl font-semibold">Inscrição</h1>
        <p className="text-ink-2 mt-1 text-sm">
          Inscreva-se em uma das próximas etapas do campeonato.
        </p>
      </div>
      <InscricaoForm categorias={categorias} etapas={etapasAbertas} />
    </div>
  );
}
