import type { VideoTracadoConfig } from "./tipos";
import { CENAS, progressoNaCena, suavizar } from "./timeline";

// Placa sólida arredondada por baixo de um bloco de texto — garante leitura
// tanto num fundo escuro quanto num fundo claro/branco (sombra sozinha não
// dá contraste suficiente quando o fundo também é claro).
function desenharPlaca(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largura: number,
  altura: number,
  raio: number,
) {
  ctx.save();
  ctx.fillStyle = "rgba(10,10,16,0.72)";
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.arcTo(x + largura, y, x + largura, y + altura, raio);
  ctx.arcTo(x + largura, y + altura, x, y + altura, raio);
  ctx.arcTo(x, y + altura, x, y, raio);
  ctx.arcTo(x, y, x + largura, y, raio);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Desenha os textos/logo/fade-to-black direto num canvas 2D — usado tanto
// pelo preview (canvas transparente por cima do WebGL) quanto pela
// exportação (composto em cima do frame capturado), garantindo que os dois
// produzam exatamente o mesmo resultado. Overlay de HTML/CSS não funcionaria
// aqui porque a captura de frame só lê o conteúdo de um canvas.
export function desenharOverlay(
  ctx: CanvasRenderingContext2D,
  config: VideoTracadoConfig,
  t: number,
  largura: number,
  altura: number,
) {
  ctx.clearRect(0, 0, largura, altura);
  const escala = largura / 1920;

  // Selo de identificação (nome/categoria/bateria/extensão) — entra durante
  // a revelação e some no encerramento.
  const entrando = suavizar(progressoNaCena(t, CENAS.revelacao));
  const saindo = 1 - suavizar(progressoNaCena(t, CENAS.encerramento));
  const opacidadeSelo = Math.min(entrando, saindo);

  if (opacidadeSelo > 0.01) {
    ctx.save();
    ctx.globalAlpha = opacidadeSelo;
    const x = 48 * escala;
    const linhaCategoria = `${config.category.toUpperCase()} · ${config.battery.toUpperCase()}`;
    const linhaNome = config.trackName.toUpperCase();
    const linhaExtensao = `EXTENSÃO ${config.trackLength}`;

    ctx.font = `800 ${26 * escala}px ui-sans-serif, system-ui`;
    const larguraNome = ctx.measureText(linhaNome).width;
    ctx.font = `700 ${13 * escala}px ui-sans-serif, system-ui`;
    const larguraMax = Math.max(
      larguraNome,
      ctx.measureText(linhaCategoria).width,
      ctx.measureText(linhaExtensao).width,
    );

    const padH = 18 * escala;
    const padV = 16 * escala;
    const alturaPlaca = 30 * escala + 24 * escala + 18 * escala + padV * 2;
    desenharPlaca(
      ctx,
      x - padH,
      altura - 96 * escala - 24 * escala - padV,
      larguraMax + padH * 2,
      alturaPlaca,
      10 * escala,
    );

    let y = altura - 96 * escala;
    ctx.fillStyle = config.primaryColor;
    ctx.font = `700 ${13 * escala}px ui-sans-serif, system-ui`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(linhaCategoria, x, y);

    y += 30 * escala;
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${26 * escala}px ui-sans-serif, system-ui`;
    ctx.fillText(linhaNome, x, y);

    y += 24 * escala;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `600 ${13 * escala}px ui-sans-serif, system-ui`;
    ctx.fillText(linhaExtensao, x, y);
    ctx.restore();
  }

  // "LARGADA" — discreto, canto superior direito, só durante a cena
  // dedicada a ela.
  const progressoLargada = progressoNaCena(t, CENAS.largada);
  const opacidadeLargada =
    progressoLargada > 0
      ? Math.sin(Math.PI * Math.min(progressoLargada, 1)) ** 0.6
      : 0;
  if (opacidadeLargada > 0.01) {
    ctx.save();
    ctx.globalAlpha = opacidadeLargada;
    ctx.font = `700 ${15 * escala}px ui-sans-serif, system-ui`;
    ctx.textAlign = "right";
    const espacado = config.startText.toUpperCase().split("").join(" ");
    const larguraTexto = ctx.measureText(espacado).width;
    desenharPlaca(
      ctx,
      largura - 48 * escala - larguraTexto - 14 * escala,
      64 * escala - 20 * escala,
      larguraTexto + 28 * escala,
      30 * escala,
      8 * escala,
    );
    ctx.fillStyle = config.secondaryColor;
    ctx.fillText(espacado, largura - 48 * escala, 64 * escala);
    ctx.restore();
  }

  // Fade in (abertura) / fade out (encerramento) pra preto.
  const fadeIn = 1 - suavizar(progressoNaCena(t, CENAS.abertura));
  const fadeOut = suavizar(progressoNaCena(t, CENAS.encerramento));
  const opacidadeFade = Math.max(fadeIn, fadeOut);
  if (opacidadeFade > 0.001) {
    ctx.save();
    ctx.globalAlpha = opacidadeFade;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, largura, altura);
    ctx.restore();
  }
}
