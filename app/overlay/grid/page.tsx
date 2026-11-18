"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { corDoKart } from "@/lib/kart-cor";
import { PatrocinadorLogo } from "@/components/overlay/patrocinador-logo";

interface PatrocinadorGrid {
  nome: string;
  logoUrl: string | null;
}

interface PilotoGrid {
  posicao: number;
  nome: string;
  numero: number | null;
  avatarUrl: string | null;
  uf: string | null;
  kartNumero: number | null;
  kartPlaca: string | null;
  melhorVoltaMs: number | null;
}

interface GridData {
  categoria: string | null;
  etapa: string | null;
  pilotos: PilotoGrid[];
  patrocinadores: PatrocinadorGrid[];
}

const ESTADO_INICIAL: GridData = {
  categoria: null,
  etapa: null,
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

// Mesmo padrão visual do live-timing e do resultado/vencedor (tarjas na cor
// da marca + tabela clara com selo colorido do kart) — aqui em tela cheia,
// já que o grid de largada é uma tela de transição entre segmentos da
// transmissão, não um overlay permanente sobre o vídeo.
export default function OverlayGridPage() {
  const [dados, setDados] = useState<GridData>(ESTADO_INICIAL);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const resposta = await fetch(
          `/api/overlay/grid-largada${window.location.search}`,
          { cache: "no-store" },
        );
        const json: GridData = await resposta.json();
        if (ativo) setDados(json);
      } catch {
        // Falha pontual de rede: mantém a última grade exibida.
      }
    }

    carregar();
    const intervalo = setInterval(carregar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  const { categoria, etapa, pilotos, patrocinadores } = dados;
  const colunaEsquerda = pilotos.filter((_, indice) => indice % 2 === 0);
  const colunaDireita = pilotos.filter((_, indice) => indice % 2 === 1);

  return (
    <div className="fixed inset-0 flex items-center justify-center font-sans">
      <div className="bg-surface flex w-[900px] max-w-[92vw] flex-col overflow-hidden rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <div className="bg-orange text-on-orange flex items-center justify-between gap-4 px-8 py-4">
          <span className="text-2xl font-black tracking-widest uppercase">
            Grid de largada
          </span>
          <span className="truncate text-lg font-bold uppercase">
            {categoria ?? ""}
            {etapa ? ` · ${etapa}` : ""}
          </span>
        </div>

        {pilotos.length === 0 ? (
          <p className="text-ink-2 py-16 text-center text-base">
            Aguardando resultado da classificação…
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 px-6 py-5">
            <div className="flex flex-col">
              {colunaEsquerda.map((piloto) => (
                <LinhaGrid key={piloto.posicao} piloto={piloto} />
              ))}
            </div>
            <div className="flex flex-col">
              {colunaDireita.map((piloto) => (
                <LinhaGrid key={piloto.posicao} piloto={piloto} />
              ))}
            </div>
          </div>
        )}

        {patrocinadores.length > 0 ? (
          <div className="border-ink/8 flex flex-wrap items-center justify-center gap-4 border-t bg-white px-6 py-3">
            {patrocinadores.map((patrocinador) => (
              <PatrocinadorLogo
                key={patrocinador.nome}
                nome={patrocinador.nome}
                logoUrl={patrocinador.logoUrl}
                variant="light"
                className="h-6 w-auto max-w-20"
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LinhaGrid({ piloto }: { piloto: PilotoGrid }) {
  return (
    <div className="border-ink/8 flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <span className="text-ink font-display w-7 shrink-0 text-right text-xl font-black">
        {piloto.posicao}
      </span>
      <span className="border-ink/10 bg-ink/5 text-ink-2 font-display flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[11px] font-bold">
        {piloto.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar vindo do cadastro, sem domínio fixo pra otimizar
          <img
            src={piloto.avatarUrl}
            alt={piloto.nome}
            className="h-full w-full object-cover"
          />
        ) : (
          iniciaisDoNome(piloto.nome)
        )}
      </span>
      <span className="text-ink min-w-0 flex-1 truncate text-[15px] font-black tracking-tight uppercase">
        {piloto.nome}
      </span>
      {piloto.uf ? (
        <span className="bg-ink/5 text-ink-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase">
          {piloto.uf}
        </span>
      ) : null}
      {piloto.kartPlaca ? (
        <span
          className={clsx(
            "font-display shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-bold",
            corDoKart(piloto.kartNumero ?? 0),
          )}
        >
          {piloto.kartPlaca}
        </span>
      ) : null}
      {piloto.melhorVoltaMs ? (
        <span className="text-ink-2 font-display w-16 shrink-0 text-right text-xs">
          {formatTempoVolta(piloto.melhorVoltaMs)}
        </span>
      ) : null}
    </div>
  );
}
