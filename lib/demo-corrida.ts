import fs from "node:fs";
import path from "node:path";
import {
  baterias,
  getPilotoById,
  nomeExibicaoPiloto,
  resultados,
  simulacaoEstaAtiva,
} from "@/lib/mock/data";
import { RESULTADOS_SIMULADOS } from "@/lib/mock/simulacao-dados";
import { definirSimulacao } from "@/lib/simulacao";

// Corrida de demonstração "rolando": a final da Etapa 1 (simulação ligada)
// ganha um relógio. Cada piloto tem tempos de volta próprios; a posição, o gap,
// a melhor volta e a volta atual saem do tempo decorrido. Os arrays de
// lib/mock/data.ts são alterados no lugar, então overlays, TV e classificação
// enxergam a mesma corrida. Só roda no servidor (usa fs). O estado fica em
// .data/demo-corrida.json e some quando a simulação é ligada/desligada.
const ARQUIVO = path.join(process.cwd(), ".data", "demo-corrida.json");

export const BATERIA_FINAL_DEMO = "bat-2-final";
const BATERIA_CLASSIF_DEMO = "bat-1-classificatoria";
const VOLTAS = 15;
// Tempo da demonstração por tempo real de pista: 0,2 → volta de 51 s dura
// ~10 s e a corrida inteira cerca de 3 min.
const ESCALA = 0.2;
const PONTOS = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6];

export type FaseDemo = "padrao" | "grid" | "correndo" | "pausada" | "encerrada";
export type VelocidadeDemo = 1 | 2 | 4;

interface Estado {
  fase: FaseDemo;
  // Tempo de pista (ms) já decorrido até a última pausa/troca de velocidade.
  acumuladoMs: number;
  inicioMs: number;
  velocidade: VelocidadeDemo;
}

type Global = typeof globalThis & { __gridlapDemoCorrida?: Estado | null };

function lerEstado(): Estado | null {
  const g = globalThis as Global;
  if (g.__gridlapDemoCorrida !== undefined) return g.__gridlapDemoCorrida;
  try {
    g.__gridlapDemoCorrida = JSON.parse(fs.readFileSync(ARQUIVO, "utf-8"));
  } catch {
    g.__gridlapDemoCorrida = null;
  }
  return g.__gridlapDemoCorrida ?? null;
}

function gravarEstado(estado: Estado | null) {
  (globalThis as Global).__gridlapDemoCorrida = estado;
  try {
    if (estado) {
      fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
      fs.writeFileSync(ARQUIVO, JSON.stringify(estado));
    } else {
      fs.rmSync(ARQUIVO, { force: true });
    }
  } catch {
    // Sem disco gravável, a demonstração segue só em memória.
  }
}

// Chamado quando a simulação é ligada/desligada: volta ao cenário padrão.
export function limparDemoCorrida() {
  gravarEstado(null);
}

interface PilotoDemo {
  pilotoId: string;
  kartId: string;
  classifMs: number;
  classifGapMs: number;
  voltas: number[];
  acumulado: number[];
}

