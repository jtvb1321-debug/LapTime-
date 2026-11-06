import type { Metadata } from "next";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { DemonstracaoPainel } from "@/components/admin/demonstracao-painel";
import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissao } from "@/lib/auth";
import { lerPainelDemo } from "@/lib/demo-corrida";

export const metadata: Metadata = { title: "Demonstração" };
export const dynamic = "force-dynamic";

export default async function AdminDemonstracaoPage() {
  if (!(await exigirPermissao("simulacao.alternar"))) return <SemPermissao />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Demonstração do campeonato"
        description="Simule uma corrida completa e mostre as transmissões (grid, classificação ao vivo e resultado final) funcionando."
      />
      <DemonstracaoPainel inicial={lerPainelDemo()} />
    </div>
  );
}
