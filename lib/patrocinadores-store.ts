import { promises as fs } from "fs";
import path from "path";
import { patrocinadores as patrocinadoresSemente } from "@/lib/mock/data";
import type { Patrocinador } from "@/lib/types";

// Diferente do resto do admin (traçados, etapas, campeonatos), que guarda
// rascunhos no localStorage do navegador — suficiente pra essas telas, que só
// precisam sobreviver a uma navegação/reload no MESMO navegador —,
// patrocinadores precisam aparecer também no overlay de transmissão, que
// roda como Browser Source dentro do OBS: um Chromium isolado, com seu
// próprio storage, que nunca veria o localStorage do navegador onde o admin
// fez o cadastro. Por isso esse dado mora aqui, num arquivo no servidor
// (ainda sem Supabase), compartilhado por qualquer navegador/processo que
// bata na mesma instância do app.
const ARQUIVO = path.join(process.cwd(), ".data", "patrocinadores.json");

async function garantirArquivo() {
  try {
    await fs.access(ARQUIVO);
  } catch {
    await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
    await fs.writeFile(ARQUIVO, JSON.stringify(patrocinadoresSemente, null, 2));
  }
}

export async function lerPatrocinadores(): Promise<Patrocinador[]> {
  await garantirArquivo();
  try {
    const conteudo = await fs.readFile(ARQUIVO, "utf-8");
    return JSON.parse(conteudo) as Patrocinador[];
  } catch {
    return patrocinadoresSemente;
  }
}

export async function salvarPatrocinadores(
  lista: Patrocinador[],
): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
  await fs.writeFile(ARQUIVO, JSON.stringify(lista, null, 2));
}
