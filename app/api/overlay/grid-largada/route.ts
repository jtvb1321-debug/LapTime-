import { NextResponse } from "next/server";
import {
  baterias,
  etapas,
  getCategoriaById,
  getKartById,
  getResultadosPorBateria,
  nomeExibicaoPiloto,
} from "@/lib/mock/data";
import { sincronizarDemoCorrida } from "@/lib/demo-corrida";
import { lerPatrocinadores } from "@/lib/patrocinadores-store";
import { encontrarPilotoPorId } from "@/lib/pilotos-store";

async function patrocinadoresAtivos() {
  const patrocinadores = await lerPatrocinadores();
  return patrocinadores
    .filter((p) => p.ativo)
    .map((p) => ({ nome: p.nome, logoUrl: p.logoUrl ?? null }));
}

// Grid de largada da final = classificação da bateria classificatória (numero
// 1) da mesma etapa/categoria — mesma regra já usada em getPole/
// getBateriaClassificatoriaDaFinal. Aqui devolvemos a lista inteira, não só o
// 1º colocado, pra montar a tela cheia estilo grid de largada.
export const dynamic = "force-dynamic";

const DEMO_PILOTOS = [
  { posicao: 1, nome: "Eduardo Santos", numero: 21, kartNumero: 2, uf: "SP" },
  { posicao: 2, nome: "Bruno Bonfim", numero: 20, kartNumero: 1, uf: "RJ" },
  { posicao: 3, nome: "Jhonattan Santos", numero: 24, kartNumero: 5, uf: "BA" },
  { posicao: 4, nome: "Igor Barradas", numero: 23, kartNumero: 4, uf: "MG" },
  { posicao: 5, nome: "Enzo Gabriel", numero: 22, kartNumero: 3, uf: "PR" },
  { posicao: 6, nome: "Braulio Batista", numero: 25, kartNumero: 6, uf: "SC" },
  { posicao: 7, nome: "Cirilo Andrade", numero: 26, kartNumero: 7, uf: "RS" },
  { posicao: 8, nome: "Italo Veloso", numero: 28, kartNumero: 8, uf: "CE" },
  {
    posicao: 9,
    nome: "Vinicius Santhiago",
    numero: 29,
    kartNumero: 9,
    uf: "ES",
  },
  {
    posicao: 10,
    nome: "Elenilton Bessa",
    numero: 27,
    kartNumero: 10,
    uf: "PE",
  },
];

const AVATARES_DEMO: Record<number, string> = {
  21: "/pilotos/eduardo-santos.jpg",
};

async function montarDemo() {
  return {
    categoria: "Master",
    etapa: "Etapa 4",
    pilotos: DEMO_PILOTOS.map((piloto, indice) => ({
      ...piloto,
      avatarUrl: AVATARES_DEMO[piloto.numero] ?? null,
      kartPlaca: String(piloto.kartNumero).padStart(2, "0"),
      melhorVoltaMs: 51050 + indice * 250,
    })),
    patrocinadores: await patrocinadoresAtivos(),
  };
}

function encontrarClassificatoriaAtual() {
  return baterias.find((b) => {
    if (b.numero !== 1 || b.status !== "encerrada") return false;
    const final = baterias.find(
      (f) =>
        f.numero === 2 &&
        f.etapaId === b.etapaId &&
        f.categoriaId === b.categoriaId,
    );
    return !final || final.status !== "encerrada";
  });
}

export async function GET(request: Request) {
  sincronizarDemoCorrida();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("demo") === "1") {
    return NextResponse.json(await montarDemo());
  }

  const classificatoria = encontrarClassificatoriaAtual();
  if (!classificatoria) {
    return NextResponse.json({
      categoria: null,
      etapa: null,
      pilotos: [],
      patrocinadores: await patrocinadoresAtivos(),
    });
  }

  const categoria = getCategoriaById(classificatoria.categoriaId);
  const etapa = etapas.find((e) => e.id === classificatoria.etapaId);
  const resultados = getResultadosPorBateria(classificatoria.id);

  const pilotos = await Promise.all(
    resultados.map(async (resultado) => {
      const piloto = await encontrarPilotoPorId(resultado.pilotoId);
      const kart = getKartById(resultado.kartId);
      return {
        posicao: resultado.posicao,
        nome: piloto ? nomeExibicaoPiloto(piloto) : "Piloto",
        numero: piloto?.numero ?? null,
        avatarUrl: piloto?.avatarUrl ?? null,
        uf: piloto?.uf ?? null,
        kartNumero: kart?.numero ?? null,
        kartPlaca: kart?.placa ?? null,
        melhorVoltaMs: resultado.melhorVoltaMs,
      };
    }),
  );

  return NextResponse.json({
    categoria: categoria?.nome ?? null,
    etapa: etapa ? `Etapa ${etapa.numero}` : null,
    pilotos,
    patrocinadores: await patrocinadoresAtivos(),
  });
}
