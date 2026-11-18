"use client";

import { useState } from "react";

export interface PontoEvolucao {
  rotulo: string; // "Etapa 1"
  pontosDaEtapa: number;
  acumulado: number;
}

const L = 640;
const A = 220;
const M = { e: 44, d: 20, t: 18, b: 34 };

// Evolução da pontuação (acumulada) por etapa, com os resultados oficiais já existentes. Toque ou
// passe o mouse num ponto para ver o detalhe da etapa.
export function EvolucaoPontos({ pontos }: { pontos: PontoEvolucao[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const maximo = Math.max(1, ...pontos.map((p) => p.acumulado));
  const topo = Math.ceil(maximo / 5) * 5 || 5;
  const x = (i: number) =>
    pontos.length === 1
      ? (L + M.e - M.d) / 2
      : M.e + ((L - M.e - M.d) * i) / (pontos.length - 1);
  const y = (v: number) => A - M.b - ((A - M.t - M.b) * v) / topo;
  const linha = pontos.map((p, i) => `${x(i)},${y(p.acumulado)}`).join(" ");
  const sel = ativo !== null ? pontos[ativo] : null;

  return (
    <div className="relative mx-auto max-w-2xl">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Evolução da pontuação: ${pontos
          .map((p) => `${p.rotulo}, ${p.acumulado} pontos`)
          .join("; ")}`}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={M.e}
              x2={L - M.d}
              y1={y(topo * f)}
              y2={y(topo * f)}
              stroke="rgba(160,190,255,0.14)"
            />
            <text
              x={M.e - 8}
              y={y(topo * f) + 4}
              textAnchor="end"
              fontSize="12"
              fill="#9fb2d4"
            >
              {Math.round(topo * f)}
            </text>
          </g>
        ))}
        <polyline
          points={linha}
          fill="none"
          stroke="#4cc9ff"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pontos.map((p, i) => (
          <g key={p.rotulo}>
            <text
              x={x(i)}
              y={A - 10}
              textAnchor="middle"
              fontSize="12"
              fill="#9fb2d4"
            >
              {p.rotulo}
            </text>
            <circle
              cx={x(i)}
              cy={y(p.acumulado)}
              r={ativo === i ? 6 : 4}
              fill={ativo === i ? "#ffffff" : "#2b6ef5"}
              stroke="#4cc9ff"
              strokeWidth="2"
            />
            <circle
              cx={x(i)}
              cy={y(p.acumulado)}
              r="18"
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${p.rotulo}: ${p.pontosDaEtapa} pontos na etapa, ${p.acumulado} no total`}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              onClick={() => setAtivo((v) => (v === i ? null : i))}
              className="cursor-pointer focus:outline-none"
            />
          </g>
        ))}
      </svg>
      {sel && ativo !== null ? (
        <div
          role="status"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-white/15 bg-[#050a14] px-3 py-1.5 text-xs whitespace-nowrap text-white"
          style={{
            left: `${Math.min(88, Math.max(12, (x(ativo) / L) * 100))}%`,
            top: `${(y(sel.acumulado) / A) * 100}%`,
            marginTop: -10,
          }}
        >
          <strong>{sel.rotulo}</strong> · +{sel.pontosDaEtapa} pts · total{" "}
          {sel.acumulado}
        </div>
      ) : null}
    </div>
  );
}
