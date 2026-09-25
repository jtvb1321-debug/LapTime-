"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { PatrocinadorLogo } from "@/components/overlay/patrocinador-logo";
import { fonteAssinatura } from "@/lib/fonts";
import { corDoKart } from "@/lib/kart-cor";
import { formatGap } from "@/lib/mock/data";

const COR_NUMERO_PADRAO = "#8b5cf6";
const COR_ASSINATURA_PADRAO = "#f2f5f7";
const DURACAO_POPUP_MS = 6000;

interface PatrocinadorOverlay {
  nome: string;
  logoUrl: string | null;
}

interface PilotoOverlay {
  posicao: number;
  nome: string;
  numero: number | null;
  avatarUrl: string | null;
  uf: string | null;
  corNumero: string | null;
  corAssinatura: string | null;
  kartNumero: number | null;
  kartPlaca: string | null;
  voltaAtual: number | null;
  melhorVoltaMs: number;
  gapMs: number;
  voltaRapida: boolean;
}

interface OverlayData {
  bateria: {
    nome: string;
    status: string;
    numero: number;
    voltas: number;
    categoria: string | null;
    etapa: string | null;
  } | null;
  pilotos: PilotoOverlay[];
  patrocinadores: PatrocinadorOverlay[];
}

const ESTADO_INICIAL: OverlayData = {
  bateria: null,
  pilotos: [],
  patrocinadores: [],
};
const INTERVALO_MS = 4000;

type Tendencia = "subiu" | "desceu" | "igual";

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

// Setinha de variação de posição em relação à última leitura — mesmo
// recurso visual da referência de transmissão que o usuário mandou.
function SetaTendencia({ tendencia }: { tendencia: Tendencia | undefined }) {
  if (tendencia === "subiu") {
    return (
      <span aria-hidden className="text-[9px] leading-none text-emerald-600">
        ▲
      </span>
    );
  }
  if (tendencia === "desceu") {
    return (
      <span aria-hidden className="text-[9px] leading-none text-red-500">
        ▼
      </span>
    );
  }
  return (
    <span aria-hidden className="text-ink-3 text-[9px] leading-none">
      –
    </span>
  );
}

