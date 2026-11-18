import type { Metadata } from "next";
import Image from "next/image";
import { AssinaturaDigital } from "@/components/termo/assinatura-digital";
import { lerConvite } from "@/lib/operacao/termo-store";

export const metadata: Metadata = {
  title: "Termo de responsabilidade",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="border-border bg-surface rounded-lg border p-6 text-center">
      <p className="text-ink text-lg font-semibold">{titulo}</p>
      <p className="text-ink-2 mt-2 text-sm">{texto}</p>
    </div>
  );
}

// Página pública: o cliente abre o link recebido, lê o termo e assina.
export default async function AssinarTermoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const convite = await lerConvite(token);

  return (
    <div className="bg-bg min-h-screen">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
        <Image
          src="/logo-gridlap.svg"
          unoptimized
          alt="Grid Lap"
          width={2000}
          height={667}
          className="h-9 w-auto self-start"
          priority
        />
        {convite.estado === "invalido" ? (
          <Aviso
            titulo="Link inválido"
            texto="Confira o link que você recebeu ou peça um novo à equipe."
          />
        ) : convite.estado === "usado" ? (
          <Aviso
            titulo="Termo já assinado"
            texto="Este link já foi usado. Não precisa assinar de novo."
          />
        ) : convite.estado === "expirado" ? (
          <Aviso
            titulo="Link vencido"
            texto="Peça um novo link à equipe do kartódromo."
          />
        ) : (
          <>
            <div>
              <p className="text-ink-3 text-sm">
                Cadastro nº {convite.cliente.numero}
              </p>
              <h1 className="text-ink text-xl font-semibold">
                {convite.cliente.nome}
              </h1>
              <p className="text-ink-2 mt-1 text-sm">
                Leia o termo de responsabilidade e assine para poder pilotar.
              </p>
            </div>
            <section
              aria-label="Texto do termo"
              className="border-border bg-surface text-ink max-h-80 overflow-y-auto rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-line"
            >
              {convite.termo.texto}
            </section>
            <AssinaturaDigital
              token={token}
              termoVersao={convite.termo.versao}
              nomeDoPiloto={convite.cliente.nome}
              menor={convite.cliente.menor}
            />
          </>
        )}
      </main>
    </div>
  );
}
