"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { PatrocinadorLogo } from "@/components/overlay/patrocinador-logo";
import { fonteAssinatura } from "@/lib/fonts";
import { corDoKart } from "@/lib/kart-cor";
import { formatGap } from "@/lib/mock/data";

// Sem cor própria escolhida no cadastro, ainda mostra uma assinatura
// coerente no card do vencedor — mesmo par de cores padrão do live-timing.
const COR_NUMERO_PADRAO = "#8b5cf6";
const COR_ASSINATURA_PADRAO = "#f2f5f7";

interface PatrocinadorResultado {
  nome: string;
  logoUrl: string | null;
}

interface PilotoResultado {
  posicao: number;
  nome: string;
  numero: number | null;
  avatarUrl: string | null;
  uf: string | null;
  kartNumero: number | null;
  melhorVoltaMs: number;
  gapMs: number;
  gapTexto?: string | null;
  voltas: number | null;
}

interface ResultadoData {
  corrida: {
    numero: number;
    categoria: string | null;
    etapa: string | null;
    kartodromo: string | null;
    campeonato: string | null;
  } | null;
  vencedor: {
    nome: string;
    avatarUrl: string | null;
    numero: number | null;
    corNumero: string | null;
    corAssinatura: string | null;
  } | null;
  pilotos: PilotoResultado[];
  patrocinadores: PatrocinadorResultado[];
}

const ESTADO_INICIAL: ResultadoData = {
  corrida: null,
  vencedor: null,
  pilotos: [],
  patrocinadores: [],
};
const INTERVALO_MS = 5000;

function iniciaisDoNome(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function formatTempoVolta(ms: number) {
  const minutos = Math.floor(ms / 60_000);
  const segundos = Math.floor((ms % 60_000) / 1_000);
  const milesimos = ms % 1_000;
  return `${minutos}:${String(segundos).padStart(2, "0")}.${String(milesimos).padStart(3, "0")}`;
}

// Tela de resultado final / vencedor da bateria, no mesmo padrão visual da
// referência que o usuário mandou: foto do vencedor à esquerda, tarjas da
// corrida na cor da marca, tabela de classificação completa e patrocinadores
// no rodapé. Link próprio (/overlay/resultado), separado do live-timing.
export default function OverlayResultadoPage() {
  const [dados, setDados] = useState<ResultadoData>(ESTADO_INICIAL);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const resposta = await fetch(
          `/api/overlay/resultado${window.location.search}`,
          { cache: "no-store" },
        );
        const json: ResultadoData = await resposta.json();
        if (ativo) setDados(json);
      } catch {
        // Falha pontual de rede: mantém o último resultado exibido.
      }
    }

    carregar();
    const intervalo = setInterval(carregar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  const { corrida, vencedor, pilotos, patrocinadores } = dados;

  if (!corrida || pilotos.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center font-sans">
        <p className="text-ink-2 bg-surface rounded-lg px-6 py-4 text-sm shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
          Aguardando resultado final da bateria…
        </p>
      </div>
    );
  }

  return (
    <div className="fixed top-8 left-1/2 w-[92vw] max-w-[1180px] -translate-x-1/2 overflow-hidden rounded-lg font-sans shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
      <div className="flex items-stretch">
        {/* Vencedor — número e assinatura em marca d'água atrás da foto,
        igual ao tratamento da página de perfil do piloto. */}
        <div className="bg-ink flex w-52 shrink-0 flex-col">
          <div className="bg-orange text-on-orange py-2 text-center text-sm font-black tracking-[0.2em] uppercase">
            Winner
          </div>
          <div className="relative flex-1 overflow-hidden">
            {vencedor?.numero != null ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9rem] leading-none font-black italic select-none"
                style={{
                  color: vencedor.corNumero ?? COR_NUMERO_PADRAO,
                  opacity: 0.3,
                }}
              >
                {vencedor.numero}
              </span>
            ) : null}
            {vencedor?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar vindo do cadastro, sem domínio fixo pra otimizar
              <img
                src={vencedor.avatarUrl}
                alt={vencedor.nome}
                className="relative h-full w-full object-cover"
              />
            ) : (
              <div className="relative flex h-full min-h-32 items-center justify-center text-4xl font-black text-white/25">
                {vencedor ? iniciaisDoNome(vencedor.nome) : "—"}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-2 py-2 text-center">
              <span
                className={`${fonteAssinatura.className} block truncate text-lg leading-none`}
                style={{
                  color: vencedor?.corAssinatura ?? COR_ASSINATURA_PADRAO,
                }}
              >
                {vencedor?.nome ?? "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="bg-orange text-on-orange flex items-center justify-between gap-3 px-4 py-1.5">
            <span className="shrink-0 text-sm font-black uppercase">
              Race {corrida.numero}
            </span>
            <span className="truncate text-xs font-semibold uppercase opacity-90">
              {corrida.kartodromo}
            </span>
            <span className="shrink-0 text-sm font-black uppercase">
              {corrida.categoria}
            </span>
          </div>
          <div className="bg-ink flex items-center justify-between gap-3 px-4 py-1 text-[10px] font-semibold tracking-wide text-white/70 uppercase">
            <span className="truncate">{corrida.etapa}</span>
            <span className="truncate">{corrida.campeonato}</span>
          </div>

          <div className="bg-surface flex flex-1 flex-col">
            {pilotos.map((piloto, indice) => (
              <div
                key={piloto.posicao}
                className={clsx(
                  "border-ink/8 flex items-center gap-2 border-b px-3 py-1 last:border-b-0",
                  indice === 0 && "bg-orange/10",
                )}
              >
                <span className="text-ink font-display w-5 shrink-0 text-right text-xs font-bold">
                  {piloto.posicao}
                </span>
                <span className="text-ink min-w-0 flex-1 truncate text-[12px] font-bold tracking-tight uppercase">
                  {piloto.nome}
                </span>
                {piloto.uf ? (
                  <span className="bg-ink/5 text-ink-2 shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase">
                    {piloto.uf}
                  </span>
                ) : null}
                <span
                  className={clsx(
                    "font-display shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-bold",
                    corDoKart(piloto.kartNumero ?? 0),
                  )}
                >
                  {piloto.numero}
                </span>
                <span className="text-ink-2 font-display w-7 shrink-0 text-right text-xs">
                  {piloto.voltas ?? "-"}
                </span>
                <span className="text-ink font-display w-20 shrink-0 text-right text-xs font-semibold tabular-nums">
                  {piloto.posicao === 1
                    ? formatTempoVolta(piloto.melhorVoltaMs)
                    : (piloto.gapTexto ?? formatGap(piloto.gapMs))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {patrocinadores.length > 0 ? (
        <div className="border-ink/8 flex flex-wrap items-center gap-3 border-t bg-white px-4 py-2">
          {patrocinadores.map((patrocinador) => (
            <PatrocinadorLogo
              key={patrocinador.nome}
              nome={patrocinador.nome}
              logoUrl={patrocinador.logoUrl}
              variant="light"
              className="h-5 w-auto max-w-16"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
