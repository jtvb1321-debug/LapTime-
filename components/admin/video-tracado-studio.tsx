"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Pista3D, type ControlePista3D } from "@/components/tracado/pista-3d";
import type { ResumoDaRota } from "@/lib/tracado3d/cena-pista";
import { CHAVE_TRACADOS } from "@/lib/tracado3d/rota";
import { useMockStore } from "@/lib/use-mock-store";
import type { Tracado } from "@/lib/types";

const TIPOS_DE_VIDEO = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

// Vídeo do traçado: a câmera do piloto percorre a rota sobre o modelo 3D e a
// tela é gravada (WebM) no próprio navegador. Rota aberta: do começo ao fim;
// circuito fechado: uma volta.
export function VideoTracadoStudio({
  tracadosIniciais,
}: {
  tracadosIniciais: Tracado[];
}) {
  const [tracados] = useMockStore(CHAVE_TRACADOS, tracadosIniciais);
  const [tracadoId, setTracadoId] = useState(tracados[0]?.id ?? "");
  const tracado = tracados.find((t) => t.id === tracadoId) ?? tracados[0];

  const controle = useRef<ControlePista3D>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const temporizador = useRef<number | null>(null);
  const [velocidade, setVelocidade] = useState(40);
  const [resumo, setResumo] = useState<ResumoDaRota | null>(null);
  const [visaoPiloto, setVisaoPiloto] = useState(true);
  const [reproduzindo, setReproduzindo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const aoResumir = useCallback((r: ResumoDaRota) => setResumo(r), []);

  useEffect(
    () => () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
      if (gravador.current?.state === "recording") gravador.current.stop();
    },
    [],
  );
  useEffect(
    () => () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl],
  );

  const podeAndar = !!resumo && resumo.total > 0 && resumo.invalidos === 0;
  const segundos = podeAndar ? resumo.total / (velocidade / 3.6) : 0;

  function parar() {
    if (temporizador.current) window.clearTimeout(temporizador.current);
    temporizador.current = null;
    if (gravador.current?.state === "recording") gravador.current.stop();
    setReproduzindo(false);
  }

  function gravar() {
    setErro("");
    const canvas = controle.current?.canvas();
    const tipo = TIPOS_DE_VIDEO.find((t) => MediaRecorder.isTypeSupported(t));
    if (!canvas || !tipo || !podeAndar) {
      return setErro(
        "Este navegador não consegue gravar o 3D. Use o Chrome ou o Edge.",
      );
    }
    const pedacos: Blob[] = [];
    const rec = new MediaRecorder(canvas.captureStream(30), {
      mimeType: tipo,
      videoBitsPerSecond: 6_000_000,
    });
    rec.ondataavailable = (e) => e.data.size && pedacos.push(e.data);
    rec.onstop = () => {
      setGravando(false);
      setVideoUrl(URL.createObjectURL(new Blob(pedacos, { type: tipo })));
    };
    gravador.current = rec;
    controle.current?.reiniciar();
    setVisaoPiloto(true);
    setVideoUrl(null);
    setGravando(true);
    rec.start();
    setReproduzindo(true);
    temporizador.current = window.setTimeout(parar, (segundos + 0.4) * 1000);
  }

  if (!tracado) {
    return (
      <p className="text-ink-2 text-sm">
        Cadastre um traçado em Admin &gt; Traçados para gerar o vídeo.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <Pista3D
          // Trocar de traçado remonta a cena (câmera e distância do zero).
          key={tracado.id}
          className="h-72 w-full rounded-lg sm:h-[28rem]"
          controle={controle}
          pontos={tracado.pontos}
          fechado={tracado.fechado}
          modo="navegar"
          visaoPiloto={visaoPiloto}
          reproduzindo={reproduzindo}
          velocidadeKmh={velocidade}
          onResumo={aoResumir}
          onFim={parar}
        />
        {resumo && resumo.invalidos > 0 ? (
          <p role="alert" className="text-orange-ink text-sm">
            Este traçado tem {resumo.invalidos} trecho(s) fora do asfalto.
            Corrija em Traçados antes de gerar o vídeo.
          </p>
        ) : null}
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="video-tracado"
              className="text-ink text-sm font-medium"
            >
              Traçado
            </label>
            <select
              id="video-tracado"
              value={tracado.id}
              disabled={gravando}
              onChange={(e) => {
                setTracadoId(e.target.value);
                setResumo(null);
                setReproduzindo(false);
              }}
              className="border-border-strong bg-surface text-ink min-h-11 rounded-md border px-3 text-sm md:min-h-9"
            >
              {tracados.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="video-velocidade"
              className="text-ink text-sm font-medium"
            >
              Velocidade: {velocidade} km/h
            </label>
            <input
              id="video-velocidade"
              type="range"
              min={10}
              max={90}
              value={velocidade}
              disabled={gravando}
              onChange={(e) => setVelocidade(Number(e.target.value))}
            />
          </div>
          <p className="text-ink-2 text-sm">
            {podeAndar
              ? `Duração estimada: ${segundos.toFixed(0)} s (${tracado.fechado ? "uma volta" : "rota inteira"}).`
              : "Aguardando o modelo da pista…"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!podeAndar || gravando}
              aria-busy={gravando}
              onClick={gravar}
            >
              {gravando ? "Gravando…" : "Gravar vídeo"}
            </Button>
            {gravando ? (
              <Button type="button" variant="secondary" onClick={parar}>
                Parar
              </Button>
            ) : null}
          </div>
          {erro ? (
            <p role="alert" className="text-danger text-sm">
              {erro}
            </p>
          ) : null}
          {videoUrl ? (
            <div className="flex flex-col gap-2">
              <video src={videoUrl} controls className="w-full rounded-md" />
              <a
                href={videoUrl}
                download={`tracado-${tracado.id}.webm`}
                className="text-orange-ink inline-flex min-h-11 items-center text-sm font-medium hover:underline md:min-h-0"
              >
                Baixar vídeo (WebM)
              </a>
            </div>
          ) : (
            <p className="text-ink-3 text-xs">
              O vídeo é gravado no seu navegador (WebM) e não é enviado a lugar
              nenhum. Mantenha esta aba aberta durante a gravação.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
