"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { MarcadorLargada } from "@/components/tracado-marcador-largada";
import { pontosParaCurvaSuave } from "@/lib/curva-suave";
import {
  PISTA_ALTURA,
  PISTA_BASE_SRC,
  PISTA_LARGURA,
  PISTA_VIEWBOX,
} from "@/lib/pista";
import type { CurvaNomeada, PontoTracado, SentidoProva } from "@/lib/types";

const OPCOES_SENTIDO: { value: SentidoProva; label: string }[] = [
  { value: "horario", label: "Horário (seta pro norte da imagem)" },
  { value: "anti_horario", label: "Anti-horário (seta pro sul da imagem)" },
];

// Editor de traçado: o admin clica uma sequência de pontos em cima do
// desenho da pista pra marcar o percurso, depois troca pro modo "Linha de
// chegada" pra posicionar o quadriculado (um clique só, pode reposicionar
// clicando de novo) e escolhe o sentido da prova.
export function TracadoEditor({
  pontosIniciais = [],
  linhaChegadaInicial,
  sentidoInicial,
  curvasIniciais = [],
  onChangePontos,
  onChangeLinhaChegada,
  onChangeSentido,
  onChangeCurvas,
}: {
  pontosIniciais?: PontoTracado[];
  linhaChegadaInicial?: PontoTracado;
  sentidoInicial?: SentidoProva;
  curvasIniciais?: CurvaNomeada[];
  onChangePontos: (pontos: PontoTracado[]) => void;
  onChangeLinhaChegada: (ponto: PontoTracado | undefined) => void;
  onChangeSentido: (sentido: SentidoProva | undefined) => void;
  onChangeCurvas: (curvas: CurvaNomeada[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [modo, setModo] = useState<"percurso" | "chegada" | "curvas">(
    "percurso",
  );
  const [pontos, setPontos] = useState<PontoTracado[]>(pontosIniciais);
  const [linhaChegada, setLinhaChegada] = useState<PontoTracado | undefined>(
    linhaChegadaInicial,
  );
  const [sentido, setSentido] = useState<SentidoProva | undefined>(
    sentidoInicial,
  );
  const [curvas, setCurvas] = useState<CurvaNomeada[]>(curvasIniciais);

  function atualizarPontos(novos: PontoTracado[]) {
    setPontos(novos);
    onChangePontos(novos);
  }

  function atualizarCurvas(novas: CurvaNomeada[]) {
    setCurvas(novas);
    onChangeCurvas(novas);
  }

  function renomearCurva(indice: number, nome: string) {
    atualizarCurvas(curvas.map((c, i) => (i === indice ? { ...c, nome } : c)));
  }

  function removerCurva(indice: number) {
    atualizarCurvas(curvas.filter((_, i) => i !== indice));
  }

  function converterClique(evento: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const ponto = svg.createSVGPoint();
    ponto.x = evento.clientX;
    ponto.y = evento.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return undefined;
    const local = ponto.matrixTransform(ctm.inverse());
    return { x: Math.round(local.x), y: Math.round(local.y) };
  }

  function aoClicar(evento: React.MouseEvent<SVGSVGElement>) {
    const local = converterClique(evento);
    if (!local) return;
    if (modo === "chegada") {
      setLinhaChegada(local);
      onChangeLinhaChegada(local);
    } else if (modo === "curvas") {
      atualizarCurvas([
        ...curvas,
        { ponto: local, nome: `Curva ${curvas.length + 1}` },
      ]);
    } else {
      atualizarPontos([...pontos, local]);
    }
  }

  function desfazer() {
    atualizarPontos(pontos.slice(0, -1));
  }

  function limpar() {
    atualizarPontos([]);
  }

  function alterarSentido(valor: string) {
    const novo = (valor || undefined) as SentidoProva | undefined;
    setSentido(novo);
    onChangeSentido(novo);
  }

  const caminho = pontosParaCurvaSuave(pontos, false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModo("percurso")}
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-medium",
            modo === "percurso" ? "bg-ink text-white" : "bg-ink/5 text-ink-2",
          )}
        >
          Percurso
        </button>
        <button
          type="button"
          onClick={() => setModo("chegada")}
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-medium",
            modo === "chegada" ? "bg-ink text-white" : "bg-ink/5 text-ink-2",
          )}
        >
          Linha de chegada
        </button>
        <button
          type="button"
          onClick={() => setModo("curvas")}
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-medium",
            modo === "curvas" ? "bg-ink text-white" : "bg-ink/5 text-ink-2",
          )}
        >
          Nomear curvas
        </button>
      </div>

      <div className="border-border-strong overflow-hidden rounded-lg border">
        <svg
          ref={svgRef}
          viewBox={PISTA_VIEWBOX}
          onClick={aoClicar}
          className="bg-bg w-full cursor-crosshair"
        >
          <image
            href={PISTA_BASE_SRC}
            x={0}
            y={0}
            width={PISTA_LARGURA}
            height={PISTA_ALTURA}
            opacity={0.35}
          />
          {/* Linha fina só enquanto marca os pontos — precisa deixar a foto
          por baixo visível pra clicar em cima da borda certa da pista. O
          traçado salvo usa o estilo grosso/com glow de verdade em
          TracadoPreview, não este aqui. */}
          {pontos.length > 1 ? (
            <path
              d={caminho}
              fill="none"
              stroke="#8b5cf6"
              strokeOpacity={0.75}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {pontos.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={i === 0 ? "#171a23" : "#8b5cf6"}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          ))}
          {linhaChegada ? (
            <MarcadorLargada ponto={linhaChegada} sentido={sentido} />
          ) : null}
          {curvas.map((curva, i) => (
            <g key={i}>
              <circle
                cx={curva.ponto.x}
                cy={curva.ponto.y}
                r={9}
                fill="#f97316"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <text
                x={curva.ponto.x}
                y={curva.ponto.y - 14}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="#171a23"
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {curva.nome}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {modo === "percurso" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-ink-3 flex-1 text-xs">
            Clique sobre o desenho da pista pra marcar os pontos do percurso, na
            ordem. {pontos.length} ponto{pontos.length === 1 ? "" : "s"} marcado
            {pontos.length === 1 ? "" : "s"}.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={desfazer}
            disabled={pontos.length === 0}
          >
            Desfazer último ponto
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={limpar}
            disabled={pontos.length === 0}
          >
            Limpar
          </Button>
        </div>
      ) : modo === "chegada" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-ink-3 flex-1 text-xs">
            Clique sobre a pista pra posicionar o quadriculado de largada
            {linhaChegada ? " (clique de novo pra reposicionar)" : ""}.
          </p>
          <select
            value={sentido ?? ""}
            onChange={(e) => alterarSentido(e.target.value)}
            className="border-border-strong focus:border-orange rounded-md border px-2 py-1 text-xs outline-none"
          >
            <option value="">Sentido não definido</option>
            {OPCOES_SENTIDO.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-ink-3 text-xs">
            Clique sobre cada curva da pista pra marcar e dar um nome — esse
            nome aparece na tela enquanto a linha desenha aquele trecho na
            apresentação do traçado.
          </p>
          {curvas.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {curvas.map((curva, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-ink-3 w-5 shrink-0 text-right text-xs">
                    {i + 1}
                  </span>
                  <input
                    value={curva.nome}
                    onChange={(e) => renomearCurva(i, e.target.value)}
                    className="border-border-strong focus:border-orange flex-1 rounded-md border px-2 py-1 text-sm outline-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removerCurva(i)}
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
