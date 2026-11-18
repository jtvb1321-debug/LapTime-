import type { Metadata } from "next";
import { EditarPerfilForm } from "@/components/pilotos/editar-perfil-form";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/auth";
import { encontrarPilotoPorId } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Meu perfil" };
export const dynamic = "force-dynamic";

export default async function MeuPerfilPage() {
  const sessao = await getSession();
  const piloto = sessao?.pilotoId
    ? await encontrarPilotoPorId(sessao.pilotoId)
    : undefined;

  if (!piloto) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <PageHeader title="Meu perfil" />
        <p className="text-ink-2 text-sm">
          Esta conta não tem um perfil de piloto para editar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meu perfil"
        description="Atualize seu nome, número, data de nascimento e foto. O número é só seu: dois pilotos não podem ter o mesmo."
      />
      <EditarPerfilForm
        perfil={{
          nome: piloto.nome,
          apelido: piloto.apelido ?? piloto.nome,
          numero: piloto.numero,
          nascimento: piloto.nascimento ?? "",
          avatarUrl: piloto.avatarUrl,
        }}
      />
    </div>
  );
}
