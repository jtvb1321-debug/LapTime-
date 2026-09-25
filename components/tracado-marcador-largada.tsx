import { useId } from "react";
import type { PontoTracado, SentidoProva } from "@/lib/types";

// Selo de largada/chegada minimalista, no estilo dos mapas de circuito de
// transmissão: só a bandeirinha quadriculada + uma seta pequena de sentido,
// sobre um halo circular branco (garante leitura em cima de qualquer cor de
// traçado), ligado ao ponto exato por uma linha fina — sem cartão, sombra ou
// divisor, pra não competir visualmente com o traçado.
export function MarcadorLargada({
  ponto,
  sentido,
  escala = 1,
}: {
  ponto: PontoTracado;
  sentido?: SentidoProva;
  escala?: number;
}) {
  const clipId = useId();
  const celula = 4.2 * escala;
  const colunas = 3;
  const linhas = 3;
  const larguraBandeira = colunas * celula;
  const alturaBandeira = linhas * celula;

  const offset = 15 * escala;
  const cx = ponto.x;
  const cy = ponto.y - offset - alturaBandeira / 2;
  const bandeiraX = cx - larguraBandeira / 2;
  const bandeiraY = cy - alturaBandeira / 2;

  const quadrados = [];
  for (let linha = 0; linha < linhas; linha++) {
    for (let coluna = 0; coluna < colunas; coluna++) {
      const preto = (linha + coluna) % 2 === 0;
      quadrados.push(
        <rect
          key={`${linha}-${coluna}`}
          x={bandeiraX + coluna * celula}
          y={bandeiraY + linha * celula}
          width={celula}
          height={celula}
          fill={preto ? "#171a23" : "#ffffff"}
        />,
      );
    }
  }

  const paraCima = sentido === "horario";
  const ponta = 6.5 * escala;
  const meia = 4 * escala;
  const setaCx = bandeiraX + larguraBandeira + 7 * escala;
  const seta = paraCima
    ? `${setaCx},${cy - ponta} ${setaCx + meia},${cy + ponta * 0.55} ${setaCx},${cy + ponta * 0.15} ${setaCx - meia},${cy + ponta * 0.55}`
    : `${setaCx},${cy + ponta} ${setaCx + meia},${cy - ponta * 0.55} ${setaCx},${cy - ponta * 0.15} ${setaCx - meia},${cy - ponta * 0.55}`;

  const raioHalo =
    Math.max(larguraBandeira, alturaBandeira) / 2 +
    6 * escala +
    (sentido ? 9 * escala : 0);

  return (
    <g>
      <circle cx={cx} cy={cy} r={raioHalo} fill="#ffffff" opacity={0.94} />
      <line
        x1={ponto.x}
        y1={ponto.y}
        x2={cx}
        y2={bandeiraY + alturaBandeira}
        stroke="#171a23"
        strokeWidth={1.4 * escala}
      />
      <circle cx={ponto.x} cy={ponto.y} r={2.6 * escala} fill="#171a23" />

      <clipPath id={clipId}>
        <rect
          x={bandeiraX}
          y={bandeiraY}
          width={larguraBandeira}
          height={alturaBandeira}
          rx={1 * escala}
        />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{quadrados}</g>
      <rect
        x={bandeiraX}
        y={bandeiraY}
        width={larguraBandeira}
        height={alturaBandeira}
        rx={1 * escala}
        fill="none"
        stroke="#171a23"
        strokeWidth={0.7 * escala}
      />

      {sentido ? (
        <polygon
          points={seta}
          fill="#8b5cf6"
          stroke="#5b21b6"
          strokeWidth={0.5 * escala}
          strokeLinejoin="round"
        />
      ) : null}
    </g>
  );
}
