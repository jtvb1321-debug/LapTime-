// Rota sobre o modelo 3D da pista: pontos em X/Z do mundo (Y é a altura).
// Funções puras, usadas pelo editor, pela visualização e pelos testes.
export interface PontoRota {
  x: number;
  z: number;
}

export interface PoseNaRota extends PontoRota {
  angulo: number;
}

// Traçados 3D usam outra chave do localStorage: os salvos antes (pontos sobre
// a imagem aérea, em x/y) não valem no modelo 3D e não devem ser lidos.
export const CHAVE_TRACADOS = "gridlap:tracados-3d";

export const MAX_PONTOS = 2000;
export const MAX_ARQUIVO_BYTES = 500_000;
// Limites do modelo: pontos fora disso nem chegam a ser consultados no asfalto.
export const LIMITE_X = 170;
export const LIMITE_Z = 155;

export function segmentosDaRota(
  pontos: PontoRota[],
  fechado = false,
): [PontoRota, PontoRota][] {
  const resultado: [PontoRota, PontoRota][] = [];
  for (let i = 1; i < pontos.length; i++) {
    resultado.push([pontos[i - 1], pontos[i]]);
  }
  if (fechado && pontos.length > 2) {
    resultado.push([pontos[pontos.length - 1], pontos[0]]);
  }
  return resultado;
}

export function comprimentoDaRota(pontos: PontoRota[], fechado = false) {
  return segmentosDaRota(pontos, fechado).reduce(
    (soma, [a, b]) => soma + Math.hypot(b.x - a.x, b.z - a.z),
    0,
  );
}

export function posicaoNaRota(
  pontos: PontoRota[],
  fechado: boolean,
  distancia: number,
): PoseNaRota | null {
  for (const [a, b] of segmentosDaRota(pontos, fechado)) {
    const comprimento = Math.hypot(b.x - a.x, b.z - a.z);
    if (distancia <= comprimento && comprimento > 0) {
      const t = Math.max(0, distancia / comprimento);
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        angulo: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    distancia -= comprimento;
  }
  const ultimo = fechado ? pontos[0] : pontos[pontos.length - 1];
  return ultimo ? { ...ultimo, angulo: 0 } : null;
}

export interface RotaSalva {
  nome: string;
  fechado: boolean;
  pontos: PontoRota[];
}

// Formato do arquivo exportado/importado (o mesmo do Velokart Route Studio).
export function paraArquivo(rota: RotaSalva) {
  return {
    version: 1,
    model: "velokart-v1",
    units: "meters-estimated",
    name: rota.nome,
    closed: rota.fechado,
    points: rota.pontos.map((p) => ({ x: p.x, z: p.z })),
  };
}

export function lerArquivo(dados: unknown): RotaSalva {
  const d = dados as {
    version?: unknown;
    model?: unknown;
    name?: unknown;
    closed?: unknown;
    points?: unknown;
  } | null;
  if (
    !d ||
    d.version !== 1 ||
    d.model !== "velokart-v1" ||
    !Array.isArray(d.points) ||
    d.points.length > MAX_PONTOS
  ) {
    throw new Error(
      `Arquivo de rota incompatível (Velokart v1, máximo ${MAX_PONTOS} pontos).`,
    );
  }
  const pontos = d.points as { x?: unknown; z?: unknown }[];
  if (
    pontos.some(
      (p) =>
        !p ||
        typeof p.x !== "number" ||
        typeof p.z !== "number" ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.z) ||
        Math.abs(p.x) > LIMITE_X ||
        Math.abs(p.z) > LIMITE_Z,
    )
  ) {
    throw new Error("Coordenadas inválidas.");
  }
  return {
    nome: String(d.name || "Rota importada").slice(0, 80),
    fechado: !!d.closed,
    pontos: pontos.map((p) => ({ x: p.x as number, z: p.z as number })),
  };
}
