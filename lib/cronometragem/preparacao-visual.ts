import type { Kart } from "@/lib/cronometragem/cadastros-store";
import type { PilotoDaCorrida } from "@/lib/cronometragem/corridas-store";
import {
  pendenciasDoPiloto,
  type Pendencia,
  type TipoPendencia,
} from "@/lib/cronometragem/pendencias";

// Funções PURAS que só organizam, para a tela de preparação, dados que o sistema
// já calcula. Nenhuma regra nova: o que impede a largada continua sendo o que
// `pendenciasDoPiloto` já descreve (termo, kart, sensor e vaga impedem; pagamento
// e check-in apenas avisam). Nada aqui lê banco, sorteia karts ou toca em sensores.

export type EstadoDaExigencia = "ok" | "falta" | "aviso" | "nao-se-aplica";

export interface ExigenciasDoPiloto {
  termo: EstadoDaExigencia;
  pagamento: EstadoDaExigencia;
  kart: EstadoDaExigencia;
  sensor: EstadoDaExigencia;
  checkin: EstadoDaExigencia;
}

const TIPOS_QUE_IMPEDEM: ReadonlySet<TipoPendencia> = new Set([
  "vaga",
  "termo",
  "kart",
  "transponder",
]);

export function impedeLargar(tipo: TipoPendencia): boolean {
  return TIPOS_QUE_IMPEDEM.has(tipo);
}

export interface LinhaDeProntidao {
  piloto: PilotoDaCorrida;
  pendencias: Pendencia[];
  exigencias: ExigenciasDoPiloto;
  // Há alguma pendência que impede a largada.
  bloqueado: boolean;
  // Nenhuma pendência, nem aviso.
  completo: boolean;
}

export function exigenciasDoPiloto(p: PilotoDaCorrida): ExigenciasDoPiloto {
  if (p.vaga) {
    return {
      termo: "nao-se-aplica",
      pagamento: "nao-se-aplica",
      kart: "nao-se-aplica",
      sensor: "nao-se-aplica",
      checkin: "nao-se-aplica",
    };
  }
  return {
    termo: p.termo === "valido" ? "ok" : "falta",
    // Sem lançamento de pagamento (bateria avulsa) não há o que cobrar aqui.
    pagamento: !p.pagamento
      ? "nao-se-aplica"
      : p.pagamento.situacao === "pago"
        ? "ok"
        : "aviso",
    kart: p.kartNumero ? "ok" : "falta",
    sensor: !p.kartNumero ? "nao-se-aplica" : p.transponder ? "ok" : "falta",
    checkin: p.presenteEm ? "ok" : "aviso",
  };
}

export function linhaDeProntidao(p: PilotoDaCorrida): LinhaDeProntidao {
  const pendencias = pendenciasDoPiloto(p);
  return {
    piloto: p,
    pendencias,
    exigencias: exigenciasDoPiloto(p),
    bloqueado: pendencias.some((x) => impedeLargar(x.tipo)),
    completo: pendencias.length === 0,
  };
}

// Matriz de prontidão: quem tem pendência vem primeiro (os que impedem antes dos
// que só avisam); quem já está completo fica no fim, sem destaque. A ordem original
// (cadastro) é mantida dentro de cada grupo.
export function matrizDeProntidao(grid: PilotoDaCorrida[]): LinhaDeProntidao[] {
  const linhas = grid.map(linhaDeProntidao);
  const peso = (l: LinhaDeProntidao) => (l.bloqueado ? 0 : l.completo ? 2 : 1);
  return linhas
    .map((l, i) => ({ l, i }))
    .sort((a, b) => peso(a.l) - peso(b.l) || a.i - b.i)
    .map((x) => x.l);
}

export interface ResumoDeProntidao {
  total: number;
  completos: number;
  // Podem ir ao kart (sem pendência que impeça), ainda que com aviso.
  aptos: number;
  bloqueados: number;
  vagas: number;
  porTipo: Record<TipoPendencia, number>;
}

export function resumoDeProntidao(grid: PilotoDaCorrida[]): ResumoDeProntidao {
  const linhas = grid.map(linhaDeProntidao);
  const porTipo: Record<TipoPendencia, number> = {
    vaga: 0,
    termo: 0,
    pagamento: 0,
    checkin: 0,
    kart: 0,
    transponder: 0,
  };
  for (const l of linhas) for (const p of l.pendencias) porTipo[p.tipo]++;
  return {
    total: linhas.length,
    completos: linhas.filter((l) => l.completo).length,
    aptos: linhas.filter((l) => !l.bloqueado).length,
    bloqueados: linhas.filter((l) => l.bloqueado).length,
    vagas: porTipo.vaga,
    porTipo,
  };
}

export type TomDaPreparacao = "vazia" | "pendente" | "pronta";

export interface SituacaoDaPreparacao {
  tom: TomDaPreparacao;
  titulo: string;
  // Só o que realmente falta, na ordem do fluxo. Vazio = nada a destacar.
  faltas: string[];
}

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

