"use client";

import { useState } from "react";

const ALTURA_MAXIMA = 1000;
const LIMITE_CARACTERES = 850_000;

// Recorta o piloto da foto (tira o fundo no próprio navegador: a foto não sai do aparelho; só o
// modelo de recorte é baixado na primeira vez) e devolve um WEBP com transparência, já aparado e
// reduzido para caber no envio.
async function recortar(
  arquivo: File,
  aoProgredir: (fracao: number, etapa: string) => void,
): Promise<string> {
  const { removeBackground } = await import("@imgly/background-removal");
  const png = await removeBackground(arquivo, {
    output: { format: "image/png" },
    progress: (chave: string, atual: number, total: number) => {
      const etapa = chave.startsWith("fetch")
        ? "Baixando o recorte automático (só na primeira vez)…"
        : "Recortando o piloto…";
      aoProgredir(total ? atual / total : 0, etapa);
    },
  });
  const url = URL.createObjectURL(png);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Imagem inválida."));
      i.src = url;
    });
    const fonte = document.createElement("canvas");
    fonte.width = img.naturalWidth;
    fonte.height = img.naturalHeight;
    const fctx = fonte.getContext("2d");
    if (!fctx) throw new Error("Sem suporte a imagem.");
    fctx.drawImage(img, 0, 0);
    const { data, width, height } = fctx.getImageData(
      0,
      0,
      fonte.width,
      fonte.height,
    );
    let x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0 || y1 <= y0) {
      throw new Error("Não encontrei o piloto na foto. Tente outra foto.");
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    let escala = Math.min(1, ALTURA_MAXIMA / h);
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const saida = document.createElement("canvas");
      saida.width = Math.max(1, Math.round(w * escala));
      saida.height = Math.max(1, Math.round(h * escala));
      const octx = saida.getContext("2d");
      if (!octx) throw new Error("Sem suporte a imagem.");
      octx.drawImage(fonte, x0, y0, w, h, 0, 0, saida.width, saida.height);
      const dado = saida.toDataURL("image/webp", 0.85);
      if (
        dado.startsWith("data:image/webp") &&
        dado.length <= LIMITE_CARACTERES
      ) {
        return dado;
      }
      escala *= 0.8;
    }
    throw new Error("A foto ficou grande demais. Tente uma foto menor.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Passo do cadastro: foto de corpo inteiro (de macacão). Entrega o recorte já pronto via `aoMudar`.
export function FotoMacacao({
  fotoCorpo,
  aoMudar,
  aoOcupar,
}: {
  fotoCorpo: string;
  aoMudar: (dado: string) => void;
  // Avisa quando o recorte começa e termina (o formulário não deve ser enviado no meio).
  aoOcupar?: (ocupado: boolean) => void;
}) {
  const [trabalhando, setTrabalhando] = useState(false);
  const [progresso, setProgresso] = useState({ fracao: 0, etapa: "" });
  const [erro, setErro] = useState("");

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > 12 * 1024 * 1024) {
      setErro("Imagem muito grande — escolha um arquivo de até 12 MB.");
      return;
    }
    setErro("");
    setTrabalhando(true);
    aoOcupar?.(true);
    setProgresso({ fracao: 0, etapa: "Preparando…" });
    try {
      aoMudar(
        await recortar(arquivo, (fracao, etapa) =>
          setProgresso({ fracao, etapa }),
        ),
      );
    } catch (x) {
      setErro(
        x instanceof Error
          ? x.message
          : "Não foi possível recortar a foto. Tente outra.",
      );
    } finally {
      setTrabalhando(false);
      aoOcupar?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-orange-ink w-fit cursor-pointer text-sm font-medium hover:underline">
        {fotoCorpo ? "Trocar foto de macacão" : "Enviar foto de macacão"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={trabalhando}
          onChange={aoEscolher}
        />
      </label>
      <p className="text-ink-3 text-xs">
        Foto de corpo inteiro (ou da cintura para cima), de macacão, com o rosto
        visível. O fundo é removido automaticamente.
      </p>
      {trabalhando ? (
        <p role="status" className="text-ink-2 text-xs">
          {progresso.etapa} {Math.round(progresso.fracao * 100)}%
        </p>
      ) : null}
      {fotoCorpo && !trabalhando ? (
        <p role="status" className="text-ink-2 text-xs">
          ✓ Foto recortada e pronta.
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="text-orange-ink text-xs">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
