import { NextResponse } from "next/server";
import { overlayGrid } from "@/lib/overlay-campeonato";
import { lerPatrocinadores } from "@/lib/patrocinadores-store";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // ?demo=1 mostra uma corrida fictícia só para ver o visual do overlay.
  if (searchParams.get("demo") === "1") {
    return NextResponse.json(await montarDemo());
  }
  return NextResponse.json(await overlayGrid());
}
