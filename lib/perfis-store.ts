import { promises as fs } from "fs";
import path from "path";
import { perfis as perfisSemente } from "@/lib/mock/data";
import type { Perfil } from "@/lib/types";

// Mesmo motivo do pilotos-store: uma conta criada em /cadastro precisa
// poder logar de qualquer navegador, não só do que fez o cadastro.
const ARQUIVO = path.join(process.cwd(), ".data", "perfis.json");

async function garantirArquivo() {
  try {
    await fs.access(ARQUIVO);
  } catch {
    await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
    await fs.writeFile(ARQUIVO, JSON.stringify(perfisSemente, null, 2));
  }
}

export async function lerPerfis(): Promise<Perfil[]> {
  await garantirArquivo();
  try {
    const conteudo = await fs.readFile(ARQUIVO, "utf-8");
    return JSON.parse(conteudo) as Perfil[];
  } catch {
    return perfisSemente;
  }
}

export async function salvarPerfis(lista: Perfil[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO), { recursive: true });
  await fs.writeFile(ARQUIVO, JSON.stringify(lista, null, 2));
}

export async function adicionarPerfil(perfil: Perfil): Promise<void> {
  const atuais = await lerPerfis();
  await salvarPerfis([...atuais, perfil]);
}

export async function encontrarPerfilPorEmailStore(
  email: string,
): Promise<Perfil | undefined> {
  const perfis = await lerPerfis();
  return perfis.find((p) => p.email.toLowerCase() === email.toLowerCase());
}

export async function emailJaCadastrado(email: string): Promise<boolean> {
  return (await encontrarPerfilPorEmailStore(email)) !== undefined;
}
