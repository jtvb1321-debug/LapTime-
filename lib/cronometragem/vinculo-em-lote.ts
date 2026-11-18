// Vínculo de sensores em lote (tela Pista): todos os sensores são passados de uma vez e cada um
// recebe um número de kart; os que ficam sem número são a reserva. Aqui fica só a regra, sem banco:
// quem grava é a ação, usando as mesmas funções do cadastro de karts.

export interface SensorLido {
  codigo: string;
  ultimaLeituraMs: number | null;
}

export interface KartDoLote {
  id: string;
  numero: string;
  // Sensor em uso no kart, se houver.
  sensor?: string;
}

export interface PedidoDeVinculo {
  codigo: string;
  // Número do kart digitado; vazio = reserva.
  numero: string;
}

export interface PlanoDeVinculo {
  // Kart que já existe, sem sensor: recebe o sensor.
  ligar: { kartId: string; numero: string; codigo: string }[];
  // Número que ainda não existe: o kart é criado já com o sensor.
  criar: { numero: string; codigo: string }[];
  // Sensores lidos que ficaram sem kart.
  reserva: string[];
  // Se houver erro, nada é gravado.
  erros: string[];
}

// Só sugere número para o que foi lido agora há pouco: sensor antigo sem kart é reserva.
export const JANELA_DA_SUGESTAO_MS = 30 * 60_000;

function comoNumero(numero: string): number | null {
  return /^\d+$/.test(numero) ? Number(numero) : null;
}

// Sugere um kart para cada sensor lido há pouco, na ordem em que passaram: primeiro os karts que
// já existem e estão sem sensor (do menor número para o maior), depois números novos em sequência.
export function sugerirNumeros(
  sensores: SensorLido[],
  karts: KartDoLote[],
  agoraMs: number,
  janelaMs = JANELA_DA_SUGESTAO_MS,
): Map<string, string> {
  const recentes = sensores
    .filter(
      (s) =>
        s.ultimaLeituraMs !== null && agoraMs - s.ultimaLeituraMs <= janelaMs,
    )
    .sort((a, b) => (a.ultimaLeituraMs ?? 0) - (b.ultimaLeituraMs ?? 0));

  const livres = karts
    .filter((k) => !k.sensor)
    .map((k) => k.numero)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  let proximo = Math.max(0, ...karts.map((k) => comoNumero(k.numero) ?? 0)) + 1;

  const sugestao = new Map<string, string>();
  for (const s of recentes) {
    const numero = livres.shift() ?? String(proximo++);
    sugestao.set(s.codigo, numero);
  }
  return sugestao;
}

// Confere os números digitados e separa o que ligar, o que criar e a reserva.
export function planejarVinculos(
  pedidos: PedidoDeVinculo[],
  karts: KartDoLote[],
): PlanoDeVinculo {
  const plano: PlanoDeVinculo = {
    ligar: [],
    criar: [],
    reserva: [],
    erros: [],
  };
  const porNumero = new Map(karts.map((k) => [k.numero, k]));
  const usados = new Map<string, string>(); // número -> sensor que o pediu

  for (const pedido of pedidos) {
    const codigo = pedido.codigo.trim();
    const numero = pedido.numero.trim();
    if (!codigo) continue;
    if (!numero) {
      plano.reserva.push(codigo);
      continue;
    }
    if (numero.length > 12) {
      plano.erros.push(`Número de kart longo demais para o sensor ${codigo}.`);
      continue;
    }
    const repetido = usados.get(numero);
    if (repetido) {
      plano.erros.push(
        `O kart ${numero} foi escolhido para dois sensores (${repetido} e ${codigo}).`,
      );
      continue;
    }
    usados.set(numero, codigo);
    const kart = porNumero.get(numero);
    if (!kart) {
      plano.criar.push({ numero, codigo });
    } else if (kart.sensor) {
      plano.erros.push(
        `O kart ${numero} já tem o sensor ${kart.sensor}. Escolha outro número ou troque o sensor no cadastro do kart.`,
      );
    } else {
      plano.ligar.push({ kartId: kart.id, numero, codigo });
    }
  }
  return plano;
}
