"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Dialog } from "@/components/ui/dialog";
import { PosicaoBadge } from "@/components/ui/posicao-badge";
import { TracadoMiniatura } from "@/components/tracado/tracado-miniatura";
import { VisualizadorTracado } from "@/components/tracado/visualizador-tracado";
import {
  baterias,
  formatData,
  formatGap,
  formatTempoVolta,
  getCategoriaById,
  getKartById,
  getMelhoresVoltasDoTracado,
  getPilotoById,
  getRecordeDoTracado,
  getUltimasVitoriasDoTracado,
  nomeExibicaoPiloto,
  substituirDadosDeCorrida,
} from "@/lib/mock/data";
import { useMockStore } from "@/lib/use-mock-store";
import type { Bateria, Etapa, Piloto, Resultado, Tracado } from "@/lib/types";

// Client component pelo mesmo motivo do calendário: traçados cadastrados no
// admin ficam no localStorage (useMockStore), então a página precisa lê-lo
// pra mostrar o que acabou de ser criado nesse mesmo navegador.
export function TracadosLista({
  tracadosIniciais,
  etapasIniciais,
  dadosCorrida,
}: {
  tracadosIniciais: Tracado[];
  etapasIniciais: Etapa[];
  dadosCorrida: {
    pilotos: Piloto[];
    baterias: Bateria[];
    resultados: Resultado[];
  };
}) {
  // Os helpers de recorde/voltas lêem os arrays de lib/mock/data.ts. No
  // navegador esses arrays começam vazios (a simulação vive no servidor),
  // então copia o snapshot que o servidor mandou antes de calcular qualquer
  // coisa — no servidor os arrays já estão certos.
  if (typeof window !== "undefined") {
    substituirDadosDeCorrida({ ...dadosCorrida, simulacaoAtiva: false });
  }

  const tracados = tracadosIniciais;
  const [etapas] = useMockStore("gridlap:etapas", etapasIniciais);
  const [tracadoSelecionado, setTracadoSelecionado] = useState<Tracado | null>(
    null,
  );
  // Retângulo do traçado do card clicado, capturado no instante do clique —
  // usado só pra animar a transição (a linha "salta" do card pro tamanho
  // grande do dialog), não guarda estado de UI de verdade, então é ref e não
  // state (não precisa re-renderizar por causa dele).
  const origemRectRef = useRef<DOMRect | null>(null);
  const previewGrandeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const origem = origemRectRef.current;
    const elemento = previewGrandeRef.current;
    if (!tracadoSelecionado || !origem || !elemento) return;

    const destino = elemento.getBoundingClientRect();
    if (destino.width === 0 || destino.height === 0) return;

    const escalaX = origem.width / destino.width;
    const escalaY = origem.height / destino.height;
    const deslocaX =
      origem.left + origem.width / 2 - (destino.left + destino.width / 2);
    const deslocaY =
      origem.top + origem.height / 2 - (destino.top + destino.height / 2);

    elemento.style.transition = "none";
    elemento.style.transformOrigin = "center center";
    elemento.style.transform = `translate(${deslocaX}px, ${deslocaY}px) scale(${escalaX}, ${escalaY})`;
    // Força o navegador a aplicar o estado inicial antes de animar pro
    // estado final — sem isso as duas mudanças de transform colapsam numa
    // só e não há transição nenhuma.
    elemento.getBoundingClientRect();
    requestAnimationFrame(() => {
      elemento.style.transition = "transform 0.55s cubic-bezier(0.22,1,0.36,1)";
      elemento.style.transform = "translate(0, 0) scale(1, 1)";
    });
  }, [tracadoSelecionado]);

  if (tracados.length === 0) {
    return (
      <p className="text-ink-2 text-sm">Nenhum traçado cadastrado ainda.</p>
    );
  }

  const etapasDoSelecionado = tracadoSelecionado
    ? etapas.filter((e) => e.tracadoId === tracadoSelecionado.id)
    : [];
  const recordeDoSelecionado = tracadoSelecionado
    ? getRecordeDoTracado(tracadoSelecionado.id)
    : undefined;
  const pilotoDoRecorde = recordeDoSelecionado
    ? getPilotoById(recordeDoSelecionado.pilotoId)
    : undefined;
  const categoriaDoRecorde = recordeDoSelecionado
    ? getCategoriaById(
        baterias.find((b) => b.id === recordeDoSelecionado.bateriaId)
          ?.categoriaId ?? "",
      )
    : undefined;
  const melhoresVoltas = tracadoSelecionado
    ? getMelhoresVoltasDoTracado(tracadoSelecionado.id)
    : [];
  const ultimasVitorias = tracadoSelecionado
    ? getUltimasVitoriasDoTracado(tracadoSelecionado.id)
    : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {tracados.map((tracado) => {
        const etapasDoTracado = etapas.filter(
          (e) => e.tracadoId === tracado.id,
        );
        const recorde = getRecordeDoTracado(tracado.id);
        return (
          <button
            key={tracado.id}
            type="button"
            onClick={(evento) => {
              origemRectRef.current =
                evento.currentTarget
                  .querySelector("svg")
                  ?.getBoundingClientRect() ?? null;
              setTracadoSelecionado(tracado);
            }}
            className="text-left"
          >
            <Card className="hover:border-orange/40 overflow-hidden transition-colors">
              <div className="relative bg-[#12141b]">
                <TracadoMiniatura
                  pontos={tracado.pontos}
                  fechado={tracado.fechado}
                  comGlow
                  className="h-48 w-full"
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
                  <p className="text-xl font-black tracking-tight text-white uppercase italic">
                    {tracado.nome}
                  </p>
                  <div className="self-end text-right">
                    {tracado.extensaoMetros ? (
                      <p className="text-[11px] tracking-widest text-white/70 uppercase">
                        Extensão ≈ {tracado.extensaoMetros}m
                      </p>
                    ) : null}
                    {etapasDoTracado.length > 0 ? (
                      <p className="text-[11px] tracking-widest text-white/70 uppercase">
                        {etapasDoTracado.length} etapa
                        {etapasDoTracado.length > 1 ? "s" : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              {tracado.descricao || recorde ? (
                <CardBody className="flex flex-col gap-3">
                  {tracado.descricao ? (
                    <p className="text-ink-2 text-sm">{tracado.descricao}</p>
                  ) : null}
                  {recorde ? (
                    <div>
                      <StatusPill tone="orange">
                        Recorde {formatTempoVolta(recorde.melhorVoltaMs)}
                      </StatusPill>
                    </div>
                  ) : null}
                </CardBody>
              ) : null}
            </Card>
          </button>
        );
      })}

      <Dialog
        open={tracadoSelecionado !== null}
        onClose={() => setTracadoSelecionado(null)}
        className="max-w-3xl"
      >
        {tracadoSelecionado ? (
          <div className="flex flex-col gap-6">
            {/* key = id: força remontagem a cada troca de traçado (ou reabertura
            do mesmo), senão a animação de revelação não dispara de novo. */}
            <div
              ref={previewGrandeRef}
              className="relative overflow-hidden rounded-md"
            >
              <VisualizadorTracado
                key={tracadoSelecionado.id}
                tracado={tracadoSelecionado}
                className="h-64 sm:h-80"
              />
              <div
                className="pointer-events-none absolute top-4 right-4 max-w-[55%] rounded-lg bg-white/85 px-3 py-2 text-right opacity-0 backdrop-blur-sm"
                style={{
                  animation: "tracado-fade-label 0.5s ease-out 1.5s forwards",
                }}
              >
                <p className="text-ink text-lg leading-none font-black tracking-tight uppercase italic sm:text-3xl">
                  {tracadoSelecionado.nome}
                </p>
                {tracadoSelecionado.extensaoMetros ? (
                  <p className="text-ink-2 mt-1 text-[11px] font-semibold tracking-widest uppercase sm:text-sm">
                    Extensão ≈ {tracadoSelecionado.extensaoMetros}m
                  </p>
                ) : null}
              </div>
              {recordeDoSelecionado ? (
                <div
                  className="pointer-events-none absolute top-4 left-4 rounded-lg bg-white/85 px-3 py-2 opacity-0 backdrop-blur-sm"
                  style={{
                    animation: "tracado-fade-label 0.5s ease-out 1.5s forwards",
                  }}
                >
                  <p className="text-ink-2 text-[10px] font-semibold tracking-widest uppercase sm:text-[11px]">
                    Recorde do traçado
                  </p>
                  <p className="text-ink font-display text-lg font-black tabular-nums sm:text-2xl">
                    {formatTempoVolta(recordeDoSelecionado.melhorVoltaMs)}
                  </p>
                  {pilotoDoRecorde ? (
                    <p className="text-ink-2 text-xs font-medium sm:text-sm">
                      {nomeExibicaoPiloto(pilotoDoRecorde)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-6 sm:grid-cols-[1.1fr_0.9fr]">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-ink text-xl font-semibold">
                    {tracadoSelecionado.nome}
                  </p>
                  {tracadoSelecionado.descricao ? (
                    <p className="text-ink-2 mt-1 text-sm">
                      {tracadoSelecionado.descricao}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-ink-3 text-xs tracking-wide uppercase">
                      Extensão
                    </p>
                    <p className="text-ink font-medium">
                      {tracadoSelecionado.extensaoMetros
                        ? `≈ ${tracadoSelecionado.extensaoMetros} m`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-3 text-xs tracking-wide uppercase">
                      Tipo
                    </p>
                    <p className="text-ink font-medium">
                      {tracadoSelecionado.fechado ? "Circuito" : "Rota aberta"}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-3 text-xs tracking-wide uppercase">
                      Etapas
                    </p>
                    <p className="text-ink font-medium">
                      {etapasDoSelecionado.length}
                    </p>
                  </div>
                </div>

                {etapasDoSelecionado.length > 0 ? (
                  <div>
                    <p className="text-ink-3 mb-1.5 text-xs tracking-wide uppercase">
                      Etapas neste traçado
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {etapasDoSelecionado.map((etapa) => (
                        <div
                          key={etapa.id}
                          className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="text-ink font-medium">
                            {etapa.nome}
                          </span>
                          <span className="text-ink-2 font-display text-sm font-semibold">
                            {formatData(etapa.data)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-4">
                <div className="border-border bg-bg rounded-lg border p-4">
                  <p className="text-ink-3 text-xs tracking-wide uppercase">
                    Recorde do traçado
                  </p>
                  <p className="text-ink font-display text-4xl font-black tabular-nums">
                    {recordeDoSelecionado
                      ? formatTempoVolta(recordeDoSelecionado.melhorVoltaMs)
                      : "—"}
                  </p>
                  {pilotoDoRecorde ? (
                    <p className="text-ink-2 mt-1 text-sm">
                      {nomeExibicaoPiloto(pilotoDoRecorde)}
                      {categoriaDoRecorde
                        ? ` · ${categoriaDoRecorde.nome}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                {melhoresVoltas.length > 0 ? (
                  <div>
                    <p className="text-ink-3 mb-1.5 text-xs tracking-wide uppercase">
                      Voltas mais rápidas
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {melhoresVoltas.map((resultado, indice) => {
                        const pilotoDaVolta = getPilotoById(resultado.pilotoId);
                        const kartDaVolta = getKartById(resultado.kartId);
                        const gap =
                          indice === 0
                            ? 0
                            : resultado.melhorVoltaMs -
                              melhoresVoltas[0].melhorVoltaMs;
                        return (
                          <div
                            key={resultado.id}
                            className="border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                          >
                            <PosicaoBadge posicao={indice + 1} />
                            <span className="text-ink min-w-0 flex-1 truncate font-medium">
                              {pilotoDaVolta
                                ? nomeExibicaoPiloto(pilotoDaVolta)
                                : "—"}
                            </span>
                            {kartDaVolta ? (
                              <span className="text-ink-2 font-display shrink-0 text-sm font-semibold">
                                Kart {kartDaVolta.placa}
                              </span>
                            ) : null}
                            <span className="text-ink font-display shrink-0 text-sm font-semibold">
                              {formatTempoVolta(resultado.melhorVoltaMs)}
                            </span>
                            {indice > 0 ? (
                              <span className="text-ink-3 font-display shrink-0 text-xs">
                                {formatGap(gap)}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {ultimasVitorias.length > 0 ? (
                  <div>
                    <p className="text-ink-3 mb-1.5 text-xs tracking-wide uppercase">
                      Últimas vitórias
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {ultimasVitorias.map(({ etapa, resultado }) => {
                        const vencedor = getPilotoById(resultado.pilotoId);
                        return (
                          <div
                            key={etapa.id}
                            className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="text-ink truncate font-medium">
                                {vencedor ? nomeExibicaoPiloto(vencedor) : "—"}
                              </p>
                              <p className="text-ink-3 truncate text-xs">
                                {etapa.nome}
                              </p>
                            </div>
                            <span className="text-ink-2 font-display shrink-0 text-sm font-semibold">
                              {formatData(etapa.data)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
