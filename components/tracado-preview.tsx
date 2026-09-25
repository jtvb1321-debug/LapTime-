import {
  PISTA_ALTURA,
  PISTA_BASE_SRC,
  PISTA_LARGURA,
  PISTA_VIEWBOX,
} from "@/lib/pista";
import { pontosParaCurvaSuave } from "@/lib/curva-suave";
import { MarcadorLargada } from "@/components/tracado-marcador-largada";
import type { PontoTracado, SentidoProva } from "@/lib/types";

// Espessura como fração do tamanho do traçado (não um valor fixo) pra ficar
// proporcional tanto numa miniatura de 48px quanto no card grande da página
// pública.
const ESPESSURA_RELATIVA = 0.05;
const MARGEM_MARCADOR = 50;
const COR_FUNDO = "#12141b";
const COR_PISTA = "#8b5cf6";
const COR_PISTA_SOMBRA = "#4c1d95";

// Visual inspirado nos cartões de circuito de transmissão (tipo os mapas de
// pista da F1 usados pelas equipes): fundo escuro, traçado como uma linha
// colorida com uma sombra central mais escura (efeito "tubo") e, no card em
// destaque, um contorno enorme e suave do mesmo traçado ao fundo dando
// profundidade — em vez da faixa cinza grossa de antes, que ficava sem graça.
export function TracadoPreview({
  pontos,
  linhaChegada,
  sentido,
  fechado = true,
  comGlow = false,
  comBase = false,
  aspectRatio,
  className,
}: {
  pontos: PontoTracado[];
  linhaChegada?: PontoTracado;
  sentido?: SentidoProva;
  fechado?: boolean;
  comGlow?: boolean;
  comBase?: boolean;
  // Largura/altura do quadro onde o preview vai ser exibido (ex.: 2 pra uma
  // caixa 2x mais larga que alta). Sem isso, o viewBox fica com a mesma
  // proporção do traçado em si — que raramente bate com a caixa (quase
  // sempre mais larga que alta) — e o SVG (que nunca distorce, só encaixa
  // mantendo proporção) sobra um respiro enorme dos lados, fazendo o
  // traçado parecer pequeno/desalinhado em vez de preencher o quadro.
  aspectRatio?: number;
  className?: string;
}) {
  if (pontos.length < 2) {
    return <svg viewBox={PISTA_VIEWBOX} className={className} />;
  }

  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  if (linhaChegada) {
    xs.push(linhaChegada.x - MARGEM_MARCADOR, linhaChegada.x + MARGEM_MARCADOR);
    ys.push(linhaChegada.y - MARGEM_MARCADOR, linhaChegada.y + MARGEM_MARCADOR);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const altura = Math.max(1, Math.max(...ys) - minY);
  const largura = Math.max(1, maxX - minX);
  const espessura = Math.max(largura, altura) * ESPESSURA_RELATIVA;
  // O selo de largada fica acima do ponto marcado — com marcador, a margem
  // precisa sobrar bem mais no topo pra não cortar o selo.
  const padding =
    Math.max(largura, altura) * (linhaChegada ? 0.28 : 0.14) + espessura;

  const larguraBase = largura + padding * 2;
  const alturaBase = altura + padding * 2;
  // Cresce (nunca corta) a partir do centro até a caixa bater na proporção
  // pedida, preenchendo o quadro de ponta a ponta sem esticar/distorcer a
  // curva em si — só sobra mais fundo visível de um lado ou de outro.
  let larguraFinal = larguraBase;
  let alturaFinal = alturaBase;
  if (aspectRatio) {
    const razaoAtual = larguraBase / alturaBase;
    if (razaoAtual < aspectRatio) {
      larguraFinal = alturaBase * aspectRatio;
    } else {
      alturaFinal = larguraBase / aspectRatio;
    }
  }
  const extraX = (larguraFinal - larguraBase) / 2;
  const extraY = (alturaFinal - alturaBase) / 2;
  const viewX = minX - padding - extraX;
  const viewY = minY - padding - extraY;

  const viewBox = comBase
    ? PISTA_VIEWBOX
    : `${viewX} ${viewY} ${larguraFinal} ${alturaFinal}`;
  const caminho = pontosParaCurvaSuave(pontos, fechado);
  const escalaMarcador = comBase ? 1 : Math.max(largura, altura) / 260;

  return (
    <svg viewBox={viewBox} className={className}>
      {comBase ? (
        <image
          href={PISTA_BASE_SRC}
          x={0}
          y={0}
          width={PISTA_LARGURA}
          height={PISTA_ALTURA}
          opacity={0.25}
        />
      ) : (
        <rect
          x={viewX}
          y={viewY}
          width={larguraFinal}
          height={alturaFinal}
          fill={COR_FUNDO}
        />
      )}
      {comGlow && !comBase ? (
        <path
          d={caminho}
          fill="none"
          stroke={COR_PISTA}
          strokeWidth={espessura * 3.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: "blur(9px)", opacity: 0.16 }}
        />
      ) : null}
      <path
        d={caminho}
        fill="none"
        stroke={COR_PISTA}
        strokeWidth={comBase ? 30 : espessura}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {!comBase ? (
        <path
          d={caminho}
          fill="none"
          stroke={COR_PISTA_SOMBRA}
          strokeWidth={espessura * 0.22}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ opacity: 0.85 }}
        />
      ) : null}
      {linhaChegada ? (
        <MarcadorLargada
          ponto={linhaChegada}
          sentido={sentido}
          escala={escalaMarcador}
        />
      ) : null}
    </svg>
  );
}
