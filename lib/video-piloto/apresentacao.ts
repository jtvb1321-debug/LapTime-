// Vídeo de apresentação do piloto (8 s, 1920x1080): abertura com a logo Grid Lap e cartão com o
// piloto recortado, número, nome e as cores escolhidas por ele. É desenhado quadro a quadro num
// <canvas> (a mesma função serve para a prévia na tela e para gravar o arquivo).

export const LARGURA = 1920;
export const ALTURA = 1080;
export const DURACAO = 8;
// Quadro usado na prévia estática (cartão já completo).
export const QUADRO_PREVIA = 6;

export interface DadosApresentacao {
  numero: number;
  nome: string; // nome completo; o primeiro nome entra pequeno e o último, grande
  corFaixa: string; // faixa grande diagonal
  corDestaque: string; // faixa fina, número e linha
}

export interface Recursos {
  logo: HTMLImageElement;
  corpo: HTMLImageElement | null;
}

const FUNDO_ABERTURA = "#000000";
const FUNDO_CARTAO_A = "#0a1a55";
const FUNDO_CARTAO_B = "#050d2e";
const FONTE = '"Arial Black", "Segoe UI Black", Arial, sans-serif';

const lim = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const parte = (t: number, ini: number, fim: number) =>
  lim((t - ini) / (fim - ini));
const saida = (x: number) => 1 - Math.pow(1 - x, 3); // ease-out
const suave = (x: number) => x * x * (3 - 2 * x);

export function partesDoNome(nome: string): {
  primeiro: string;
  resto: string;
} {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return { primeiro: "", resto: p[0] ?? "" };
  return { primeiro: p[0], resto: p[p.length - 1] };
}

function desenharLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  cx: number,
  cy: number,
  largura: number,
  alpha: number,
  brilho: number,
) {
  if (alpha <= 0 || !logo.naturalWidth) return;
  const altura = (largura * logo.naturalHeight) / logo.naturalWidth;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (brilho > 0) {
    ctx.shadowColor = "rgba(76, 201, 255, 0.9)";
    ctx.shadowBlur = brilho;
  }
  ctx.drawImage(logo, cx - largura / 2, cy - altura / 2, largura, altura);
  ctx.restore();
}

