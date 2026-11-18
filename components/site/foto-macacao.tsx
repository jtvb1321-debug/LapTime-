"use client";

import { useState } from "react";
import {
  ErroDeFoto,
  prepararMotor,
  recortarFoto,
} from "@/lib/recorte/recortar-foto";

const ALTURA_MAXIMA = 1000;
const LIMITE_CARACTERES = 850_000;
const TEMPO_LIMITE_MS = 120_000;

function comTempoLimite<T>(promessa: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("tempo-esgotado")),
      TEMPO_LIMITE_MS,
    );
    promessa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// Recorta o piloto da foto (no próprio navegador: a foto não sai do aparelho) e devolve um WEBP com
// transparência, já aparado e reduzido para caber no envio.
async function recortar(
  arquivo: File,
  aoProgredir: (fracao: number, etapa: string) => void,
): Promise<string> {
  const fonte = await comTempoLimite(recortarFoto(arquivo, aoProgredir));
  const fctx = fonte.getContext("2d", { willReadFrequently: true });
  if (!fctx) throw new Error("Sem suporte a imagem.");
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
    throw new ErroDeFoto("Não encontrei o piloto na foto. Tente outra foto.");
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
  throw new ErroDeFoto("A foto ficou grande demais. Tente uma foto menor.");
}

function mensagemDeErro(e: unknown) {
  if (e instanceof ErroDeFoto) return e.message;
  if (e instanceof Error && e.message === "tempo-esgotado") {
    return "Demorou demais. Confira a internet e tente de novo, de preferência com uma foto menor.";
  }
  return "Não foi possível recortar a foto. Toque em “Tentar de novo” ou use outra foto.";
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
  const [arquivo, setArquivo] = useState<File | null>(null);

  async function processar(foto: File) {
    setArquivo(foto);
    setErro("");
    setTrabalhando(true);
    aoOcupar?.(true);
    setProgresso({ fracao: 0, etapa: "Preparando…" });
    try {
      let ultimoErro: unknown;
      // Uma segunda tentativa automática cobre falhas passageiras de rede ao baixar o modelo.
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          aoMudar(
            await recortar(foto, (fracao, etapa) =>
              setProgresso({ fracao, etapa }),
            ),
          );
          return;
        } catch (e) {
          ultimoErro = e;
          if (e instanceof ErroDeFoto) break;
        }
      }
      setErro(mensagemDeErro(ultimoErro));
    } finally {
      setTrabalhando(false);
      aoOcupar?.(false);
    }
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = e.target.files?.[0];
    e.target.value = "";
    if (!escolhido) return;
    if (escolhido.size > 25 * 1024 * 1024) {
      setErro("Imagem muito grande — escolha um arquivo de até 25 MB.");
      return;
    }
    await processar(escolhido);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-orange-ink w-fit cursor-pointer text-sm font-medium hover:underline"
        // Enquanto a pessoa escolhe a foto, o recorte já vai sendo preparado.
        onClick={() => void prepararMotor().catch(() => undefined)}
      >
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
      {fotoCorpo && !trabalhando && !erro ? (
        <p role="status" className="text-ink-2 text-xs">
          ✓ Foto recortada e pronta.
        </p>
      ) : null}
      {erro ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-orange-ink text-xs">
            {erro}
          </p>
          {arquivo && !trabalhando ? (
            <button
              type="button"
              onClick={() => void processar(arquivo)}
              className="text-orange-ink text-xs font-medium underline"
            >
              Tentar de novo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
