import { redirect } from "next/navigation";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";

export const dynamic = "force-dynamic";

// Dados e imagem do campeonato agora são passos do assistente em Campeonatos.
export default async function AdminConfiguracoesPage() {
  const ativo = await lerCampeonatoAtivo();
  redirect(ativo ? `/admin/campeonatos/${ativo.id}` : "/admin/campeonatos");
}