export default function OverlayLiveTimingPage() {
  const [dados, setDados] = useState<OverlayData>(ESTADO_INICIAL);
  const [tendencias, setTendencias] = useState<Map<number, Tendencia>>(
    new Map(),
  );
  const posicaoAnteriorRef = useRef<Map<number, number> | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const resposta = await fetch(
          `/api/overlay/live-timing${window.location.search}`,
          { cache: "no-store" },
        );
        const json: OverlayData = await resposta.json();
        if (!ativo) return;

        // Compara com a última leitura (por número do piloto) pra saber se
        // subiu, desceu ou manteve a posição — não vem pronto da API.
        const mapaAnterior = posicaoAnteriorRef.current;
        const novoMapa = new Map<number, number>();
        const novasTendencias = new Map<number, Tendencia>();
        json.pilotos.forEach((piloto) => {
          if (piloto.numero == null) return;
          novoMapa.set(piloto.numero, piloto.posicao);
          const anterior = mapaAnterior?.get(piloto.numero);
          if (anterior == null) {
            novasTendencias.set(piloto.numero, "igual");
          } else if (piloto.posicao < anterior) {
            novasTendencias.set(piloto.numero, "subiu");
          } else if (piloto.posicao > anterior) {
            novasTendencias.set(piloto.numero, "desceu");
          } else {
            novasTendencias.set(piloto.numero, "igual");
          }
        });
        posicaoAnteriorRef.current = novoMapa;
        setTendencias(novasTendencias);
        setDados(json);
      } catch {
        // Falha pontual de rede: mantém o último estado exibido em vez de
        // piscar o overlay durante uma transmissão ao vivo.
      }
    }

    carregar();
    const intervalo = setInterval(carregar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  // Popup transiente de volta rápida: dispara só quando o recorde muda (novo
  // piloto ou tempo melhor), não a cada polling — senão reapareceria a cada
  // 4s enquanto o mesmo piloto seguir com a volta mais rápida da bateria.
  const ultimoRecordeRef = useRef<{ numero: number | null; ms: number } | null>(
    null,
  );
  const timeoutPopupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popup, setPopup] = useState<PilotoOverlay | null>(null);

  useEffect(() => {
    const pilotoRecorde = dados.pilotos.find((p) => p.voltaRapida);
    if (!pilotoRecorde) return;
    const anterior = ultimoRecordeRef.current;
    const mudou =
      !anterior ||
      anterior.numero !== pilotoRecorde.numero ||
      anterior.ms !== pilotoRecorde.melhorVoltaMs;
    if (!mudou) return;

    ultimoRecordeRef.current = {
      numero: pilotoRecorde.numero,
      ms: pilotoRecorde.melhorVoltaMs,
    };
    setPopup(pilotoRecorde);
    if (timeoutPopupRef.current) clearTimeout(timeoutPopupRef.current);
    timeoutPopupRef.current = setTimeout(
      () => setPopup(null),
      DURACAO_POPUP_MS,
    );
  }, [dados]);

  useEffect(
    () => () => {
      if (timeoutPopupRef.current) clearTimeout(timeoutPopupRef.current);
    },
    [],
  );

  const { bateria, pilotos, patrocinadores } = dados;

  // Caixa compacta no canto superior esquerdo — igual à referência de
  // transmissão que o usuário mandou (3 tarjas de cabeçalho + lista clara +
  // rodapé de patrocinadores), só que nas cores da marca (roxo Grid Lap no
  // lugar do laranja) em vez de reproduzir as cores da referência.
  return (
    <>
      <div className="bg-surface/95 fixed top-4 left-4 flex w-[340px] flex-col overflow-hidden rounded-lg font-sans shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col">
          <div className="bg-orange flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase">
            <span className="truncate">{bateria?.categoria ?? "—"}</span>
            <span className="shrink-0">{bateria?.etapa ?? ""}</span>
          </div>
          <div className="bg-ink flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-semibold text-white">
            <span className="truncate">
              {bateria ? bateria.nome.replace(/\s*\(simulação\)\s*$/i, "") : ""}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="bg-orange h-1.5 w-1.5 animate-pulse rounded-full" />
              {bateria?.numero === 1 ? "Classificação" : "Ao vivo"}
            </span>
          </div>
          <div className="bg-orange flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase">
            <span>Volta</span>
            <span className="font-mono">
              {pilotos[0]?.voltaAtual ?? "-"}/{bateria?.voltas ?? "-"}
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          {pilotos.length === 0 ? (
            <div className="text-ink-2 px-3 py-4 text-center text-xs">
              Aguardando dados da corrida…
            </div>
          ) : (
            pilotos.map((piloto) => (
              <div
                key={piloto.posicao}
                className="border-ink/8 flex items-center gap-1.5 border-b px-2 py-1.5 last:border-b-0"
              >
                <span className="text-ink flex w-4 shrink-0 justify-center font-mono text-[13px] font-bold">
                  {piloto.posicao}
                </span>
                <SetaTendencia
                  tendencia={
                    piloto.numero != null
                      ? tendencias.get(piloto.numero)
                      : undefined
                  }
                />
                <span className="text-ink min-w-0 flex-1 truncate text-[12px] font-bold tracking-tight uppercase">
                  {piloto.nome}
                </span>
                {piloto.voltaRapida ? (
                  <span className="text-orange bg-orange/10 shrink-0 rounded px-1 py-0.5 text-[8px] font-bold">
                    VR
                  </span>
                ) : null}
                <span
                  className={clsx(
                    "shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-bold",
                    corDoKart(piloto.kartNumero ?? 0),
                  )}
                >
                  {piloto.numero}
                </span>
                <span className="text-ink w-16 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums">
                  {piloto.posicao === 1
                    ? formatTempoVolta(piloto.melhorVoltaMs)
                    : formatGap(piloto.gapMs)}
                </span>
              </div>
            ))
          )}
        </div>

        {patrocinadores.length > 0 ? (
          <div className="border-ink/8 flex flex-wrap items-center gap-2 border-t bg-white px-3 py-2">
            {patrocinadores.map((patrocinador) => (
              <PatrocinadorLogo
                key={patrocinador.nome}
                nome={patrocinador.nome}
                logoUrl={patrocinador.logoUrl}
                variant="light"
                className="h-5 w-auto max-w-14"
              />
            ))}
          </div>
        ) : null}
      </div>

      {popup ? (
        <div
          className="border-orange/50 fixed right-8 bottom-8 z-50 flex w-96 items-center gap-4 overflow-hidden rounded-2xl border bg-black/85 p-4 text-white shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md"
          style={{ animation: "overlay-popup-in 0.35s ease-out" }}
        >
          <span className="border-orange flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-black/40 font-mono text-sm font-semibold text-white">
            {popup.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar vindo do cadastro, sem domínio fixo pra otimizar
              <img
                src={popup.avatarUrl}
                alt={popup.nome}
                className="h-full w-full object-cover"
              />
            ) : (
              iniciaisDoNome(popup.nome)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-orange block text-[11px] font-bold tracking-widest uppercase">
              Fast Lap
            </span>
            <span
              className={`${fonteAssinatura.className} block truncate text-2xl leading-tight`}
              style={{ color: popup.corAssinatura ?? COR_ASSINATURA_PADRAO }}
            >
              {popup.nome}
            </span>
            <span className="block text-xs whitespace-nowrap text-white/60">
              {popup.numero != null ? (
                <span
                  className={fonteAssinatura.className}
                  style={{ color: popup.corNumero ?? COR_NUMERO_PADRAO }}
                >
                  {popup.numero}
                </span>
              ) : null}
              {popup.kartPlaca ? ` · Kart ${popup.kartPlaca}` : null}
            </span>
          </div>
          <span className="shrink-0 font-mono text-lg font-bold text-white">
            {formatTempoVolta(popup.melhorVoltaMs)}
          </span>
        </div>
      ) : null}
    </>
  );
}
