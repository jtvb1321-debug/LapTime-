import type { LinhaClassificacao } from "@/lib/cronometragem/motor";

// PROPOSTA (não integrada às telas, ao grid, ao banco nem a resultados): classificação por MELHOR
// VOLTA VÁLIDA como função pura sobre a classificação que o motor já entrega.
//
// Regras adotadas como configuração do GridLap, sujeitas à validação do regulamento da competição:
//  1. Ordena pela melhor volta válida.
//  2. Empate: segunda melhor volta válida; persistindo, a terceira, e assim sucessivamente.
//  3. Quando todas as voltas comparáveis são iguais, quem tem MAIS voltas válidas fica à frente.
//  4. Se a quantidade de voltas também é igual: EMPATE ABSOLUTO. Nada de ordem de cadastro,
//     identificador do piloto, chegada ou kart como desempate: as linhas dividem a posição e ficam
//     marcadas.
//  5. Numeração competitiva: 1, 2, 2, 4.
//  6. DSQ e DNS não recebem posição classificatória nem entram automaticamente no grid como
//     elegíveis (exceções dependem de regra regulamentar e de autorização específica).
//  7. Voltas inválidas não entram: o motor já as descarta em `voltasLista`.
//  8. Penalidades: só o que o sistema já suporta. A penalidade em tempo existente soma ao tempo
//     total/chegada da corrida e não altera tempos de volta; por isso NÃO muda esta ordem. É devolvida
//     apenas como informação.
//  9. Sem volta válida: situação explícita (sem sensor, não largou, sem volta fechada), sem posição.
// 10. DNF com voltas válidas pode permanecer classificado pela melhor volta (se não for DSQ e se o
//     regulamento permitir). O tratamento de DNF do motor NÃO é alterado e esta regra não vale para
//     resultados históricos.
// 11. POSIÇÃO CLASSIFICATÓRIA e ELEGIBILIDADE PARA LARGAR são coisas separadas: a posição pode ser
//     compartilhada; o grid precisa de posições físicas únicas. `avaliarPublicacaoDoGrid` diz se o
//     grid pode ser publicado ou se há empate/pendência a decidir por quem tem autorização.
//
// Não lê banco, não altera o motor, não grava nada e não forma nem publica o grid.

export type EstadoNaClassificacao =
  "classificado" | "sem_volta_valida" | "dns" | "dsq";

export type MotivoSemPosicao =
  "sem_sensor" | "nao_largou" | "sem_volta_fechada" | "dns" | "dsq";

// Elegibilidade para largar (independente da posição classificatória).
//  - elegivel: classificado sem ocorrência impeditiva;
//  - inelegivel: DSQ e DNS (exceção só com regra regulamentar e autorização específica);
//  - depende_do_regulamento: DNF e quem não tem volta válida (a proposta não decide).
export type Elegibilidade =
  "elegivel" | "inelegivel" | "depende_do_regulamento";

export interface LinhaPorMelhorVolta {
  participanteId: string;
  nome: string;
  kartNumero: string | null;
  estado: EstadoNaClassificacao;
  motivo: MotivoSemPosicao | null;
  // Posição classificatória (competitiva: 1, 2, 2, 4), compartilhada em empate absoluto.
  // Nula para quem não classifica.
  posicao: number | null;
  // Todas as voltas válidas, da mais rápida para a mais lenta.
  voltasValidasMs: number[];
  melhorVoltaMs: number | null;
  // DNF não impede a classificação por melhor volta (as voltas feitas são válidas): é só informado.
  ocorrencia: "dnf" | null;
  // Informativo: a regra existente soma esta penalidade ao tempo total; não afeta a melhor volta.
  penalidadeMs: number;
  elegibilidade: Elegibilidade;
  // true = mesma sequência de voltas válidas, com o mesmo número de voltas, de outro piloto.
  empateAbsoluto: boolean;
  empatadoCom: string[];
}

