import type {
  LinhaPorMelhorVolta,
  ResultadoPorMelhorVolta,
} from "@/lib/cronometragem/classificacao-melhor-volta";

// PRÉVIA DO GRID pela classificação por melhor volta. Função pura e só de leitura: NÃO forma, NÃO
// grava e NÃO publica o grid (a publicação pela nova regra não está habilitada nesta etapa; o grid
// continua sendo criado pela regra atual em `criarCorridaDaClassificacao`).
//
// Separa POSIÇÃO CLASSIFICATÓRIA (pode ser compartilhada: 1, 2, 2, 4) de POSIÇÃO FÍSICA de largada
// (precisa ser única). Uma posição física só é atribuída quando não depende de nenhuma decisão:
//  - empate absoluto entre quem largaria: as vagas ficam "a decidir";
//  - DNF com voltas válidas e quem não tem volta válida: elegibilidade pendente (regulamento);
//  - depois do primeiro item pendente, as posições físicas seguintes também aguardam, porque
//    dependem do que for decidido antes;
//  - DSQ e DNS ficam fora do grid (exceção só com regra regulamentar e autorização específica).
// Penalidades: a penalidade em tempo existente não altera a melhor volta; é mostrada como informação.

export type EstadoDaVaga =
  | "definida"
  | "a_decidir_empate"
  | "pendente_elegibilidade"
  | "aguarda_decisoes_anteriores";

export interface VagaDoGrid {
  participanteId: string;
  nome: string;
  kartNumero: string | null;
  posicaoClassificatoria: number | null;
  posicaoFisica: number | null;
  estado: EstadoDaVaga;
  melhorVoltaMs: number | null;
  penalidadeMs: number;
  observacao: string;
}

export interface ExcluidoDoGrid {
  participanteId: string;
  nome: string;
  kartNumero: string | null;
  motivo: "DSQ" | "DNS";
}

export type TipoDeDecisao = "empate_absoluto" | "elegibilidade";

export interface DecisaoNecessaria {
  tipo: TipoDeDecisao;
  participantes: string[];
  descricao: string;
  // O que a decisão exigirá quando a publicação for habilitada.
  exige: string[];
}

export interface PreviaDoGrid {
  vagas: VagaDoGrid[];
  excluidos: ExcluidoDoGrid[];
  decisoes: DecisaoNecessaria[];
  // Sem decisões pendentes, a prévia estaria completa; mesmo assim a publicação pela nova regra
  // não está habilitada nesta etapa.
  completa: boolean;
  publicacaoHabilitada: false;
  motivosDoBloqueio: string[];
}

export const EXIGENCIAS_DA_DECISAO = [
  "Autorização de quem pode homologar resultados (permissão resultado.homologar)",
  "Justificativa escrita, com o critério regulamentar aplicado",
  "Registro em auditoria (quem decidiu, quando, antes e depois)",
] as const;

function vaga(
  l: LinhaPorMelhorVolta,
  estado: EstadoDaVaga,
  posicaoFisica: number | null,
  observacao: string,
): VagaDoGrid {
  return {
    participanteId: l.participanteId,
    nome: l.nome,
    kartNumero: l.kartNumero,
    posicaoClassificatoria: l.posicao,
    posicaoFisica,
    estado,
    melhorVoltaMs: l.estado === "classificado" ? l.melhorVoltaMs : null,
    penalidadeMs: l.penalidadeMs,
    observacao,
  };
}

export function previaDoGrid(resultado: ResultadoPorMelhorVolta): PreviaDoGrid {
  const vagas: VagaDoGrid[] = [];
  const decisoes: DecisaoNecessaria[] = [];
  const excluidos: ExcluidoDoGrid[] = resultado.linhas
    .filter((l) => l.estado === "dsq" || l.estado === "dns")
    .map((l) => ({
      participanteId: l.participanteId,
      nome: l.nome,
      kartNumero: l.kartNumero,
      motivo: l.estado === "dsq" ? ("DSQ" as const) : ("DNS" as const),
    }));

  const classificados = resultado.linhas.filter(
    (l) => l.estado === "classificado",
  );
  // Agrupa por posição classificatória (empates absolutos juntos).
  const grupos: LinhaPorMelhorVolta[][] = [];
  for (const l of classificados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[0].posicao === l.posicao) ultimo.push(l);
    else grupos.push([l]);
  }

  let proxima = 1;
  let bloqueadoAntes = false;
  for (const grupo of grupos) {
    const inicio = proxima;
    const fim = proxima + grupo.length - 1;
    if (grupo.length > 1) {
      for (const l of grupo) {
        vagas.push(
          vaga(
            l,
            "a_decidir_empate",
            null,
            `Empate absoluto na posição ${l.posicao}: posições físicas ${inicio} a ${fim} a decidir.`,
          ),
        );
      }
      decisoes.push({
        tipo: "empate_absoluto",
        participantes: grupo.map((l) => l.nome),
        descricao: `Empate absoluto na posição classificatória ${grupo[0].posicao} (mesma sequência e número de voltas válidas). Definir a ordem física de largada entre ${grupo.map((l) => l.nome).join(", ")}.`,
        exige: [...EXIGENCIAS_DA_DECISAO],
      });
      bloqueadoAntes = true;
    } else {
      const l = grupo[0];
      if (l.elegibilidade === "depende_do_regulamento") {
        vagas.push(
          vaga(
            l,
            "pendente_elegibilidade",
            null,
            `${l.ocorrencia === "dnf" ? "DNF com voltas válidas" : "Elegibilidade"}: precisa de decisão para largar.`,
          ),
        );
        decisoes.push({
          tipo: "elegibilidade",
          participantes: [l.nome],
          descricao: `${l.nome}: ${l.ocorrencia === "dnf" ? "DNF com voltas válidas" : "elegibilidade pendente"}; decidir se larga e em que posição física.`,
          exige: [...EXIGENCIAS_DA_DECISAO],
        });
        bloqueadoAntes = true;
      } else if (bloqueadoAntes) {
        vagas.push(
          vaga(
            l,
            "aguarda_decisoes_anteriores",
            null,
            "A posição física depende das decisões pendentes acima.",
          ),
        );
      } else {
        vagas.push(vaga(l, "definida", inicio, ""));
      }
    }
    proxima = fim + 1;
  }

  // Quem não tem volta válida: elegibilidade pendente, sem posição física.
  for (const l of resultado.linhas.filter(
    (x) => x.estado === "sem_volta_valida",
  )) {
    vagas.push(
      vaga(
        l,
        "pendente_elegibilidade",
        null,
        "Sem volta válida: se e onde larga depende do regulamento.",
      ),
    );
    decisoes.push({
      tipo: "elegibilidade",
      participantes: [l.nome],
      descricao: `${l.nome}: sem volta válida; decidir se larga e em que posição física.`,
      exige: [...EXIGENCIAS_DA_DECISAO],
    });
  }

  const motivosDoBloqueio = [
    ...(decisoes.length > 0
      ? [`${decisoes.length} decisão(ões) autorizada(s) pendente(s).`]
      : []),
    "A publicação do grid pela nova regra não está habilitada nesta etapa; o grid continua sendo criado pela regra atual.",
  ];

  return {
    vagas,
    excluidos,
    decisoes,
    completa: decisoes.length === 0,
    publicacaoHabilitada: false,
    motivosDoBloqueio,
  };
}
