// Recorte do piloto (remoção de fundo) feito no navegador, sem enviar a foto a lugar nenhum.
// Motor: onnxruntime-web (MIT). Modelo: MODNet de retrato (Apache-2.0, Xenova/modnet), quantizado,
// hospedado no próprio site em /ia (cerca de 6,6 MB; o navegador guarda depois da primeira vez).
// O onnxruntime-web não traz tipos para a variante só-WASM; aqui ficam só os pedaços que usamos.
interface Saida {
  data: Float32Array;
}
interface Sessao {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(entradas: Record<string, unknown>): Promise<Record<string, Saida>>;
}
interface Ort {
  env: { wasm: { wasmPaths: string; numThreads: number; proxy: boolean } };
  InferenceSession: {
    create(
      modelo: ArrayBuffer,
      opcoes: { executionProviders: string[]; graphOptimizationLevel: string },
    ): Promise<Sessao>;
  };
  Tensor: new (tipo: "float32", dados: Float32Array, dims: number[]) => unknown;
}

export class ErroDeFoto extends Error {}

const URL_MODELO = "/ia/modnet.onnx";
const URL_ORT = "/ia/ort/";
// O modelo usa o lado menor em 512 px (múltiplo de 32), como no pré-processamento oficial.
const LADO_MENOR = 512;
const LADO_MAXIMO_MODELO = 1024;
// Resolução da imagem recortada (já é mais do que o vídeo precisa).
const LADO_MAXIMO_SAIDA = 1400;

type Motor = { ort: Ort; sessao: Sessao };

let motor: Promise<Motor> | null = null;
let fracaoDeDownload = 0;
const ouvintes = new Set<(fracao: number) => void>();

