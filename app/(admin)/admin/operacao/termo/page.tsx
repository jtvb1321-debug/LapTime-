import type { Metadata } from "next";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { FormAcao } from "@/components/operacao/form-acao";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissao } from "@/lib/auth";
import { publicarTermoAction } from "@/lib/operacao-actions";
import {
  contarAceitesDaVersao,
  termoAtual,
  TERMO_MODELO,
  VALIDADE_ACEITE_DIAS,
} from "@/lib/operacao/termo-store";
import { formatarDataHora } from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Termo de responsabilidade" };
export const dynamic = "force-dynamic";

export default async function TermoPage() {
  if (!(await exigirPermissao("termo.editar"))) return <SemPermissao />;
  const termo = await termoAtual();
  const n = await contarAceitesDaVersao(termo.id);
  const ehModelo = termo.texto === TERMO_MODELO;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Termo de responsabilidade"
        description={`Versão ${termo.versao}, publicada em ${formatarDataHora(termo.criadoEm)} · ${n} cliente(s) assinaram esta versão`}
      />

      {ehModelo ? (
        <Card>
          <CardBody>
            <p className="text-ink text-sm font-medium">
              Este é o texto-modelo do sistema, não um termo validado.
            </p>
            <p className="text-ink-2 mt-1 text-sm">
              Revise com o jurídico e com a seguradora do kartódromo e publique
              a versão oficial abaixo antes de usar com clientes.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-ink text-sm font-semibold">
            Publicar nova versão
          </h2>
        </CardHeader>
        <CardBody>
          <FormAcao
            action={publicarTermoAction}
            rotulo="Publicar nova versão"
            limpar={false}
          >
            <label htmlFor="texto" className="text-ink text-sm font-medium">
              Texto do termo
            </label>
            <textarea
              id="texto"
              name="texto"
              rows={16}
              required
              defaultValue={termo.texto}
              className="border-border-strong bg-surface text-ink focus:border-orange w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
            <p className="text-ink-3 text-xs">
              Versões antigas ficam guardadas e nunca são alteradas. Ao
              publicar, todos os clientes precisam assinar de novo. Cada
              assinatura vale por {VALIDADE_ACEITE_DIAS} dias.
            </p>
          </FormAcao>
        </CardBody>
      </Card>
    </div>
  );
}