export interface ResultadoPorMelhorVolta {
  // Classificados por posição (empates juntos, na ordem em que o motor entregou, que NÃO é critério),
  // depois quem não tem volta válida, depois DNS e DSQ.
  linhas: LinhaPorMelhorVolta[];
  // Pontos em que o regulamento precisa decidir.
  pendenciasDeRegulamento: string[];
}

export interface PublicacaoDoGrid {
  podePublicar: boolean;
  // O que impede a publicação definitiva: empates absolutos entre pilotos que largariam.
  bloqueios: string[];
  // O que não impede, mas depende de decisão (DNF, sem volta válida, exclusões de DSQ/DNS).
  pendencias: string[];
}

type Relacao = "antes" | "depois" | "identica";

// Compara duas sequências de voltas válidas (crescentes): primeira volta diferente decide; se todas
// as comparáveis são iguais, quem tem mais voltas válidas fica à frente; igual em tudo, empate.
function comparar(a: number[], b: number[]): Relacao {
  const comuns = Math.min(a.length, b.length);
  for (let i = 0; i < comuns; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? "antes" : "depois";
  }
  if (a.length === b.length) return "identica";
  return a.length > b.length ? "antes" : "depois";
}

function motivoSemVolta(l: LinhaClassificacao): MotivoSemPosicao {
  if (l.situacao === "sem_sensor") return "sem_sensor";
  if (l.leituras === 0) return "nao_largou";
  return "sem_volta_fechada";
}

export function classificarPorMelhorVolta(
  classificacao: LinhaClassificacao[],
): ResultadoPorMelhorVolta {
  const base = classificacao.map((l, ordem) => {
    const voltasValidasMs = l.voltasLista
      .map((v) => v.tempoMs)
      .sort((x, y) => x - y);
    const estado: EstadoNaClassificacao =
      l.situacao === "dsq"
        ? "dsq"
        : l.situacao === "dns"
          ? "dns"
          : voltasValidasMs.length > 0
            ? "classificado"
            : "sem_volta_valida";
    const motivo: MotivoSemPosicao | null =
      estado === "dsq"
        ? "dsq"
        : estado === "dns"
          ? "dns"
          : estado === "sem_volta_valida"
            ? motivoSemVolta(l)
            : null;
    return { l, ordem, voltasValidasMs, estado, motivo };
  });

  const elegibilidade = (
    estado: EstadoNaClassificacao,
    dnf: boolean,
  ): Elegibilidade =>
    estado === "dsq" || estado === "dns"
      ? "inelegivel"
      : estado === "sem_volta_valida" || dnf
        ? "depende_do_regulamento"
        : "elegivel";

  const classificados = base.filter((x) => x.estado === "classificado");
  const pendencias: string[] = [];
  const porId = new Map<string, LinhaPorMelhorVolta>();

  for (const x of classificados) {
    let melhores = 0;
    const empatadoCom: string[] = [];
    for (const y of classificados) {
      if (y === x) continue;
      const r = comparar(y.voltasValidasMs, x.voltasValidasMs);
      if (r === "antes") melhores++;
      else if (r === "identica") empatadoCom.push(y.l.participanteId);
    }
    const dnf = x.l.situacao === "dnf";
    porId.set(x.l.participanteId, {
      participanteId: x.l.participanteId,
      nome: x.l.nome,
      kartNumero: x.l.kartNumero,
      estado: "classificado",
      motivo: null,
      posicao: melhores + 1,
      voltasValidasMs: x.voltasValidasMs,
      melhorVoltaMs: x.voltasValidasMs[0] ?? null,
      ocorrencia: dnf ? "dnf" : null,
      penalidadeMs: x.l.penalidadeMs,
      elegibilidade: elegibilidade("classificado", dnf),
      empateAbsoluto: empatadoCom.length > 0,
      empatadoCom,
    });
  }

  // Uma pendência por grupo de empate absoluto (sem repetir).
  const vistos = new Set<string>();
  for (const x of classificados) {
    const linha = porId.get(x.l.participanteId)!;
    if (!linha.empateAbsoluto) continue;
    const grupo = [x.l.participanteId, ...linha.empatadoCom].sort();
    const chave = grupo.join("|");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const nomes = grupo
      .map((id) => classificados.find((c) => c.l.participanteId === id)!.l.nome)
      .join(", ");
    pendencias.push(
      `Empate absoluto entre ${nomes} (mesma sequência e mesmo número de voltas válidas): critério regulamentar não definido.`,
    );
  }

  const ordemDosClassificados = [...classificados].sort((a, b) => {
    const pa = porId.get(a.l.participanteId)!.posicao!;
    const pb = porId.get(b.l.participanteId)!.posicao!;
    // Só a posição ordena. Dentro de um empate absoluto a ordem de apresentação é a recebida do
    // motor e NÃO é critério: as posições são iguais e as linhas ficam marcadas.
    return pa - pb || a.ordem - b.ordem;
  });

  const semPosicao = (estado: EstadoNaClassificacao): LinhaPorMelhorVolta[] =>
    base
      .filter((x) => x.estado === estado)
      .map((x) => {
        const dnf = x.l.situacao === "dnf";
        return {
          participanteId: x.l.participanteId,
          nome: x.l.nome,
          kartNumero: x.l.kartNumero,
          estado: x.estado,
          motivo: x.motivo,
          posicao: null,
          voltasValidasMs: x.voltasValidasMs,
          melhorVoltaMs: x.voltasValidasMs[0] ?? null,
          ocorrencia: dnf ? ("dnf" as const) : null,
          penalidadeMs: x.l.penalidadeMs,
          elegibilidade: elegibilidade(x.estado, dnf),
          empateAbsoluto: false,
          empatadoCom: [],
        };
      });

  return {
    linhas: [
      ...ordemDosClassificados.map((x) => porId.get(x.l.participanteId)!),
      ...semPosicao("sem_volta_valida"),
      ...semPosicao("dns"),
      ...semPosicao("dsq"),
    ],
    pendenciasDeRegulamento: pendencias,
  };
}

