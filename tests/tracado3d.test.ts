import { describe, expect, it } from "vitest";
import { poseDoPiloto } from "@/lib/tracado3d/camera-piloto";
import { suavizarRota } from "@/lib/tracado3d/curva";
import {
  comprimentoDaRota,
  lerArquivo,
  paraArquivo,
  posicaoNaRota,
  segmentosDaRota,
} from "@/lib/tracado3d/rota";
import { ROTA_EXEMPLO } from "@/lib/tracado3d/rota-exemplo";
import { tracados } from "@/lib/mock/data";

const QUADRADO = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 10 },
  { x: 0, z: 10 },
];

describe("rota 3D: geometria", () => {
  it("fechar o circuito soma o trecho de volta ao primeiro ponto", () => {
    expect(comprimentoDaRota(QUADRADO)).toBeCloseTo(30);
    expect(comprimentoDaRota(QUADRADO, true)).toBeCloseTo(40);
    expect(segmentosDaRota(QUADRADO, true)).toHaveLength(4);
    // Com 2 pontos, "fechado" não duplica o trecho.
    expect(segmentosDaRota(QUADRADO.slice(0, 2), true)).toHaveLength(1);
  });

  it("posição na rota anda pelos trechos e para no fim", () => {
    expect(posicaoNaRota(QUADRADO, false, 5)).toMatchObject({ x: 5, z: 0 });
    expect(posicaoNaRota(QUADRADO, false, 15)).toMatchObject({ x: 10, z: 5 });
    expect(posicaoNaRota(QUADRADO, false, 999)).toMatchObject({ x: 0, z: 10 });
    expect(posicaoNaRota([], false, 1)).toBeNull();
  });

  it("suavização: 2 pontos é reta, 3+ passa pelos pontos e fecha sem repetir", () => {
    expect(suavizarRota(QUADRADO.slice(0, 2))).toHaveLength(2);
    const aberta = suavizarRota(QUADRADO);
    expect(aberta[0]).toEqual({ x: 0, z: 0 });
    const ultima = aberta[aberta.length - 1];
    expect(Math.hypot(ultima.x - 0, ultima.z - 10)).toBeLessThan(0.01);
    const fechada = suavizarRota(QUADRADO, true);
    const salto = Math.hypot(
      fechada[0].x - fechada[fechada.length - 1].x,
      fechada[0].z - fechada[fechada.length - 1].z,
    );
    expect(salto).toBeGreaterThan(0.05);
    expect(salto).toBeLessThan(0.6);
    // Pontos repetidos em sequência não quebram a curva.
    expect(
      suavizarRota([QUADRADO[0], QUADRADO[0], QUADRADO[1], QUADRADO[2]]).length,
    ).toBeGreaterThan(10);
  });

  it("câmera do piloto: na altura do piloto, olhando adiante, sem sair do lugar em rota vazia", () => {
    const reta = [
      { x: 0, z: 0 },
      { x: 0, z: 100 },
    ];
    const pose = poseDoPiloto(reta, false, 10);
    expect(pose?.posicao.y).toBeCloseTo(1.25);
    expect(pose!.alvo.z).toBeGreaterThan(pose!.posicao.z);
    expect(poseDoPiloto([], false, 0)).toBeNull();
    // Circuito fechado dá a volta em vez de parar.
    const a = poseDoPiloto(QUADRADO, true, 1);
    const b = poseDoPiloto(QUADRADO, true, 41);
    expect(b!.posicao.x).toBeCloseTo(a!.posicao.x);
  });
});

describe("rota 3D: arquivo", () => {
  it("exporta e reimporta a mesma rota", () => {
    const arquivo = paraArquivo({
      nome: "Teste",
      fechado: true,
      pontos: QUADRADO,
    });
    expect(arquivo).toMatchObject({ version: 1, model: "velokart-v1" });
    expect(lerArquivo(JSON.parse(JSON.stringify(arquivo)))).toEqual({
      nome: "Teste",
      fechado: true,
      pontos: QUADRADO,
    });
  });

  it("recusa versão/modelo errados, coordenadas inválidas e pontos demais", () => {
    const base = paraArquivo({ nome: "x", fechado: false, pontos: QUADRADO });
    expect(() => lerArquivo(null)).toThrow(/incompatível/);
    expect(() => lerArquivo({ ...base, version: 2 })).toThrow(/incompatível/);
    expect(() => lerArquivo({ ...base, model: "outro" })).toThrow(
      /incompatível/,
    );
    expect(() => lerArquivo({ ...base, points: [{ x: 999, z: 0 }] })).toThrow(
      /Coordenadas/,
    );
    expect(() => lerArquivo({ ...base, points: [{ x: "1", z: 0 }] })).toThrow(
      /Coordenadas/,
    );
    expect(() => lerArquivo({ ...base, points: [{ x: NaN, z: 0 }] })).toThrow(
      /Coordenadas/,
    );
    expect(() =>
      lerArquivo({
        ...base,
        points: Array.from({ length: 2001 }, () => ({ x: 0, z: 0 })),
      }),
    ).toThrow(/incompatível/);
  });

  it("nome vazio vira padrão e é limitado a 80 caracteres", () => {
    const base = paraArquivo({ nome: "", fechado: false, pontos: [] });
    expect(lerArquivo(base).nome).toBe("Rota importada");
    expect(lerArquivo({ ...base, name: "a".repeat(200) }).nome).toHaveLength(
      80,
    );
  });
});

describe("traçado de exemplo", () => {
  it("o traçado padrão usa a rota de exemplo e a extensão confere com a curva", () => {
    const [padrao] = tracados;
    expect(padrao.pontos).toEqual(ROTA_EXEMPLO);
    const real = comprimentoDaRota(suavizarRota(ROTA_EXEMPLO));
    expect(Math.abs(real - padrao.extensaoMetros!)).toBeLessThanOrEqual(2);
  });
});
