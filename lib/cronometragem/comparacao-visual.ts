import {
  avaliarPublicacaoDoGrid,
  classificarPorMelhorVolta,
  type Elegibilidade,
  type LinhaPorMelhorVolta,
} from "@/lib/cronometragem/classificacao-melhor-volta";
import type {
  FaseCorrida,
  PilotoDaCorrida,
} from "@/lib/cronometragem/corridas-store";
import type { LinhaClassificacao } from "@/lib/cronometragem/motor";

// FASE 1 (modo sombra): só APRESENTAÇÃO da comparação entre a posição oficial do motor e a posição
// proposta por melhor volta. NÃO OFICIAL: nada daqui é gravado, publicado, usado para iniciar,
// encerrar ou publicar uma bateria nem para formar o grid. Reutiliza `classificarPorMelhorVolta` e
// `avaliarPublicacaoDoGrid` sem criar outra lógica de classificação.

// A comparação só faz sentido em sessões de CLASSIFICAÇÃO (tomada de tempo). Corrida e bateria
// única mantêm integralmente a ordem oficial do motor, sem painel.
export function mostrarComparacao(fase: FaseCorrida): boolean {
  return fase === "classificacao";
}

export type SituacaoNaComparacao =
  "normal" | "dnf" | "dns" | "dsq" | "sem_volta_valida";

export type MovimentoDePosicao =
  // Mesma posição nas duas.
  | "igual"
  // Sobe (posição proposta melhor que a do motor) ou desce, com o número de posições.
  | { sobe: number }
  | { desce: number }
  // Uma das duas não tem posição (DSQ, DNS, sem volta).
  | "sem_posicao";

export interface LinhaDaComparacao {
  participanteId: string;
  nome: string;
  kartNumero: string | null;
  // O kart entrou sozinho e ainda não tem o nome do piloto.
  semPilotoIdentificado: boolean;
  posicaoMotor: number | null;
  posicaoProposta: number | null;
  movimento: MovimentoDePosicao;
  melhorVoltaMs: number | null;
  segundaMelhorVoltaMs: number | null;
  situacao: SituacaoNaComparacao;
  motivoSemPosicao: LinhaPorMelhorVolta["motivo"];
  elegibilidade: Elegibilidade;
  empateAbsoluto: boolean;
}

export interface ComparacaoDeClassificacao {
  // Na ordem da posição proposta (as linhas sem posição, no fim).
  linhas: LinhaDaComparacao[];
  quantasDiferem: number;
  pendenciasDeRegulamento: string[];
  // Só avaliação do que a publicação do grid exigiria; nada é formado nem publicado.
  grid: {
    publicacaoBloqueada: boolean;
    bloqueios: string[];
    pendencias: string[];
  };
}

function situacaoDe(
  proposta: LinhaPorMelhorVolta,
  motor: LinhaClassificacao,
): SituacaoNaComparacao {
  if (proposta.estado === "dsq") return "dsq";
  if (proposta.estado === "dns") return "dns";
  if (motor.situacao === "dnf") return "dnf";
  if (proposta.estado === "sem_volta_valida") return "sem_volta_valida";
  return "normal";
}

function movimento(
  motor: number | null,
  proposta: number | null,
): MovimentoDePosicao {
  if (motor === null || proposta === null) return "sem_posicao";
  if (motor === proposta) return "igual";
  return proposta < motor
    ? { sobe: motor - proposta }
    : { desce: proposta - motor };
}

export function compararComOMotor(
  classificacao: LinhaClassificacao[],
  grid: Pick<PilotoDaCorrida, "id" | "nomeado">[],
): ComparacaoDeClassificacao {
  const resultado = classificarPorMelhorVolta(classificacao);
  const porId = new Map(classificacao.map((l) => [l.participanteId, l]));
  const semNome = new Set(grid.filter((p) => !p.nomeado).map((p) => p.id));
  const linhas = resultado.linhas.map((p): LinhaDaComparacao => {
    const motor = porId.get(p.participanteId)!;
    return {
      participanteId: p.participanteId,
      nome: p.nome,
      kartNumero: p.kartNumero,
      semPilotoIdentificado: semNome.has(p.participanteId),
      posicaoMotor: motor.posicao,
      posicaoProposta: p.posicao,
      movimento: movimento(motor.posicao, p.posicao),
      melhorVoltaMs: p.voltasValidasMs[0] ?? null,
      segundaMelhorVoltaMs: p.voltasValidasMs[1] ?? null,
      situacao: situacaoDe(p, motor),
      motivoSemPosicao: p.motivo,
      elegibilidade: p.elegibilidade,
      empateAbsoluto: p.empateAbsoluto,
    };
  });
  const publicacao = avaliarPublicacaoDoGrid(resultado);
  return {
    linhas,
    quantasDiferem: linhas.filter(
      (l) => l.movimento !== "igual" && l.movimento !== "sem_posicao",
    ).length,
    pendenciasDeRegulamento: resultado.pendenciasDeRegulamento,
    grid: {
      publicacaoBloqueada: !publicacao.podePublicar,
      bloqueios: publicacao.bloqueios,
      pendencias: publicacao.pendencias,
    },
  };
}

// Destaque visual de cada linha (só apresentação, nunca alerta de falha). Uma linha pode ter mais de
// uma marca; `principal` define a cor da borda, por precedência: DSQ, DNS, sem volta válida, empate
// absoluto, DNF com elegibilidade pendente, subiria, perderia posições, sem diferença.
export type Destaque =
  | "dsq"
  | "dns"
  | "sem_volta_valida"
  | "empate"
  | "dnf_pendente"
  | "sobe"
  | "desce"
  | "igual";

export function destaquesDaLinha(l: LinhaDaComparacao): {
  principal: Destaque;
  marcas: Destaque[];
} {
  const marcas: Destaque[] = [];
  if (l.situacao === "dsq") marcas.push("dsq");
  if (l.situacao === "dns") marcas.push("dns");
  if (l.situacao === "sem_volta_valida") marcas.push("sem_volta_valida");
  if (l.empateAbsoluto) marcas.push("empate");
  if (l.situacao === "dnf" && l.elegibilidade === "depende_do_regulamento") {
    marcas.push("dnf_pendente");
  }
  const m = l.movimento;
  if (typeof m === "object" && "sobe" in m) marcas.push("sobe");
  if (typeof m === "object" && "desce" in m) marcas.push("desce");
  return { principal: marcas[0] ?? "igual", marcas };
}
