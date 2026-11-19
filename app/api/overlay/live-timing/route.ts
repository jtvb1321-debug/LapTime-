import { NextResponse } from "next/server";
import { overlayAoVivo } from "@/lib/overlay-campeonato";
import { lerPatrocinadores } from "@/lib/patrocinadores-store";

async function patrocinadoresAtivos() {
  const patrocinadores = await lerPatrocinadores();
  return patrocinadores
    .filter((p) => p.ativo)
    .map((p) => ({ nome: p.nome, logoUrl: p.logoUrl ?? null }));
}

// Endpoint de leitura pro overlay de transmissão (OBS Browser Source). Sem
// Supabase Realtime ainda, então o cliente faz polling nesta rota a cada
// poucos segundos — trocar por uma subscription é só mudar quem alimenta o
// mesmo shape de resposta abaixo.
export const dynamic = "force-dynamic";

// Corrida fictícia só pra validar o overlay visualmente (?demo=1) sem sujar
// os dados reais do campeonato, que hoje estão todos zerados. A volta atual
// avança sozinha a cada 4s pra também comprovar que o polling funciona.
const DEMO_PILOTOS = [
  {
    posicao: 1,
    nome: "Eduardo Santos",
    numero: 21,
    kartNumero: 5,
    kartPlaca: "05",
    melhorVoltaMs: 51180,
    gapMs: 0,
    voltaRapida: true,
    uf: "SP",
    avatarUrl: "/pilotos/eduardo-santos.jpg",
    corNumero: "#22c55e",
    corAssinatura: "#f2f5f7",
  },
  {
    posicao: 2,
    nome: "Bruno Bonfim",
    numero: 20,
    kartNumero: 6,
    kartPlaca: "06",
    melhorVoltaMs: 51300,
    gapMs: 378,
    uf: "RJ",
  },
  {
    posicao: 3,
    nome: "Jhonattan Santos",
    numero: 24,
    kartNumero: 7,
    kartPlaca: "07",
    melhorVoltaMs: 51050,
    gapMs: 490,
    uf: "BA",
  },
  {
    posicao: 4,
    nome: "Igor Barradas",
    numero: 23,
    kartNumero: 8,
    kartPlaca: "08",
    melhorVoltaMs: 51550,
    gapMs: 1897,
    uf: "MG",
  },
  {
    posicao: 5,
    nome: "Enzo Gabriel",
    numero: 22,
    kartNumero: 9,
    kartPlaca: "09",
    melhorVoltaMs: 51900,
    gapMs: 2406,
    uf: "PR",
  },
];

async function montarDemo() {
  const totalVoltas = 15;
  const voltaAtual = 1 + (Math.floor(Date.now() / 4000) % totalVoltas);
  return {
    bateria: {
      nome: "Bateria Final (simulação)",
      status: "ao_vivo" as const,
      numero: 2,
      voltas: totalVoltas,
      categoria: "Master",
      etapa: "4ª Etapa",
    },
    pilotos: DEMO_PILOTOS.map((piloto) => ({
      ...piloto,
      avatarUrl: piloto.avatarUrl ?? null,
      corNumero: piloto.corNumero ?? null,
      corAssinatura: piloto.corAssinatura ?? null,
      voltaAtual,
      voltaRapida: piloto.voltaRapida ?? false,
    })),
    patrocinadores: await patrocinadoresAtivos(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // ?demo=1 mostra uma corrida fictícia só para ver o visual do overlay.
  if (searchParams.get("demo") === "1") {
    return NextResponse.json(await montarDemo());
  }
  return NextResponse.json(await overlayAoVivo());
}
