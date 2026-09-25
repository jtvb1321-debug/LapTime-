import type { FFmpeg as TipoFFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { CenaTracado3D } from "./cena3d";
import { desenharOverlay } from "./overlay";
import type { VideoTracadoConfig } from "./tipos";
import { FPS } from "./timeline";

export interface OpcoesExportacao {
  config: VideoTracadoConfig;
  largura: number;
  altura: number;
  duracaoSegundos: number;
  usarBloom?: boolean;
  onProgresso?: (etapa: string, atual: number, total: number) => void;
}

// O pacote @ffmpeg/ffmpeg importado normalmente (via `import`) faz o
// bundler (Turbopack/webpack) tentar analisar estaticamente onde ele cria
// sua Web Worker — e falha em tempo de execução com "Cannot find module as
// expression is too dynamic". A build UMD (feita pra ser carregada via
// <script>, não via import) não passa pelo bundler, então não tem esse
// problema — por isso carregamos ela manualmente aqui.
declare global {
  interface Window {
    FFmpegWASM?: { FFmpeg: new () => TipoFFmpeg };
  }
}

let carregandoScript: Promise<void> | null = null;

function carregarScriptFFmpeg(): Promise<void> {
  if (window.FFmpegWASM) return Promise.resolve();
  if (carregandoScript) return carregandoScript;
  carregandoScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/ffmpeg/ffmpeg.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o FFmpeg."));
    document.head.appendChild(script);
  });
  return carregandoScript;
}

// Todo o pipeline roda no navegador (sem servidor/backend nenhum): renderiza
// a cena 3D quadro a quadro (não em tempo real — por isso funciona mesmo
// numa GPU fraca, só demora mais), compõe o overlay em cima de cada quadro
// num canvas 2D, e usa o FFmpeg compilado pra WebAssembly (rodando 100% na
// máquina do usuário, sem precisar instalar nada) pra juntar tudo num MP4.
export async function exportarVideo(opcoes: OpcoesExportacao): Promise<Blob> {
  const {
    config,
    largura,
    altura,
    duracaoSegundos,
    usarBloom = true,
    onProgresso,
  } = opcoes;

  onProgresso?.("Carregando o FFmpeg", 0, 1);
  await carregarScriptFFmpeg();
  if (!window.FFmpegWASM) {
    throw new Error("FFmpeg não carregou corretamente.");
  }
  const ffmpeg = new window.FFmpegWASM.FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    onProgresso?.("Codificando vídeo", Math.round(progress * 100), 100);
  });
  await ffmpeg.load({
    coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
    wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
    classWorkerURL: `${window.location.origin}/ffmpeg/worker.js`,
  });
  onProgresso?.("Carregando o FFmpeg", 1, 1);

  const cena = new CenaTracado3D(config, largura, altura, usarBloom);
  const canvasComposto = document.createElement("canvas");
  canvasComposto.width = largura;
  canvasComposto.height = altura;
  const ctx = canvasComposto.getContext("2d");
  if (!ctx) {
    cena.descartar();
    throw new Error("Canvas 2D não disponível neste navegador.");
  }
  // `desenharOverlay` limpa o canvas em que desenha (pensado pra ser um
  // canvas transparente separado, empilhado por cima do WebGL via CSS, como
  // no preview ao vivo). Por isso ele desenha num canvas próprio aqui, que
  // depois é composto por cima do quadro 3D — se desenhasse direto no
  // `canvasComposto`, apagaria o quadro que acabou de ser capturado.
  const canvasOverlay = document.createElement("canvas");
  canvasOverlay.width = largura;
  canvasOverlay.height = altura;
  const ctxOverlay = canvasOverlay.getContext("2d");
  if (!ctxOverlay) {
    cena.descartar();
    throw new Error("Canvas 2D não disponível neste navegador.");
  }

  const totalFrames = Math.round(duracaoSegundos * FPS);
  try {
    for (let i = 0; i < totalFrames; i++) {
      const t = i / FPS;
      cena.definirTempo(t);
      cena.renderizar();
      ctx.clearRect(0, 0, largura, altura);
      ctx.drawImage(cena.canvas, 0, 0, largura, altura);
      desenharOverlay(ctxOverlay, config, t, largura, altura);
      cena.desenharExtras(ctxOverlay, t, largura, altura);
      ctx.drawImage(canvasOverlay, 0, 0, largura, altura);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasComposto.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar quadro"))),
          "image/jpeg",
          0.92,
        );
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await ffmpeg.writeFile(`frame${String(i).padStart(5, "0")}.jpg`, bytes);
      onProgresso?.("Renderizando quadros", i + 1, totalFrames);
    }

    await ffmpeg.exec([
      "-framerate",
      String(FPS),
      "-i",
      "frame%05d.jpg",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "18",
      "-preset",
      "medium",
      "saida.mp4",
    ]);

    const dados = await ffmpeg.readFile("saida.mp4");
    const bytes =
      dados instanceof Uint8Array
        ? dados
        : new TextEncoder().encode(String(dados));
    return new Blob([bytes.slice()], { type: "video/mp4" });
  } finally {
    cena.descartar();
  }
}
