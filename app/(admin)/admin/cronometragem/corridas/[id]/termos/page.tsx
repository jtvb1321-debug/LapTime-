import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TermosDaBateria } from "@/components/cronometragem/termos-da-bateria";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissao, ipDaRequisicao } from "@/lib/auth";
import { lerPainel } from "@/lib/cronometragem/corridas-store";
import { termosDaBateria } from "@/lib/cronometragem/termos-da-bateria";
import { pode } from "@/lib/permissoes";
import { urlPublica } from "@/lib/url-publica";

export const metadata: Metadata = { title: "Termos da bateria" };
export const dynamic = "force-dynamic";

// Os termos também aparecem direto na tela da bateria; esta página é a mesma
// lista, para abrir em tela cheia (por exemplo, no tablet do balcão).
export default async function TermosDaBateriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeOperar = pode(sessao.papel, "sessao.operar");

  const { id } = await params;
  const painel = await lerPainel(id);
  if (!painel) notFound();
  const base = await urlPublica();
  const termos = await termosDaBateria(
    painel,
    base,
    podeOperar
      ? { usuarioId: sessao.id, ip: await ipDaRequisicao() }
      : undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Termos de responsabilidade"
        description={`${painel.corrida.nome}: cada piloto lê o QR ou abre o link e assina com o dedo no celular.`}
      />
      <Link
        href={`/admin/cronometragem/corridas/${id}`}
        className="text-orange-ink text-sm font-medium hover:underline"
      >
        ← Voltar para a bateria
      </Link>
      {!process.env.URL_PUBLICA && /localhost|127\./.test(base) ? (
        <p className="border-border bg-surface text-ink-2 rounded-md border px-4 py-3 text-sm">
          Este sistema está aberto em <b>{base}</b>, que só funciona neste
          computador. Para o cliente abrir o link no celular, configure a
          variável <code>URL_PUBLICA</code> com o endereço real do sistema.
        </p>
      ) : null}
      {termos.length === 0 ? (
        <p className="text-ink-3 text-sm">
          Nenhum piloto cadastrado nesta bateria ainda.
        </p>
      ) : (
        <TermosDaBateria itens={termos} />
      )}
    </div>
  );
}