// Texto do cabeçalho: reconhece o que já está concluído e destaca só o que falta.
// Não escolhe a ação principal (isso continua sendo feito pelos botões da bateria,
// que já seguem o estado); só diz, em palavras, em que ponto a preparação está.
export function situacaoDaPreparacao(
  grid: PilotoDaCorrida[],
): SituacaoDaPreparacao {
  if (grid.length === 0) {
    return {
      tom: "vazia",
      titulo: "Nenhum piloto ainda",
      faltas: ["Cadastre os pilotos da bateria"],
    };
  }
  const r = resumoDeProntidao(grid);
  const faltas: string[] = [];
  if (r.porTipo.vaga) {
    faltas.push(
      `${plural(r.porTipo.vaga, "vaga sem piloto", "vagas sem piloto")}`,
    );
  }
  if (r.porTipo.termo) {
    faltas.push(
      `${plural(r.porTipo.termo, "termo a assinar", "termos a assinar")}`,
    );
  }
  if (r.porTipo.kart) {
    faltas.push(
      `${plural(r.porTipo.kart, "piloto sem kart", "pilotos sem kart")}`,
    );
  }
  if (r.porTipo.transponder) {
    faltas.push(
      `${plural(r.porTipo.transponder, "kart sem sensor", "karts sem sensor")}`,
    );
  }
  const avisos: string[] = [];
  if (r.porTipo.pagamento) {
    avisos.push(
      `${plural(r.porTipo.pagamento, "pagamento a receber", "pagamentos a receber")}`,
    );
  }
  if (r.porTipo.checkin) {
    avisos.push(
      `${plural(r.porTipo.checkin, "check-in a fazer", "check-ins a fazer")}`,
    );
  }
  if (r.bloqueados > 0) {
    return {
      tom: "pendente",
      titulo: `${r.aptos} de ${r.total} prontos para largar`,
      faltas: [...faltas, ...avisos],
    };
  }
  return {
    tom: "pronta",
    titulo:
      r.total === 1
        ? "Piloto pronto para largar"
        : `Todos os ${r.total} pilotos prontos para largar`,
    faltas: avisos,
  };
}

export interface PosicaoDoGrid {
  // 1, 2, 3…: posição de largada da classificação, ou ordem de cadastro.
  posicao: number;
  // Duas colunas escalonadas: pole à esquerda, segunda posição à direita, e assim por diante.
  coluna: 0 | 1;
  // Verdadeiro quando a posição veio da classificação (posicaoGrid).
  oficial: boolean;
  piloto: PilotoDaCorrida;
}

// Não calcula posição: usa a que a classificação já definiu (posicaoGrid) e, sem ela,
// a ordem de cadastro. Pilotos sem posição vão depois dos que têm.
export function posicoesDoGrid(grid: PilotoDaCorrida[]): PosicaoDoGrid[] {
  const comOrdem = grid.map((piloto, i) => ({ piloto, i }));
  comOrdem.sort((a, b) => {
    const pa = a.piloto.posicaoGrid ?? Number.POSITIVE_INFINITY;
    const pb = b.piloto.posicaoGrid ?? Number.POSITIVE_INFINITY;
    return pa === pb ? a.i - b.i : pa - pb;
  });
  return comOrdem.map(({ piloto }, idx) => ({
    posicao: idx + 1,
    coluna: (idx % 2) as 0 | 1,
    oficial: piloto.posicaoGrid !== undefined,
    piloto,
  }));
}

export type EstadoDoKartNaGaragem = "em-uso" | "livre" | "sem-sensor" | "fora";

export interface KartDaGaragem {
  kart: Kart;
  estado: EstadoDoKartNaGaragem;
  // Piloto desta bateria que está com o kart.
  piloto?: PilotoDaCorrida;
  texto: string;
}

const porNumero = (a: Kart, b: Kart) =>
  a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });

export function garagemDaBateria(
  karts: Kart[],
  grid: PilotoDaCorrida[],
): KartDaGaragem[] {
  const comKart = new Map<string, PilotoDaCorrida>();
  for (const p of grid) {
    if (p.kartId) comKart.set(p.kartId, p);
  }
  return [...karts].sort(porNumero).map((kart) => {
    const piloto = comKart.get(kart.id);
    if (kart.status !== "ativo") {
      return {
        kart,
        estado: "fora" as const,
        piloto,
        texto: kart.status === "manutencao" ? "Em manutenção" : "Inativo",
      };
    }
    if (piloto) {
      return {
        kart,
        estado: "em-uso" as const,
        piloto,
        texto: piloto.nome,
      };
    }
    if (!kart.transponderFixo) {
      return { kart, estado: "sem-sensor" as const, texto: "Sem sensor" };
    }
    return { kart, estado: "livre" as const, texto: "Livre" };
  });
}

export interface ResumoDaGaragem {
  total: number;
  emUso: number;
  livres: number;
  semSensor: number;
  fora: number;
  // Karts a mais ou a menos do que pilotos: ajuda a ver se o sorteio cabe.
  sobramParaSortear: number;
}

export function resumoDaGaragem(
  itens: KartDaGaragem[],
  grid: PilotoDaCorrida[],
): ResumoDaGaragem {
  const conta = (e: EstadoDoKartNaGaragem) =>
    itens.filter((i) => i.estado === e).length;
  const livres = conta("livre");
  const semKart = grid.filter((p) => !p.vaga && !p.kartNumero).length;
  return {
    total: itens.length,
    emUso: conta("em-uso"),
    livres,
    semSensor: conta("sem-sensor"),
    fora: conta("fora"),
    sobramParaSortear: livres - semKart,
  };
}

// Pilotos que ainda não têm kart (os que o sorteio vai atender).
export function pilotosSemKart(grid: PilotoDaCorrida[]): PilotoDaCorrida[] {
  return grid.filter((p) => !p.vaga && !p.kartNumero);
}
