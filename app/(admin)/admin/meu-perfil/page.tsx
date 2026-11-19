import type { Metadata } from "next";
import { EditarPerfilForm } from "@/components/pilotos/editar-perfil-form";
import { EnviarApresentacao } from "@/components/pilotos/enviar-apresentacao";
import { PageHeader } from "@/components/ui/page-header";
import { lerApresentacao } from "@/lib/apresentacao-store";
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

  const apresentacao = await lerApresentacao(piloto.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meu perfil"
        description="Atualize seu nome, número, data de nascimento e fotos. O número é só seu: dois pilotos não podem ter o mesmo."
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
      <section
        aria-labelledby="macacao-titulo"
        className="flex max-w-xl flex-col gap-3"
      >
        <h2 id="macacao-titulo" className="text-ink text-base font-semibold">
          Foto de macacão
        </h2>
        <p className="text-ink-2 text-sm">
          É a foto de corpo inteiro do seu vídeo de apresentação (o &ldquo;card
          do piloto&rdquo; que aparece no seu perfil público). Escolha a foto,
          confira a prévia e clique em Criar meu vídeo — só então o card é
          gerado.
        </p>
        <EnviarApresentacao
          numero={piloto.numero}
          nome={piloto.nome}
          corDestaque={piloto.corNumero ?? "#facc15"}
          corFaixa={piloto.corAssinatura ?? "#f2f5f7"}
          temVideo={Boolean(apresentacao)}
          slug={piloto.slug}
        />
      </section>
    </div>
  );
}