// O grid precisa de posições FÍSICAS únicas, mas a classificação pode ter posições compartilhadas.
// Esta função NÃO forma o grid nem desempata: só diz se, com a classificação dada, a publicação
// definitiva é possível. Empate absoluto entre quem largaria BLOQUEIA a publicação até uma decisão
// autorizada (regulamento). DSQ e DNS nunca entram como elegíveis automaticamente.
export function avaliarPublicacaoDoGrid(
  resultado: ResultadoPorMelhorVolta,
): PublicacaoDoGrid {
  const bloqueios: string[] = [];
  const pendencias: string[] = [];
  const empatadosQueLargariam = resultado.linhas.filter(
    (l) => l.empateAbsoluto && l.elegibilidade !== "inelegivel",
  );
  if (empatadosQueLargariam.length > 0) {
    // uma mensagem por grupo, reaproveitando as pendências já calculadas
    for (const texto of resultado.pendenciasDeRegulamento) {
      bloqueios.push(
        `${texto} O grid precisa de posições físicas únicas: decisão autorizada necessária antes de publicar.`,
      );
    }
  }
  for (const l of resultado.linhas) {
    if (l.estado === "dsq" || l.estado === "dns") {
      pendencias.push(
        `${l.nome}: ${l.estado.toUpperCase()} não entra no grid como elegível (exceção só com regra regulamentar e autorização específica).`,
      );
    } else if (l.estado === "sem_volta_valida") {
      pendencias.push(
        `${l.nome}: sem volta válida (${l.motivo}); posição no grid depende do regulamento.`,
      );
    } else if (l.ocorrencia === "dnf") {
      pendencias.push(
        `${l.nome}: DNF com voltas válidas; elegibilidade para largar depende do regulamento.`,
      );
    }
  }
  return { podePublicar: bloqueios.length === 0, bloqueios, pendencias };
}
