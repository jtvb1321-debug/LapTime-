// Reduz o logo no navegador antes de enviar: no máximo 480 px no maior lado, mantendo a proporção
// e a transparência (PNG). Se ainda ficar grande, tenta WebP. O servidor valida de novo.
const LADO_MAXIMO = 480;
const LIMITE_CARACTERES = 600_000;

export const LOGO_TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024;

function carregar(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

export async function reduzirLogo(arquivo: File): Promise<string> {
  const img = await carregar(arquivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const largura = Math.max(1, Math.round(img.width * escala));
  const altura = Math.max(1, Math.round(img.height * escala));
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(img, 0, 0, largura, altura);
  for (const [tipo, qualidade] of [
    ["image/png", undefined],
    ["image/webp", 0.85],
    ["image/webp", 0.6],
  ] as const) {
    const url = tela.toDataURL(tipo, qualidade);
    if (url.startsWith(`data:${tipo}`) && url.length <= LIMITE_CARACTERES) {
      return url;
    }
  }
  throw new Error("O logo ficou grande demais. Use uma imagem mais simples.");
}
