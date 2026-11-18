"use client";

import { useRef, useState } from "react";

const ALTURA_MAXIMA = 1000;
const LIMITE_CARACTERES = 850_000;
// A foto é reduzida antes de ir para o modelo: ele trabalha em ~1024 px de qualquer jeito, e fotos
// grandes de celular (12 MP ou mais) são o que deixava o recorte lento e travava o aparelho.
const LADO_ENTRADA = 1024;
const TEMPO_LIMITE_MS = 180_000;
// Modelo menor (quantizado): baixa bem mais rápido e roda melhor em celular.
const MODELO = "isnet_quint8" as const;

type Biblioteca = typeof import("@imgly/background-removal");

class ErroDeFoto extends Error {}

let biblioteca: Promise<Biblioteca> | null = null;
function carregarBiblioteca() {
  return (biblioteca ??= import("@imgly/background-removal").catch((e) => {
    biblioteca = null;
    throw e;
  }));
}

// Começa a baixar o modelo (fica em memória nesta página). Chamado assim que a pessoa toca em
// "Enviar foto": enquanto ela escolhe a imagem, o modelo já vem.
let modeloEmPreparo: Promise<void> | null = null;
function prepararModelo() {
  modeloEmPreparo ??= carregarBiblioteca()
    .then((m) => m.preload({ model: MODELO }))
    .catch(() => {
      modeloEmPreparo = null;
    });
  return modeloEmPreparo;
}

// Reduz a foto (lado maior de LADO_ENTRADA) respeitando a orientação do celular. Se o navegador não
// conseguir decodificar, devolve o arquivo original.
async function reduzirEntrada(arquivo: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(arquivo, {
      imageOrientation: "from-image",
    });
    const escala = Math.min(1, LADO_ENTRADA / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * escala));
    canvas.height = Math.max(1, Math.round(bmp.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? arquivo), "image/jpeg", 0.92),
    );
  } catch {
    return arquivo;
  }
}

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

// Recorta o piloto da foto (tira o fundo no próprio navegador: a foto não sai do aparelho; só o
// modelo de recorte é baixado) e devolve um WEBP com transparência, já aparado e reduzido para
// caber no envio.
async function recortar(
  arquivo: File,
  aoProgredir: (fracao: number, etapa: string) => void,
): Promise<string> {
  aoProgredir(0, "Preparando a foto…");
  const entrada = await reduzirEntrada(arquivo);
  const { removeBackground } = await carregarBiblioteca();
  const png = await comTempoLimite(
    removeBackground(entrada, {
      model: MODELO,
      output: { format: "image/png" },
      progress: (chave: string, atual: number, total: number) => {
        const baixando = chave.startsWith("fetch");
        aoProgredir(
          total ? atual / total : 0,
          baixando
            ? "Baixando o recorte automático (só na primeira vez)…"
            : "Recortando o piloto…",
        );
      },
    }),
  );
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
  } finally {
    URL.revokeObjectURL(url);
  }
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
  const ultimoArquivo = useRef<File | null>(null);
  const [temArquivo, setTemArquivo] = useState(false);

  async function processar(arquivo: File) {
    ultimoArquivo.current = arquivo;
    setTemArquivo(true);
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
            await recortar(arquivo, (fracao, etapa) =>
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
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > 25 * 1024 * 1024) {
      setErro("Imagem muito grande — escolha um arquivo de até 25 MB.");
      return;
    }
    await processar(arquivo);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-orange-ink w-fit cursor-pointer text-sm font-medium hover:underline"
        onClick={() => void prepararModelo()}
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
          {temArquivo && !trabalhando ? (
            <button
              type="button"
              onClick={() => void processar(ultimoArquivo.current!)}
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