function avisar(fracao: number) {
  fracaoDeDownload = fracao;
  ouvintes.forEach((f) => f(fracao));
}

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar o recorte (${r.status}).`);
  const total = Number(r.headers.get("content-length")) || 0;
  if (!r.body) return r.arrayBuffer();
  const leitor = r.body.getReader();
  const partes: Uint8Array[] = [];
  let lido = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    lido += value.length;
    avisar(total ? Math.min(1, lido / total) : 0);
  }
  const saida = new Uint8Array(lido);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida.buffer;
}

// Baixa o motor e o modelo (uma vez por página). Pode ser chamado antes, para adiantar o download.
export function prepararMotor(
  aoProgredir?: (fracao: number) => void,
): Promise<Motor> {
  if (aoProgredir) {
    ouvintes.add(aoProgredir);
    aoProgredir(fracaoDeDownload);
  }
  motor ??= (async () => {
    // @ts-expect-error -- o pacote não traz tipos para esta variante
    const ort = (await import("onnxruntime-web/wasm")) as Ort;
    ort.env.wasm.wasmPaths = URL_ORT;
    // Uma thread: não exige isolamento de origem (SharedArrayBuffer) e funciona em qualquer navegador.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const modelo = await baixar(URL_MODELO);
    const sessao = await ort.InferenceSession.create(modelo, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    return { ort, sessao };
  })().catch((e) => {
    motor = null;
    fracaoDeDownload = 0;
    throw e;
  });
  const pronto = motor;
  if (aoProgredir) {
    const f = aoProgredir;
    pronto.finally(() => ouvintes.delete(f)).catch(() => undefined);
  }
  return pronto;
}

const limitar = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

// Devolve um canvas com a foto e o fundo transparente. O corte e a exportação ficam com quem chama.
export async function recortarFoto(
  arquivo: File,
  aoProgredir: (fracao: number, etapa: string) => void,
): Promise<HTMLCanvasElement> {
  aoProgredir(0, "Preparando a foto…");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new ErroDeFoto(
      "Não foi possível abrir esta imagem. Use um arquivo JPG, PNG ou WEBP.",
    );
  }
  try {
    const { ort, sessao } = await prepararMotor((f) =>
      aoProgredir(f, "Baixando o recorte automático (só na primeira vez)…"),
    );
    aoProgredir(0, "Recortando o piloto…");

    const esc = Math.min(
      1,
      LADO_MAXIMO_SAIDA / Math.max(bmp.width, bmp.height),
    );
    const w0 = Math.max(1, Math.round(bmp.width * esc));
    const h0 = Math.max(1, Math.round(bmp.height * esc));

    let s = LADO_MENOR / Math.min(w0, h0);
    if (Math.max(w0, h0) * s > LADO_MAXIMO_MODELO) {
      s = LADO_MAXIMO_MODELO / Math.max(w0, h0);
    }
    const W = Math.max(32, Math.round((w0 * s) / 32) * 32);
    const H = Math.max(32, Math.round((h0 * s) / 32) * 32);

    const cm = document.createElement("canvas");
    cm.width = W;
    cm.height = H;
    const mctx = cm.getContext("2d", { willReadFrequently: true });
    if (!mctx) throw new Error("Sem suporte a imagem.");
    mctx.drawImage(bmp, 0, 0, W, H);
    const px = mctx.getImageData(0, 0, W, H).data;

    // Entrada [1, 3, H, W], normalizada com média 0,5 e desvio 0,5.
    const plano = W * H;
    const entrada = new Float32Array(3 * plano);
    for (let i = 0; i < plano; i++) {
      entrada[i] = (px[4 * i] / 255 - 0.5) / 0.5;
      entrada[plano + i] = (px[4 * i + 1] / 255 - 0.5) / 0.5;
      entrada[2 * plano + i] = (px[4 * i + 2] / 255 - 0.5) / 0.5;
    }
    const tensor = new ort.Tensor("float32", entrada, [1, 3, H, W]);
    const resultado = await sessao.run({ [sessao.inputNames[0]]: tensor });
    const matte = resultado[sessao.outputNames[0]].data;
    aoProgredir(0.9, "Finalizando o recorte…");

    // Matte (0 a 1) vira uma máscara em tons de cinza, ampliada até o tamanho da foto.
    const mascara = document.createElement("canvas");
    mascara.width = W;
    mascara.height = H;
    const mk = mascara.getContext("2d");
    if (!mk) throw new Error("Sem suporte a imagem.");
    const mi = mk.createImageData(W, H);
    for (let i = 0; i < plano; i++) {
      const v = limitar(matte[i] * 255);
      mi.data[4 * i] = v;
      mi.data[4 * i + 1] = v;
      mi.data[4 * i + 2] = v;
      mi.data[4 * i + 3] = 255;
    }
    mk.putImageData(mi, 0, 0);

    const saida = document.createElement("canvas");
    saida.width = w0;
    saida.height = h0;
    const sctx = saida.getContext("2d", { willReadFrequently: true });
    if (!sctx) throw new Error("Sem suporte a imagem.");
    sctx.drawImage(bmp, 0, 0, w0, h0);
    const foto = sctx.getImageData(0, 0, w0, h0);

    const grande = document.createElement("canvas");
    grande.width = w0;
    grande.height = h0;
    const gctx = grande.getContext("2d", { willReadFrequently: true });
    if (!gctx) throw new Error("Sem suporte a imagem.");
    gctx.imageSmoothingEnabled = true;
    gctx.imageSmoothingQuality = "high";
    gctx.drawImage(mascara, 0, 0, w0, h0);
    const m = gctx.getImageData(0, 0, w0, h0).data;

    for (let i = 0; i < w0 * h0; i++) {
      const a = m[4 * i];
      // Tira o chuvisco quase transparente e firma o que é quase sólido.
      foto.data[4 * i + 3] = a < 12 ? 0 : a > 243 ? 255 : a;
    }
    sctx.putImageData(foto, 0, 0);
    return saida;
  } finally {
    bmp.close();
  }
}
