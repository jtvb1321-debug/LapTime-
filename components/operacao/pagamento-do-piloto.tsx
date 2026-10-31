import { Campo, FormAcao, Selecao } from "@/components/operacao/form-acao";
import { StatusPill } from "@/components/ui/status-pill";
import { pagamentoAction } from "@/lib/operacao-actions";
import type { FormaPagamento } from "@/lib/operacao/caixa-store";
import type { PagamentoDoPiloto } from "@/lib/operacao/pagamento-pilotos";
import { centavosParaCampo, formatarReais } from "@/lib/operacao/tempo";

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
};

// Ao lado do nome do piloto: pago ou não, e a forma de pagamento.
export function ChipPagamento({
  pagamento,
}: {
  pagamento?: PagamentoDoPiloto;
}) {
  if (!pagamento) return null;
  const formas = pagamento.formas.map((f) => ROTULO_FORMA[f]).join(" + ");
  if (pagamento.situacao === "pago") {
    return (
      <StatusPill tone="ink">
        {pagamento.devidoCentavos === 0 ? "Sem cobrança" : `Pago · ${formas}`}
      </StatusPill>
    );
  }
  if (pagamento.situacao === "parcial") {
    return (
      <StatusPill tone="orange">
        Parcial {formatarReais(pagamento.pagoCentavos)} de{" "}
        {formatarReais(pagamento.devidoCentavos)}
        {formas ? ` · ${formas}` : ""}
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="orange">
      A pagar {formatarReais(pagamento.devidoCentavos)}
    </StatusPill>
  );
}

// Recebe o que falta deste piloto (no caixa aberto).
export function ReceberDoPiloto({
  reservaId,
  reservaPilotoId,
  pagamento,
  caixaEstaAberto,
}: {
  reservaId: string;
  reservaPilotoId: string;
  pagamento?: PagamentoDoPiloto;
  caixaEstaAberto: boolean;
}) {
  if (!pagamento || pagamento.situacao === "pago") return null;
  const falta = pagamento.devidoCentavos - pagamento.pagoCentavos;
  if (!caixaEstaAberto) {
    return <p className="text-ink-3 text-xs">Abra o caixa para receber.</p>;
  }
  return (
    <details className="min-w-0">
      <summary className="text-orange-ink cursor-pointer text-sm font-medium">
        Receber {formatarReais(falta)}
      </summary>
      <FormAcao
        action={pagamentoAction}
        rotulo="Registrar pagamento"
        className="mt-3 max-w-xs"
      >
        <input type="hidden" name="reservaId" value={reservaId} />
        <input type="hidden" name="reservaPilotoId" value={reservaPilotoId} />
        <Selecao
          id={`forma-${reservaPilotoId}`}
          name="forma"
          rotulo="Forma de pagamento"
          defaultValue=""
        >
          <option value="" disabled>
            Escolha…
          </option>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">Pix</option>
          <option value="cartao">Cartão</option>
        </Selecao>
        <Campo
          id={`valor-${reservaPilotoId}`}
          name="valor"
          rotulo="Valor (R$)"
          defaultValue={centavosParaCampo(falta)}
          inputMode="decimal"
        />
      </FormAcao>
    </details>
  );
}
