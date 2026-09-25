import { promises as fs } from "fs";
import path from "path";
import { pilotos as pilotosSemente } from "@/lib/mock/data";
import type { Piloto } from "@/lib/types";

// Mesmo motivo do patrocinadores-store: piloto que se cadastra sozinho (ver
// lib/cadastro-actions.ts) precisa aparecer pra qualquer um que acessar o
// site ou o overlay de transmissão — não só no navegador de quem se
// cadastrou —, então mora num arquivo no servidor, não no localStorage.
const ARQUIVO = path.join(process.cwd(), ".data", "pilotos.json");

async function garantirArquivo() {
  try {
    await fs.access(ARQUIVO);
  } catch {
    await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
    await fs.writeFile(ARQUIVO, JSON.stringify(pilotosSemente, null, 2));
  }
}

export async function lerPilotos(): Promise<Piloto[]> {
  await garantirArquivo();
  try {
    const conteudo = await fs.readFile(ARQUIVO, "utf-8");
    return JSON.parse(conteudo) as Piloto[];
  } catch {
    return pilotosSemente;
  }
}

export async function salvarPilotos(lista: Piloto[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
  await fs.writeFile(ARQUIVO, JSON.stringify(lista, null, 2));
}

export async function adicionarPiloto(piloto: Piloto): Promise<void> {
  const atuais = await lerPilotos();
  await salvarPilotos([...atuais, piloto]);
}

export async function encontrarPilotoPorSlug(
  slug: string,
): Promise<Piloto | undefined> {
  const pilotos = await lerPilotos();
  return pilotos.find((p) => p.slug === slug);
}

export async function encontrarPilotoPorId(
  id: string,
): Promise<Piloto | undefined> {
  const pilotos = await lerPilotos();
  return pilotos.find((p) => p.id === id);
}