function abertura(ctx: CanvasRenderingContext2D, t: number, r: Recursos) {
  ctx.fillStyle = FUNDO_ABERTURA;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  const entra = saida(parte(t, 0.2, 1.0));
  const some = 1 - suave(parte(t, 2.1, 2.7));
  const escala = 0.9 + 0.1 * entra;
  const brilho = 30 * Math.sin(Math.PI * parte(t, 0.4, 2.2));
  desenharLogo(
    ctx,
    r.logo,
    LARGURA / 2,
    ALTURA / 2,
    820 * escala,
    entra * some,
    brilho,
  );
  // Risco de luz que cruza a logo.
  const luz = parte(t, 0.5, 1.5);
  if (luz > 0 && luz < 1) {
    const x = -200 + (LARGURA + 400) * suave(luz);
    const g = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
    g.addColorStop(0, "rgba(76,201,255,0)");
    g.addColorStop(0.5, "rgba(76,201,255,0.22)");
    g.addColorStop(1, "rgba(76,201,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 120, 0, 240, ALTURA);
  }
}

function faixa(
  ctx: CanvasRenderingContext2D,
  topoEsq: number,
  topoDir: number,
  baseEsq: number,
  baseDir: number,
  cor: string,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(topoEsq, 0);
  ctx.lineTo(topoDir, 0);
  ctx.lineTo(baseDir, ALTURA);
  ctx.lineTo(baseEsq, ALTURA);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function cartao(
  ctx: CanvasRenderingContext2D,
  t: number,
  d: DadosApresentacao,
  r: Recursos,
) {
  // t = tempo desde o início do cartão (0 = 2,7 s do vídeo)
  const fundo = ctx.createLinearGradient(0, 0, LARGURA, ALTURA);
  fundo.addColorStop(0, FUNDO_CARTAO_A);
  fundo.addColorStop(1, FUNDO_CARTAO_B);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // Número gigante, só contorno, atrás do piloto.
  const marca = saida(parte(t, 0.2, 1.2));
  ctx.save();
  ctx.globalAlpha = 0.28 * marca;
  ctx.font = `900 ${Math.round(ALTURA * 0.95)}px ${FONTE}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = d.corDestaque;
  ctx.strokeText(String(d.numero), LARGURA * 0.77, ALTURA * 0.52);
  ctx.restore();

  // Faixas diagonais entrando pela direita.
  const desl = (1 - saida(parte(t, 0, 0.9))) * LARGURA * 0.35;
  ctx.save();
  ctx.translate(desl, 0);
  faixa(
    ctx,
    LARGURA * 0.5,
    LARGURA * 0.7,
    LARGURA * 0.14,
    LARGURA * 0.34,
    d.corFaixa,
  );
  faixa(
    ctx,
    LARGURA * 0.715,
    LARGURA * 0.73,
    LARGURA * 0.355,
    LARGURA * 0.37,
    d.corDestaque,
  );
  faixa(
    ctx,
    LARGURA * 0.745,
    LARGURA * 0.755,
    LARGURA * 0.385,
    LARGURA * 0.395,
    d.corDestaque,
    0.7,
  );
  ctx.restore();

  // Piloto recortado (entra e faz um zoom lento).
  if (r.corpo && r.corpo.naturalWidth) {
    const entra = saida(parte(t, 0.3, 1.2));
    const zoom = 1 + 0.045 * (t / 5.3);
    const h = ALTURA * 1.02 * zoom;
    const w = (h * r.corpo.naturalWidth) / r.corpo.naturalHeight;
    const cx = LARGURA * 0.76 + (1 - entra) * 160;
    ctx.save();
    ctx.globalAlpha = entra;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 40;
    ctx.drawImage(r.corpo, cx - w / 2, ALTURA * 1.01 - h, w, h);
    ctx.restore();
  }

  // Número, linha e nome.
  const x0 = LARGURA * 0.05;
  const num = saida(parte(t, 0.5, 1.2));
  ctx.save();
  ctx.globalAlpha = num;
  ctx.font = `900 150px ${FONTE}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = d.corDestaque;
  ctx.fillText(String(d.numero), x0, ALTURA * 0.6 + (1 - num) * 40);
  ctx.restore();

  const linha = saida(parte(t, 0.8, 1.5));
  ctx.fillStyle = d.corDestaque;
  ctx.fillRect(x0, ALTURA * 0.635, LARGURA * 0.24 * linha, 5);

  const { primeiro, resto } = partesDoNome(d.nome);
  const letras = Math.floor(primeiro.length * parte(t, 1.0, 1.8));
  ctx.save();
  ctx.font = `700 54px ${FONTE}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  if ("letterSpacing" in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = "6px";
  }
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = FUNDO_CARTAO_B;
  ctx.strokeText(primeiro.slice(0, letras).toUpperCase(), x0, ALTURA * 0.71);
  ctx.fillText(primeiro.slice(0, letras).toUpperCase(), x0, ALTURA * 0.71);
  ctx.restore();

  const sobrenome = resto.toUpperCase();
  let tamanho = 150;
  ctx.font = `900 ${tamanho}px ${FONTE}`;
  const maxLargura = LARGURA * 0.5;
  const medida = ctx.measureText(sobrenome).width;
  if (medida > maxLargura)
    tamanho = Math.floor((tamanho * maxLargura) / medida);
  const rev = saida(parte(t, 1.4, 2.2));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 10, ALTURA * 0.7, (maxLargura + 40) * rev, ALTURA * 0.3);
  ctx.clip();
  ctx.font = `900 ${tamanho}px ${FONTE}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(8, tamanho * 0.07);
  ctx.strokeStyle = FUNDO_CARTAO_B;
  ctx.strokeText(
    sobrenome,
    x0 - 4 + (1 - rev) * -60,
    ALTURA * 0.71 + tamanho * 0.95,
  );
  ctx.fillText(
    sobrenome,
    x0 - 4 + (1 - rev) * -60,
    ALTURA * 0.71 + tamanho * 0.95,
  );
  ctx.restore();

  // Logo pequena no canto.
  desenharLogo(
    ctx,
    r.logo,
    LARGURA * 0.9,
    ALTURA * 0.93,
    230,
    saida(parte(t, 2.0, 2.8)),
    0,
  );
}

// Desenha o quadro do instante `t` (segundos, 0 a DURACAO).
export function desenharQuadro(
  ctx: CanvasRenderingContext2D,
  t: number,
  dados: DadosApresentacao,
  recursos: Recursos,
) {
  ctx.clearRect(0, 0, LARGURA, ALTURA);
  const inicioCartao = 2.7;
  if (t < inicioCartao) {
    abertura(ctx, t, recursos);
    return;
  }
  cartao(ctx, t - inicioCartao, dados, recursos);
  // Entrada: o preto da abertura se dissolve no cartão.
  const mistura = 1 - suave(parte(t, inicioCartao, inicioCartao + 0.35));
  if (mistura > 0) {
    ctx.fillStyle = `rgba(0,0,0,${mistura})`;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  }
}

export function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Não foi possível carregar a imagem."));
    img.src = src;
  });
}

// Grava a animação num arquivo (MP4 quando o navegador sabe gerar, senão WebM). Roda em tempo
// real (8 s); a aba precisa continuar aberta e visível.
export async function gravarVideo(
  dados: DadosApresentacao,
  recursos: Recursos,
  aoProgredir: (fracao: number) => void,
): Promise<{ blob: Blob; extensao: "mp4" | "webm" }> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Este navegador não grava vídeo. Use o Chrome ou o Edge.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sem suporte a desenho neste navegador.");

  const candidatos = [
    'video/mp4;codecs="avc1.640028"',
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  const tipo = candidatos.find((c) => MediaRecorder.isTypeSupported(c));
  if (!tipo) throw new Error("Este navegador não grava vídeo.");

  const fluxo = canvas.captureStream(30);
  const gravador = new MediaRecorder(fluxo, {
    mimeType: tipo,
    videoBitsPerSecond: 12_000_000,
  });
  const partes: Blob[] = [];
  gravador.ondataavailable = (e) => {
    if (e.data.size) partes.push(e.data);
  };
  const terminou = new Promise<void>((resolve) => {
    gravador.onstop = () => resolve();
  });

  desenharQuadro(ctx, 0, dados, recursos);
  gravador.start(250);
  const inicio = performance.now();
  await new Promise<void>((resolve) => {
    const passo = () => {
      const t = (performance.now() - inicio) / 1000;
      desenharQuadro(ctx, Math.min(t, DURACAO), dados, recursos);
      aoProgredir(Math.min(1, t / DURACAO));
      if (t >= DURACAO) resolve();
      else requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
  gravador.stop();
  await terminou;
  fluxo.getTracks().forEach((f) => f.stop());
  return {
    blob: new Blob(partes, { type: tipo.split(";")[0] }),
    extensao: tipo.startsWith("video/mp4") ? "mp4" : "webm",
  };
}
