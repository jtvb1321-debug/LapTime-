import type { FormaPagamento } from "@/lib/operacao/caixa-store";

// Quanto cada piloto da reserva deve e já pagou, e como. O valor da reserva é
// dividido igualmente entre os pilotos (os centavos que sobram vão para os
// primeiros). Um pagamento lançado para um piloto cobre aquele piloto; o que
// foi lançado para a reserva toda cobre os pilotos na ordem do cadastro.

export interface MovimentoDePagamento {
  id: number;
  tipo: "pagamento" | "estorno";
  forma: FormaPagamento;
  valorCentavos: number;
  // Piloto a quem o pagamento foi atribuído (null = reserva toda).
  pilotoId: string | null;
  // Para estornos: o pagamento estornado.
  estornoDe: number | null;
}

export interface PilotoParaCobranca {
  id: string;
  ordem: number;
}

export type SituacaoDePagamento = "pago" | "parcial" | "a_pagar";

export interface PagamentoDoPiloto {
  devidoCentavos: number;
  pagoCentavos: number;
  situacao: SituacaoDePagamento;
  // Formas que cobriram este piloto (ex.: ["pix"] ou ["dinheiro", "cartao"]).
  formas: FormaPagamento[];
}

// Parte de cada posição (0 = 1º piloto): divisão exata com os centavos
// sobrando para os primeiros.
export function parteDaReserva(
  valorCentavos: number,
  pilotos: number,
  posicao: number,
): number {
  if (pilotos <= 0) return 0;
  const base = Math.floor(valorCentavos / pilotos);
  const resto = valorCentavos - base * pilotos;
  return base + (posicao < resto ? 1 : 0);
}

export function pagamentoDosPilotos(
  reserva: { valorCentavos: number; pilotos: number },
  pilotos: PilotoParaCobranca[],
  movimentos: MovimentoDePagamento[],
): Map<string, PagamentoDoPiloto> {
  const ordenados = [...pilotos].sort((a, b) => a.ordem - b.ordem);

  // Pagamentos líquidos (valor − estornos), na ordem em que foram lançados.
  const estornado = new Map<number, number>();
  for (const m of movimentos) {
    if (m.tipo === "estorno" && m.estornoDe !== null) {
      estornado.set(
        m.estornoDe,
        (estornado.get(m.estornoDe) ?? 0) + m.valorCentavos,
      );
    }
  }
  const liquidos = movimentos
    .filter((m) => m.tipo === "pagamento")
    .sort((a, b) => a.id - b.id)
    .map((m) => ({
      ...m,
      liquido: m.valorCentavos - (estornado.get(m.id) ?? 0),
    }))
    .filter((m) => m.liquido > 0);

  const resultado = new Map<string, PagamentoDoPiloto>();
  ordenados.forEach((p, posicao) => {
    resultado.set(p.id, {
      devidoCentavos: parteDaReserva(
        reserva.valorCentavos,
        reserva.pilotos,
        posicao,
      ),
      pagoCentavos: 0,
      situacao: "a_pagar",
      formas: [],
    });
  });
  const somar = (id: string, valor: number, forma: FormaPagamento) => {
    const r = resultado.get(id);
    if (!r || valor <= 0) return;
    r.pagoCentavos += valor;
    if (!r.formas.includes(forma)) r.formas.push(forma);
  };

  // 1) o que foi atribuído ao próprio piloto
  for (const m of liquidos) {
    if (m.pilotoId) somar(m.pilotoId, m.liquido, m.forma);
  }
  // 2) o que foi pago pela reserva cobre quem ainda deve, na ordem
  for (const m of liquidos.filter((x) => !x.pilotoId)) {
    let sobra = m.liquido;
    for (const p of ordenados) {
      if (sobra <= 0) break;
      const r = resultado.get(p.id)!;
      const falta = r.devidoCentavos - r.pagoCentavos;
      if (falta <= 0) continue;
      const parte = Math.min(falta, sobra);
      somar(p.id, parte, m.forma);
      sobra -= parte;
    }
  }
  for (const r of resultado.values()) {
    r.situacao =
      r.devidoCentavos > 0 && r.pagoCentavos >= r.devidoCentavos
        ? "pago"
        : r.pagoCentavos > 0
          ? "parcial"
          : "a_pagar";
    if (r.devidoCentavos === 0) r.situacao = "pago";
  }
  return resultado;
}
