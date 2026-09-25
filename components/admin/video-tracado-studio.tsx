"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useMockStore } from "@/lib/use-mock-store";
import { CenaTracado3D } from "@/lib/video-tracado/cena3d";
import { desenharOverlay } from "@/lib/video-tracado/overlay";
import { exportarVideo } from "@/lib/video-tracado/exportar";
import { DURACAO_TOTAL } from "@/lib/video-tracado/timeline";
import { RESOLUCOES, type VideoTracadoConfig } from "@/lib/video-tracado/tipos";
import type { Tracado } from "@/lib/types";

const LARGURA_PREVIEW = 480;

function configPadrao(tracado: Tracado | undefined): VideoTracadoConfig {
  return {
    trackName: tracado?.nome ?? "Kartódromo VeloKart",
    category: "MASTER",
    battery: "BATERIA 01",
    startText: "LARGADA",
    trackLength: tracado?.extensaoMetros ? `${tracado.extensaoMetros}m` : "—",
    primaryColor: "#22d3ee",
    secondaryColor: "#ef4444",
    background: "#ffffff",
    trackPoints: tracado?.pontos ?? [],
    finishPoint: tracado?.linhaChegada,
    direction: tracado?.sentido,
    curvas: tracado?.curvas,
  };
}

export function VideoTracadoStudio({
  tracadosIniciais,
}: {
  tracadosIniciais: Tracado[];
}) {
  const [tracados] = useMockStore("gridlap:tracados", tracadosIniciais);
  const [tracadoId, setTracadoId] = useState(tracados[0]?.id ?? "");
  const tracadoSelecionado = tracados.find((t) => t.id === tracadoId);

  const [config, setConfig] = useState<VideoTracadoConfig>(() =>
    configPadrao(tracados[0]),
  );
  const [resolucaoIndex, setResolucaoIndex] = useState(0);
  const [usarBloom, setUsarBloom] = useState(true);
  const [tocando, setTocando] = useState(true);
  const [tempoAtual, setTempoAtual] = useState(0);

  const [exportando, setExportando] = useState(false);
  const [progresso, setProgresso] = useState<{
    etapa: string;
    atual: number;
    total: number;
  } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const resolucao = RESOLUCOES[resolucaoIndex];
  const alturaPreview = Math.round(
    LARGURA_PREVIEW * (resolucao.altura / resolucao.largura),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cenaRef = useRef<CenaTracado3D | null>(null);
  const rafRef = useRef<number>(0);
  const ultimoRef = useRef<number>(0);
  const tempoRef = useRef(0);

  // Troca o traçado selecionado sem perder as outras personalizações já
  // digitadas (nome/cores/etc.) — só atualiza os campos que dependem do
  // traçado em si.
  function selecionarTracado(id: string) {
    setTracadoId(id);
    const t = tracados.find((x) => x.id === id);
    setConfig((c) => ({
      ...c,
      trackName: t?.nome ?? c.trackName,
      trackLength: t?.extensaoMetros ? `${t.extensaoMetros}m` : c.trackLength,
      trackPoints: t?.pontos ?? [],
      finishPoint: t?.linhaChegada,
      direction: t?.sentido,
      curvas: t?.curvas,
    }));
  }

  // (Re)cria a cena 3D sempre que o traçado, as cores ou o bloom mudam —
  // reconstruir do zero é mais simples e confiável que tentar atualizar a
  // geometria/material de uma cena já existente.
  useEffect(() => {
    if (config.trackPoints.length < 2) return;
    const cena = new CenaTracado3D(
      config,
      LARGURA_PREVIEW,
      alturaPreview,
      usarBloom,
    );
    cenaRef.current = cena;
    const container = containerRef.current;
    container?.replaceChildren(cena.canvas, overlayRef.current!);
    cena.canvas.className = "absolute inset-0 h-full w-full";

    return () => {
      cena.descartar();
      cenaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tracadoId,
    config.primaryColor,
    config.secondaryColor,
    config.background,
    usarBloom,
    resolucaoIndex,
  ]);

  // Loop de preview: avança o tempo enquanto "tocando" estiver ligado,
  // desenha o quadro 3D e o overlay (texto/fade) por cima.
  useEffect(() => {
    function quadro(agora: number) {
      const cena = cenaRef.current;
      const overlay = overlayRef.current;
      if (!ultimoRef.current) ultimoRef.current = agora;
      const dt = (agora - ultimoRef.current) / 1000;
      ultimoRef.current = agora;

      if (tocando) {
        tempoRef.current = (tempoRef.current + dt) % DURACAO_TOTAL;
        setTempoAtual(tempoRef.current);
      }

      if (cena) {
        cena.definirTempo(tempoRef.current);
        cena.renderizar();
      }
      if (overlay) {
        const ctx = overlay.getContext("2d");
        if (ctx) {
          desenharOverlay(
            ctx,
            config,
            tempoRef.current,
            LARGURA_PREVIEW,
            alturaPreview,
          );
          cena?.desenharExtras(
            ctx,
            tempoRef.current,
            LARGURA_PREVIEW,
            alturaPreview,
          );
        }
      }
      rafRef.current = requestAnimationFrame(quadro);
    }
    rafRef.current = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(rafRef.current);
  }, [config, tocando, alturaPreview]);

  function moverScrubber(valor: number) {
    tempoRef.current = valor;
    setTempoAtual(valor);
    setTocando(false);
  }

  async function gerarVideo() {
    setErro("");
    setVideoUrl(null);
    setExportando(true);
    setTocando(false);
    try {
      const blob = await exportarVideo({
        config,
        largura: resolucao.largura,
        altura: resolucao.altura,
        duracaoSegundos: DURACAO_TOTAL,
        usarBloom,
        onProgresso: (etapa, atual, total) =>
          setProgresso({ etapa, atual, total }),
      });
      setVideoUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("Falha ao gerar vídeo:", e);
      setErro(
        e instanceof Error ? e.message : "Não foi possível gerar o vídeo.",
      );
    } finally {
      setExportando(false);
      setProgresso(null);
    }
  }

  const percentualExportacao = useMemo(() => {
    if (!progresso) return 0;
    return Math.round((progresso.atual / Math.max(progresso.total, 1)) * 100);
  }, [progresso]);

  if (tracados.length === 0) {
    return (
      <p className="text-ink-2 text-sm">
        Cadastre um traçado em{" "}
        <span className="text-ink font-medium">Traçados</span> antes de gerar o
        vídeo.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div
            ref={containerRef}
            className="relative mx-auto overflow-hidden rounded-lg bg-black"
            style={{ width: LARGURA_PREVIEW, height: alturaPreview }}
          >
            <canvas
              ref={overlayRef}
              width={LARGURA_PREVIEW}
              height={alturaPreview}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTocando((v) => !v)}
            >
              {tocando ? "Pausar" : "Tocar"}
            </Button>
            <input
              type="range"
              min={0}
              max={DURACAO_TOTAL}
              step={0.05}
              value={tempoAtual}
              onChange={(e) => moverScrubber(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-ink-2 w-14 shrink-0 text-right font-mono text-xs">
              {tempoAtual.toFixed(1)}s
            </span>
          </div>

          <div className="border-border-strong flex items-center gap-3 rounded-md border p-3">
            <div className="flex-1">
              <p className="text-ink text-sm font-medium">Gerar vídeo</p>
              <p className="text-ink-2 text-xs">
                {resolucao.label} · {DURACAO_TOTAL}s · 30fps — roda 100% no
                navegador, sem servidor.
              </p>
            </div>
            <select
              value={resolucaoIndex}
              onChange={(e) => setResolucaoIndex(Number(e.target.value))}
              disabled={exportando}
              className="border-border-strong rounded-md border px-2 py-1.5 text-xs"
            >
              {RESOLUCOES.map((r, i) => (
                <option key={r.label} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button type="button" onClick={gerarVideo} disabled={exportando}>
              {exportando ? "Gerando…" : "Gerar vídeo"}
            </Button>
          </div>

          {exportando && progresso ? (
            <div className="flex flex-col gap-1.5">
              <div className="bg-ink/10 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-orange h-full transition-all"
                  style={{ width: `${percentualExportacao}%` }}
                />
              </div>
              <p className="text-ink-2 text-xs">
                {progresso.etapa} — {progresso.atual}/{progresso.total} (
                {percentualExportacao}%)
              </p>
              <p className="text-ink-3 text-xs">
                Isso pode levar vários minutos dependendo da placa de vídeo. Não
                feche essa aba enquanto gera.
              </p>
            </div>
          ) : null}

          {erro ? <p className="text-orange text-sm">{erro}</p> : null}

          {videoUrl ? (
            <div className="flex flex-col gap-2">
              <video
                src={videoUrl}
                controls
                className="w-full rounded-md"
                style={{ maxHeight: 320 }}
              />
              <a
                href={videoUrl}
                download={`${config.trackName.replace(/\s+/g, "-").toLowerCase()}.mp4`}
                className="text-orange text-sm font-medium hover:underline"
              >
                Baixar MP4 →
              </a>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-ink text-sm font-medium">Traçado</label>
            <select
              value={tracadoId}
              onChange={(e) => selecionarTracado(e.target.value)}
              className="border-border-strong rounded-md border px-3 py-2 text-sm"
            >
              {tracados.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Nome (TRACK_NAME)"
              value={config.trackName}
              onChange={(v) => setConfig((c) => ({ ...c, trackName: v }))}
            />
            <Campo
              label="Categoria (CATEGORY)"
              value={config.category}
              onChange={(v) => setConfig((c) => ({ ...c, category: v }))}
            />
            <Campo
              label="Bateria (BATTERY)"
              value={config.battery}
              onChange={(v) => setConfig((c) => ({ ...c, battery: v }))}
            />
            <Campo
              label="Texto de largada (START_TEXT)"
              value={config.startText}
              onChange={(v) => setConfig((c) => ({ ...c, startText: v }))}
            />
            <Campo
              label="Extensão (TRACK_LENGTH)"
              value={config.trackLength}
              onChange={(v) => setConfig((c) => ({ ...c, trackLength: v }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <CampoCor
              label="Cor primária"
              value={config.primaryColor}
              onChange={(v) => setConfig((c) => ({ ...c, primaryColor: v }))}
            />
            <CampoCor
              label="Cor secundária"
              value={config.secondaryColor}
              onChange={(v) => setConfig((c) => ({ ...c, secondaryColor: v }))}
            />
            <CampoCor
              label="Fundo"
              value={config.background}
              onChange={(v) => setConfig((c) => ({ ...c, background: v }))}
            />
          </div>

          <label className="text-ink-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={usarBloom}
              onChange={(e) => setUsarBloom(e.target.checked)}
            />
            Efeito de brilho (bloom) — desligue se a exportação estiver muito
            lenta
          </label>

          {tracadoSelecionado ? (
            <p className="text-ink-3 text-xs">
              {tracadoSelecionado.pontos.length} pontos ·{" "}
              {tracadoSelecionado.sentido === "horario"
                ? "sentido horário"
                : tracadoSelecionado.sentido === "anti_horario"
                  ? "sentido anti-horário"
                  : "sentido não definido"}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-ink-2 text-xs font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border-strong rounded-md border px-2.5 py-1.5 text-sm"
      />
    </div>
  );
}

function CampoCor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-ink-2 text-xs font-medium">{label}</label>
      <div className="border-border-strong flex items-center gap-2 rounded-md border px-2 py-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 shrink-0 cursor-pointer border-0 bg-transparent p-0"
        />
        <span className="text-ink-2 font-mono text-xs">{value}</span>
      </div>
    </div>
  );
}
