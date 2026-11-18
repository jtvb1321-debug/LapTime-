import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { Patrocinador } from "@/lib/types";

// Patrocinadores precisam aparecer também no overlay de transmissão, que
// roda como Browser Source dentro do OBS (um Chromium isolado, sem o
// localStorage do navegador do admin) — por isso moram no banco do servidor.
interface LinhaPatrocinador {
  id: string;
  nome: string;
  logo_url: string | null;
  ativo: boolean;
}

export async function lerPatrocinadores(): Promise<Patrocinador[]> {
  const linhas = await consultar<LinhaPatrocinador>(
    "select id, nome, logo_url, ativo from patrocinador order by ordem, id",
  );
  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    logoUrl: linha.logo_url ?? undefined,
    ativo: linha.ativo,
  }));
}

// Substitui a lista inteira (mantendo a ordem recebida) numa transação — o
// admin sempre envia a lista completa.
export async function salvarPatrocinadores(
  lista: Patrocinador[],
): Promise<void> {
  await transacao(async (cliente) => {
    await cliente.query("delete from patrocinador");
    for (const [indice, patrocinador] of lista.entries()) {
      await cliente.query(
        `insert into patrocinador (id, nome, logo_url, ativo, ordem)
         values ($1, $2, $3, $4, $5)`,
        [
          patrocinador.id,
          patrocinador.nome,
          patrocinador.logoUrl ?? null,
          patrocinador.ativo,
          indice,
        ],
      );
    }
  });
}

const LOGO_DATA_URL =
  /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
const MAXIMO_LOGO_CARACTERES = 3_000_000;

// Valida a lista recebida do navegador (entrada externa) antes de gravar.
export function validarPatrocinadores(entrada: unknown): Patrocinador[] {
  if (!Array.isArray(entrada)) throw new ErroNegocio("Lista inválida.");
  if (entrada.length > 100) {
    throw new ErroNegocio("No máximo 100 patrocinadores.");
  }
  const ids = new Set<string>();
  return entrada.map((bruto, i) => {
    const onde = `Patrocinador ${i + 1}`;
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) {
      throw new ErroNegocio(`${onde}: formato inválido.`);
    }
    const p = bruto as Record<string, unknown>;
    const id = typeof p.id === "string" ? p.id.trim() : "";
    const nome = typeof p.nome === "string" ? p.nome.trim() : "";
    if (!id || id.length > 80) throw new ErroNegocio(`${onde}: id inválido.`);
    if (ids.has(id)) throw new ErroNegocio(`${onde}: id repetido.`);
    ids.add(id);
    if (nome.length < 1 || nome.length > 120) {
      throw new ErroNegocio(`${onde}: o nome deve ter de 1 a 120 caracteres.`);
    }
    if (typeof p.ativo !== "boolean") {
      throw new ErroNegocio(`${onde}: "ativo" deve ser verdadeiro ou falso.`);
    }
    let logoUrl: string | undefined;
    if (p.logoUrl !== undefined && p.logoUrl !== null && p.logoUrl !== "") {
      if (typeof p.logoUrl !== "string") {
        throw new ErroNegocio(`${onde}: logo inválida.`);
      }
      const logo = p.logoUrl;
      const imagemEmbutida =
        logo.length <= MAXIMO_LOGO_CARACTERES && LOGO_DATA_URL.test(logo);
      const endereco =
        logo.length <= 500 && /^(https?:\/\/|\/(?![\/\\]))\S+$/.test(logo);
      if (!imagemEmbutida && !endereco) {
        throw new ErroNegocio(
          `${onde}: a logo deve ser uma imagem (PNG, JPG, WEBP ou GIF) de até 2 MB.`,
        );
      }
      logoUrl = logo;
    }
    return { id, nome, ativo: p.ativo, ...(logoUrl ? { logoUrl } : {}) };
  });
}