// Jitter fixo por piloto/volta: a corrida é igual a cada vez que roda.
function ruido(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

let cache: PilotoDemo[] | null = null;
function pilotosDaCorrida(): PilotoDemo[] {
  if (cache) return cache;
  const classif = RESULTADOS_SIMULADOS.filter(
    (r) => r.bateriaId === BATERIA_CLASSIF_DEMO,
  ).sort((a, b) => a.posicao - b.posicao);
  const final = RESULTADOS_SIMULADOS.filter(
    (r) => r.bateriaId === BATERIA_FINAL_DEMO,
  );
  cache = classif.map((grid, indiceGrid) => {
    const linha = final.find((f) => f.pilotoId === grid.pilotoId)!;
    const voltas: number[] = [];
    const acumulado: number[] = [];
    let soma = 0;
    for (let v = 1; v <= VOLTAS; v++) {
      let tempo =
        linha.melhorVoltaMs + 350 + ruido(`${grid.pilotoId}:${v}`) * 650;
      // Largada parada: a 1ª volta é mais lenta, e mais ainda no fundo do grid.
      if (v === 1) tempo += 1200 + indiceGrid * 180;
      voltas.push(Math.round(tempo));
      soma += Math.round(tempo);
      acumulado.push(soma);
    }
    return {
      pilotoId: grid.pilotoId,
      kartId: linha.kartId,
      classifMs: grid.melhorVoltaMs,
      classifGapMs: grid.gapMs,
      voltas,
      acumulado,
    };
  });
  return cache;
}

const FIM_MS = () =>
  Math.max(...pilotosDaCorrida().map((p) => p.acumulado[VOLTAS - 1]));

function decorridoMs(estado: Estado) {
  if (estado.fase === "encerrada") return Infinity;
  if (estado.fase === "grid") return 0;
  const correndo =
    estado.fase === "correndo"
      ? ((Date.now() - estado.inicioMs) * estado.velocidade) / ESCALA
      : 0;
  return estado.acumuladoMs + correndo;
}

export interface LinhaDemo {
  pilotoId: string;
  kartId: string;
  posicao: number;
  voltasFeitas: number;
  melhorVoltaMs: number;
  gapMs: number;
  pontos: number;
}

function classificar(t: number): LinhaDemo[] {
  const linhas = pilotosDaCorrida().map((p, indiceGrid) => {
    let feitas = 0;
    while (feitas < VOLTAS && p.acumulado[feitas] <= t) feitas++;
    return {
      p,
      indiceGrid,
      feitas,
      cruzou: feitas ? p.acumulado[feitas - 1] : 0,
      melhor: feitas ? Math.min(...p.voltas.slice(0, feitas)) : p.classifMs,
    };
  });
  linhas.sort((a, b) =>
    b.feitas !== a.feitas
      ? b.feitas - a.feitas
      : a.feitas === 0
        ? a.indiceGrid - b.indiceGrid
        : a.cruzou - b.cruzou,
  );
  const lider = linhas[0];
  return linhas.map((l, i) => {
    let gap = 0;
    if (i > 0) {
      gap =
        l.feitas === 0
          ? l.p.classifGapMs
          : l.cruzou - lider.p.acumulado[Math.min(l.feitas, lider.feitas) - 1];
    }
    return {
      pilotoId: l.p.pilotoId,
      kartId: l.p.kartId,
      posicao: i + 1,
      voltasFeitas: l.feitas,
      melhorVoltaMs: l.melhor,
      gapMs: Math.max(0, Math.round(gap)),
      pontos: PONTOS[i] ?? 0,
    };
  });
}

// Aplica o instante atual da corrida de demonstração nos dados em memória.
// Barato: as rotas de overlay chamam isto a cada leitura.
export function sincronizarDemoCorrida() {
  const estado = lerEstado();
  if (!estado || estado.fase === "padrao" || !simulacaoEstaAtiva()) return;

  if (estado.fase === "correndo" && decorridoMs(estado) >= FIM_MS()) {
    estado.fase = "encerrada";
    gravarEstado(estado);
  }
  const bateria = baterias.find((b) => b.id === BATERIA_FINAL_DEMO);
  if (!bateria) return;

  const linhas = classificar(decorridoMs(estado));
  bateria.status =
    estado.fase === "grid"
      ? "grid"
      : estado.fase === "encerrada"
        ? "encerrada"
        : "ao_vivo";

  for (const linha of linhas) {
    const r = resultados.find(
      (x) =>
        x.bateriaId === BATERIA_FINAL_DEMO && x.pilotoId === linha.pilotoId,
    );
    if (!r) continue;
    r.posicao = linha.posicao;
    r.melhorVoltaMs = linha.melhorVoltaMs;
    r.gapMs = linha.gapMs;
    r.pontos = estado.fase === "grid" ? 0 : linha.pontos;
    if (estado.fase === "grid") delete r.voltaAtual;
    else r.voltaAtual = Math.min(VOLTAS, linha.voltasFeitas + 1);
    if (estado.fase === "encerrada") r.voltaAtual = VOLTAS;
  }
  resultados.sort((a, b) =>
    a.bateriaId === b.bateriaId ? a.posicao - b.posicao : 0,
  );
}

export type AcaoDemo =
  | "grid"
  | "iniciar"
  | "pausar"
  | "retomar"
  | "encerrar"
  | "padrao"
  | "ligar"
  | "desligar"
  | "velocidade-1"
  | "velocidade-2"
  | "velocidade-4";

export function controlarDemoCorrida(acao: AcaoDemo) {
  const agora = Date.now();
  const atual = lerEstado();
  const velocidade = atual?.velocidade ?? 1;

  if (acao === "ligar" || acao === "desligar") {
    definirSimulacao(acao === "ligar");
    limparDemoCorrida();
    return;
  }
  if (acao === "padrao") {
    // Recarrega o cenário original (final ao vivo, volta 9/15).
    definirSimulacao(true);
    limparDemoCorrida();
    return;
  }
  if (acao === "grid") {
    definirSimulacao(true);
    gravarEstado({ fase: "grid", acumuladoMs: 0, inicioMs: agora, velocidade });
  } else if (acao === "iniciar") {
    if (!simulacaoEstaAtiva() || !atual || atual.fase === "padrao") {
      definirSimulacao(true);
    }
    gravarEstado({
      fase: "correndo",
      acumuladoMs: 0,
      inicioMs: agora,
      velocidade,
    });
  } else if (atual && atual.fase !== "padrao") {
    const decorrido = decorridoMs(atual);
    const acumuladoMs = Number.isFinite(decorrido) ? decorrido : 0;
    if (acao === "pausar" && atual.fase === "correndo") {
      gravarEstado({ ...atual, fase: "pausada", acumuladoMs });
    } else if (acao === "retomar" && atual.fase === "pausada") {
      gravarEstado({ ...atual, fase: "correndo", inicioMs: agora });
    } else if (acao === "encerrar") {
      gravarEstado({ ...atual, fase: "encerrada" });
    } else if (acao.startsWith("velocidade-")) {
      const nova = Number(acao.split("-")[1]) as VelocidadeDemo;
      gravarEstado({
        ...atual,
        velocidade: nova,
        ...(atual.fase === "correndo" ? { acumuladoMs, inicioMs: agora } : {}),
      });
    }
  }
  sincronizarDemoCorrida();
}

export interface PainelDemo {
  simulacaoAtiva: boolean;
  fase: FaseDemo;
  velocidade: VelocidadeDemo;
  voltas: number;
  voltaDoLider: number;
  lideres: {
    posicao: number;
    nome: string;
    voltaMs: number;
    gapMs: number;
  }[];
}

export function lerPainelDemo(): PainelDemo {
  sincronizarDemoCorrida();
  const estado = lerEstado();
  const ativa = simulacaoEstaAtiva();
  const fase = ativa ? (estado?.fase ?? "padrao") : "padrao";
  const bateria = baterias.find((b) => b.id === BATERIA_FINAL_DEMO);
  const linhas = resultados
    .filter((r) => r.bateriaId === BATERIA_FINAL_DEMO)
    .sort((a, b) => a.posicao - b.posicao);
  return {
    simulacaoAtiva: ativa,
    fase,
    velocidade: estado?.velocidade ?? 1,
    voltas: bateria?.voltas ?? VOLTAS,
    voltaDoLider: linhas[0]?.voltaAtual ?? 0,
    lideres: linhas.slice(0, 5).map((r) => {
      const piloto = getPilotoById(r.pilotoId);
      return {
        posicao: r.posicao,
        nome: piloto ? nomeExibicaoPiloto(piloto) : "Piloto",
        voltaMs: r.melhorVoltaMs,
        gapMs: r.gapMs,
      };
    }),
  };
}
