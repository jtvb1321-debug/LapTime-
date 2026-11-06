"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill, type Tone } from "@/components/ui/status-pill";
import { controlarDemoAction } from "@/lib/demo-corrida-actions";
import type { PainelDemo } from "@/lib/demo-corrida";

const LINKS = [
  {
    titulo: "Grid de largada",
    quando: "Antes da largada",
    caminho: "/overlay/grid",
  },
  {
    titulo: "Classificação ao vivo",
    quando: "Durante a corrida",
    caminho: "/overlay/live-timing",
  },
  {
    titulo: "Resultado final",
    quando: "Depois da bandeirada",
    caminho: "/overlay/resultado",
  },
  {
    titulo: "Painel de TV",
    quando: "Tela cheia da bateria",
    caminho: "/tv",
  },
  {
    titulo: "Classificação do campeonato",
    quando: "Pontos do campeonato",
    caminho: "/campeonato/classificacao",
  },
] as const;

const FASES: Record<PainelDemo["fase"], { texto: string; tom: Tone }> = {
  padrao: { texto: "Cenário padrão (final na volta 9/15)", tom: "neutral" },
  grid: { texto: "No grid, aguardando a largada", tom: "info" },
  correndo: { texto: "Corrida ao vivo", tom: "orange" },
  pausada: { texto: "Corrida pausada", tom: "warning" },
  encerrada: { texto: "Corrida encerrada", tom: "success" },
};

function formatMs(ms: number) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
}

function formatGap(ms: number) {
  return ms === 0 ? "—" : `+${(ms / 1000).toFixed(3)}`;
}

const semAssinatura = () => () => {};

export function DemonstracaoPainel({ inicial }: { inicial: PainelDemo }) {
  const [estado, setEstado] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const origem = useSyncExternalStore(
    semAssinatura,
    () => window.location.origin,
    () => "",
  );

  const atualizar = useCallback(async () => {
    try {
      const resposta = await fetch("/api/demo/estado", { cache: "no-store" });
      if (resposta.ok) setEstado(await resposta.json());
    } catch {
      // Sem rede por um instante: tenta de novo no próximo ciclo.
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void atualizar();
    }, 1500);
    return () => clearInterval(id);
  }, [atualizar]);

  async function comando(acao: string) {
    setOcupado(true);
    try {
      await controlarDemoAction(acao);
      await atualizar();
    } finally {
      setOcupado(false);
    }
  }

  async function copiar(caminho: string) {
    const url = `${origem}${caminho}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(caminho);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      window.prompt("Copie o endereço:", url);
    }
  }

  const fase = FASES[estado.fase];
  const noGrid = estado.fase === "grid";
  const correndo = estado.fase === "correndo";
  const pausada = estado.fase === "pausada";
  const encerrada = estado.fase === "encerrada";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex max-w-2xl flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-ink text-sm font-semibold">
                Simulação do campeonato
              </h2>
              <StatusPill tone={estado.simulacaoAtiva ? "orange" : "neutral"}>
                {estado.simulacaoAtiva ? "Ligada" : "Desligada"}
              </StatusPill>
            </div>
            <p className="text-ink-2 text-sm">
              {estado.simulacaoAtiva
                ? "Pilotos, baterias e resultados fictícios estão carregados em todo o sistema. Desligue para voltar só aos dados reais."
                : "O sistema está só com dados reais e as telas de transmissão ficam vazias. Ligue para carregar os pilotos e a corrida fictícios."}
            </p>
          </div>
          <Button
            variant={estado.simulacaoAtiva ? "secondary" : "primary"}
            disabled={ocupado}
            onClick={() =>
              comando(estado.simulacaoAtiva ? "desligar" : "ligar")
            }
          >
            {estado.simulacaoAtiva ? "Desligar simulação" : "Ligar simulação"}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ink text-sm font-semibold">
            Corrida de demonstração
          </h2>
          <StatusPill tone={fase.tom}>{fase.texto}</StatusPill>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-ink-2 text-sm">
            Final da Copa VeloKart com 10 pilotos fictícios e 15 voltas (cerca
            de 3 minutos no ritmo normal). Monte o grid, dê a largada e
            acompanhe as telas de transmissão mudando sozinhas.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={noGrid ? "secondary" : "primary"}
              disabled={ocupado}
              onClick={() => comando("grid")}
            >
              1. Montar grid
            </Button>
            <Button
              variant={noGrid || encerrada ? "primary" : "secondary"}
              disabled={ocupado || correndo || pausada}
              onClick={() => comando("iniciar")}
            >
              2. Dar a largada
            </Button>
            {correndo ? (
              <Button
                variant="secondary"
                disabled={ocupado}
                onClick={() => comando("pausar")}
              >
                Pausar
              </Button>
            ) : null}
            {pausada ? (
              <Button disabled={ocupado} onClick={() => comando("retomar")}>
                Retomar
              </Button>
            ) : null}
            <Button
              variant="secondary"
              disabled={ocupado || !(correndo || pausada)}
              onClick={() => comando("encerrar")}
            >
              3. Encerrar e mostrar resultado
            </Button>
            <Button
              variant="ghost"
              disabled={ocupado}
              onClick={() => comando("padrao")}
            >
              Voltar ao cenário padrão
            </Button>
          </div>

          <div
            role="group"
            aria-label="Velocidade da corrida"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-ink-2 text-sm">Velocidade:</span>
            {([1, 2, 4] as const).map((v) => (
              <Button
                key={v}
                variant={estado.velocidade === v ? "dark" : "secondary"}
                aria-pressed={estado.velocidade === v}
                disabled={ocupado}
                onClick={() => comando(`velocidade-${v}`)}
              >
                {v}x
              </Button>
            ))}
          </div>

          {estado.lideres.length > 0 ? (
            <div>
              <p className="text-ink-2 mb-2 text-xs">
                {estado.fase === "padrao" || estado.fase === "grid"
                  ? "Primeiros colocados"
                  : `Volta ${estado.voltaDoLider}/${estado.voltas} do líder`}
              </p>
              <ol className="divide-border border-border divide-y rounded-md border text-sm">
                {estado.lideres.map((l) => (
                  <li
                    key={l.posicao}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span className="text-ink-3 w-5 tabular-nums">
                      {l.posicao}
                    </span>
                    <span className="text-ink grow font-medium">{l.nome}</span>
                    <span className="text-ink-2 tabular-nums">
                      {formatMs(l.voltaMs)}
                    </span>
                    <span className="text-orange-ink w-20 text-right tabular-nums">
                      {formatGap(l.gapMs)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-ink text-sm font-semibold">
            Links das transmissões
          </h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-ink-2 text-sm">
            Abra cada tela numa aba ou use o endereço como Browser Source no
            OBS. Elas se atualizam sozinhas durante a corrida.
          </p>
          <ul className="divide-border border-border divide-y rounded-md border">
            {LINKS.map((l) => (
              <li
                key={l.caminho}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3"
              >
                <div className="min-w-48 grow">
                  <p className="text-ink text-sm font-medium">{l.titulo}</p>
                  <p className="text-ink-3 text-xs">{l.quando}</p>
                  <p className="text-ink-2 mt-1 text-xs break-all">
                    {origem}
                    {l.caminho}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => copiar(l.caminho)}>
                    {copiado === l.caminho ? "Copiado" : "Copiar link"}
                  </Button>
                  <a
                    href={l.caminho}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-ink inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white md:min-h-9"
                  >
                    Abrir
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
