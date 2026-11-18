import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoImprimir } from "@/components/operacao/botao-imprimir";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { exigirPermissao } from "@/lib/auth";
import {
  lerCaixa,
  lerMovimentos,
  resumoDoCaixa,
} from "@/lib/operacao/caixa-store";
import { formatarDataHora, formatarReais } from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Comprovante de caixa" };
export const dynamic = "force-dynamic";

const FORMA = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão" };
const TIPO = {
  pagamento: "Pagamento",
  estorno: "Estorno",
  suprimento: "Suprimento",
  sangria: "Sangria",
};

export default async function ComprovanteDeCaixaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await exigirPermissao("caixa.operar"))) return <SemPermissao />;
  const { id } = await params;
  const caixa = await lerCaixa(id);
  if (!caixa) notFound();
  const [resumo, movimentos] = await Promise.all([
    resumoDoCaixa(caixa),
    lerMovimentos(id),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/operacao/caixa"
          className="text-ink-2 hover:text-orange-ink text-sm"
        >
          ← Voltar ao caixa
        </Link>
        <BotaoImprimir />
      </div>

      <div>
        <h1 className="text-ink text-xl font-semibold">
          Comprovante de{" "}
          {caixa.fechadoEm ? "fechamento de caixa" : "caixa (aberto)"}
        </h1>
        <p className="text-ink-2 mt-1 text-sm">
          Aberto em {formatarDataHora(caixa.abertoEm)}
          {caixa.fechadoEm
            ? ` · fechado em ${formatarDataHora(caixa.fechadoEm)}`
            : " · ainda não fechado"}
        </p>
      </div>

      <table className="w-full text-sm">
        <tbody className="divide-border divide-y">
          <Linha
            rotulo="Fundo de troco"
            valor={formatarReais(caixa.fundoCentavos)}
          />
          <Linha
            rotulo="Dinheiro recebido"
            valor={formatarReais(resumo.recebido.dinheiro)}
          />
          <Linha
            rotulo="Pix recebido"
            valor={formatarReais(resumo.recebido.pix)}
          />
          <Linha
            rotulo="Cartão recebido"
            valor={formatarReais(resumo.recebido.cartao)}
          />
          <Linha
            rotulo="Total recebido (líquido)"
            valor={formatarReais(resumo.totalRecebido)}
            forte
          />
          <Linha
            rotulo="Suprimentos"
            valor={formatarReais(resumo.suprimentos)}
          />
          <Linha
            rotulo="Sangrias"
            valor={`− ${formatarReais(resumo.sangrias)}`}
          />
          <Linha
            rotulo="Dinheiro esperado na gaveta"
            valor={formatarReais(
              caixa.esperadoDinheiroCentavos ?? resumo.esperadoDinheiro,
            )}
            forte
          />
          {caixa.fechadoEm ? (
            <>
              <Linha
                rotulo="Dinheiro contado"
                valor={formatarReais(caixa.contadoDinheiroCentavos ?? 0)}
              />
              <Linha
                rotulo="Diferença"
                valor={formatarReais(caixa.diferencaCentavos ?? 0)}
                forte
              />
            </>
          ) : null}
        </tbody>
      </table>
      {caixa.observacao ? (
        <p className="text-ink-2 text-sm">
          <span className="text-ink font-medium">Observação:</span>{" "}
          {caixa.observacao}
        </p>
      ) : null}

      <div>
        <h2 className="text-ink mb-2 text-sm font-semibold">Movimentos</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-border text-ink-3 border-b text-xs uppercase">
              <th className="py-2 font-medium">Hora</th>
              <th className="py-2 font-medium">Tipo</th>
              <th className="py-2 font-medium">Forma</th>
              <th className="py-2 font-medium">Cliente / motivo</th>
              <th className="py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {[...movimentos].reverse().map((m) => (
              <tr key={m.id}>
                <td className="py-2">{formatarDataHora(m.criadoEm)}</td>
                <td className="py-2">{TIPO[m.tipo]}</td>
                <td className="py-2">{FORMA[m.forma]}</td>
                <td className="py-2">{m.clienteNome ?? m.descricao ?? ""}</td>
                <td className="font-display py-2 text-right text-base">
                  {m.tipo === "estorno" || m.tipo === "sangria" ? "− " : ""}
                  {formatarReais(m.valorCentavos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-center text-xs">
        <div className="border-ink border-t pt-2">Responsável pelo caixa</div>
        <div className="border-ink border-t pt-2">Conferência (gerência)</div>
      </div>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  forte,
}: {
  rotulo: string;
  valor: string;
  forte?: boolean;
}) {
  return (
    <tr className={forte ? "font-semibold" : undefined}>
      <td className="text-ink py-2">{rotulo}</td>
      <td className="font-display py-2 text-right text-base">{valor}</td>
    </tr>
  );
}
