// Imagem de apresentação de cada campeonato (separada do fundo e da marca do
// Grid Lap). Validação pura, usada pelo servidor antes de gravar.
export const IMAGEM_MAX_BYTES = 2 * 1024 * 1024;
export const ALT_MAX = 200;

export type MimeImagem = "image/jpeg" | "image/png" | "image/webp";

// O tipo é decidido pelo CONTEÚDO (assinatura do arquivo), não pelo nome nem
// pelo Content-Type enviado pelo navegador.
export function tipoDaImagem(b: Uint8Array): MimeImagem | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)
  ) {
    return "image/png";
  }
  if (
    b.length >= 12 &&
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ResultadoValidacao =
  { ok: true; mime: MimeImagem; alt: string } | { ok: false; erro: string };

export function validarImagem(
  bytes: Uint8Array,
  altBruto: string,
  nomePadrao: string,
): ResultadoValidacao {
  if (bytes.length === 0) return { ok: false, erro: "Arquivo vazio." };
  if (bytes.length > IMAGEM_MAX_BYTES) {
    return { ok: false, erro: "A imagem passa de 2 MB." };
  }
  const mime = tipoDaImagem(bytes);
  if (!mime) {
    return { ok: false, erro: "Use uma imagem JPG, PNG ou WebP." };
  }
  const alt = altBruto.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (alt.length > ALT_MAX) {
    return { ok: false, erro: `Texto alternativo: até ${ALT_MAX} caracteres.` };
  }
  return { ok: true, mime, alt: alt || `Imagem do campeonato ${nomePadrao}` };
}
