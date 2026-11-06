import { NextResponse } from "next/server";
import {
  baterias,
  campeonato,
  etapas,
  getCategoriaById,
  getKartById,
  getResultadosPorBateria,
  nomeExibicaoPiloto,
} from "@/lib/mock/data";
import {
  BATERIA_FINAL_DEMO,
  sincronizarDemoCorrida,
} from "@/lib/demo-corrida";
import { lerPatrocinadores } from "@/lib/patrocinadores-store";
import { encontrarPilotoPorId } from "@/lib/pilotos-store";

async function patrocinadoresAtivos() {
  const patrocinadores = await lerPatrocinadores();
  return patrocinadores
    .filter((p) => p.ativo)
    .map((p) => ({ nome: p.nome, logoUrl: p.logoUrl ?? null }));
}

// Overlay de resultado final / vencedor da bateria — tela cheia de
// "encerramento", igual à referência de transmissão que o usuário mandou
// (foto do vencedor + tabela de classificação completa + patrocinadores).
export const dynamic = "force-dynamic";

const DEMO_PILOTOS = [
  {
    posicao: 1,
    nome: "Eduardo Santos",
    numero: 21,
    uf: "SP",
    kartNumero: 5,
    melhorVoltaMs: 51180,
    gapMs: 0,
    voltas: 9,
  },
  {
    posicao: 2,
    nome: "Jhonattan Santos",
    numero: 24,
    uf: "BA",
    kartNumero: 7,
    melhorVoltaMs: 51050,
    gapMs: 1200,
    voltas: 9,
  },
  {
    posicao: 3,
    nome: "Bruno Bonfim",
    numero: 20,
    uf: "RJ",
    kartNumero: 6,
    melhorVoltaMs: 51300,
    gapMs: 2500,
    voltas: 9,
  },
  {
    posicao: 4,
    nome: "Igor Barradas",
    numero: 23,
    uf: "MG",
    kartNumero: 8,
    melhorVoltaMs: 51550,
    gapMs: 8900,
    voltas: 9,
  },
  {
    posicao: 5,
    nome: "Enzo Gabriel",
    numero: 22,
    uf: "PR",
    kartNumero: 9,
    melhorVoltaMs: 51900,
    gapMs: 15200,
    voltas: 9,
  },
  {
    posicao: 6,
    nome: "Braulio Batista",
    numero: 25,
    uf: "SC",
    kartNumero: 10,
    melhorVoltaMs: 52300,
    gapMs: 22400,
    voltas: 9,
  },
  {
    posicao: 7,
    nome: "Cirilo Andrade",
    numero: 26,
    uf: "RS",
    kartNumero: 1,
    melhorVoltaMs: 52550,
    gapMs: 28100,
    voltas: 9,
  },
  {
    posicao: 8,
    nome: "Italo Veloso",
    numero: 28,
    uf: "CE",
    kartNumero: 2,
    melhorVoltaMs: 52800,
    gapMs: 35600,
    voltas: 9,
  },
  {
    posicao: 9,
    nome: "Vinicius Santhiago",
    numero: 29,
    uf: "ES",
    kartNumero: 3,
    melhorVoltaMs: 53050,
    gapMs: 42300,
    voltas: 9,
  },
  {
    posicao: 10,
    nome: "Elenilton Bessa",
    numero: 27,
    uf: "PE",
    kartNumero: 4,
    melhorVoltaMs: 53300,
    gapMs: 50100,
    voltas: 9,
  },
];

async function montarDemo() {
  return {
    corrida: {
      numero: 2,
      categoria: "Master",
      etapa: "4ª Etapa",
      kartodromo: "Grid Lap",
      campeonato: "Copa VeloKart 2026",
    },
    vencedor: {
      nome: "Eduardo Santos",
      avatarUrl: "/pilotos/eduardo-santos.jpg",
      numero: 21,
      corNumero: "#22c55e",
      corAssinatura: "#f2f5f7",
    },
    pilotos: DEMO_PILOTOS.map((piloto) => ({ ...piloto, avatarUrl: null })),
    patrocinadores: await patrocinadoresAtivos(),
  };
}

export async function GET(request: Request) {
  sincronizarDemoCorrida();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("demo") === "1") {
    return NextResponse.json(await montarDemo());
  }

  // A final da corrida de demonstração, quando termina, é a que vai pra tela.
  const bateria =
    baterias.find(
      (b) => b.id === BATERIA_FINAL_DEMO && b.status === "encerrada",
    ) ??
    baterias.find((b) => b.status === "encerrada" && b.numero === 2) ??
    baterias.find((b) => b.status === "encerrada");

  if (!bateria) {
    return NextResponse.json({
      corrida: null,
      vencedor: null,
      pilotos: [],
      patrocinadores: await patrocinadoresAtivos(),
    });
  }

  const categoria = getCategoriaById(bateria.categoriaId);
  const etapa = etapas.find((e) => e.id === bateria.etapaId);
  const resultados = getResultadosPorBateria(bateria.id);

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
        melhorVoltaMs: resultado.melhorVoltaMs,
        gapMs: resultado.gapMs,
        voltas: resultado.voltaAtual ?? bateria.voltas,
      };
    }),
  );

  const resultadoVencedor = resultados.find((r) => r.posicao === 1);
  const pilotoVencedor = resultadoVencedor
    ? await encontrarPilotoPorId(resultadoVencedor.pilotoId)
    : null;

  return NextResponse.json({
    corrida: {
      numero: bateria.numero,
      categoria: categoria?.nome ?? null,
      etapa: etapa ? `${etapa.numero}ª Etapa` : null,
      kartodromo: etapa?.kartodromo ?? null,
      campeonato: campeonato
        ? `${campeonato.nome} ${campeonato.temporada}`
        : null,
    },
    vencedor: pilotoVencedor
      ? {
          nome: nomeExibicaoPiloto(pilotoVencedor),
          avatarUrl: pilotoVencedor.avatarUrl ?? null,
          numero: pilotoVencedor.numero,
          corNumero: pilotoVencedor.corNumero ?? null,
          corAssinatura: pilotoVencedor.corAssinatura ?? null,
        }
      : null,
    pilotos,
    patrocinadores: await patrocinadoresAtivos(),
  });
}
