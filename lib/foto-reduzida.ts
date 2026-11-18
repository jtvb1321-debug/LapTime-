// Redução da foto do piloto no navegador (avatar): usada no cadastro e na edição do perfil.

// Arquivo de entrada: até 8 MB; a foto é reduzida antes de enviar (o servidor
// de ações aceita no máximo 1 MB por envio).
export const TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024;
const LADO_MAXIMO_FOTO = 512;

// Lê a imagem e a reduz (lado maior de 512 px, JPEG): a foto do piloto é só um
// avatar, e assim o envio fica pequeno em qualquer celular.
export async function reduzirImagem(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.src = url;
    });
    const escala = Math.min(
      1,
      LADO_MAXIMO_FOTO / Math.max(imagem.naturalWidth, imagem.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sem suporte a imagem.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
