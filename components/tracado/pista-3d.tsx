"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  CenaPista,
  type ModoCena,
  type ResumoDaRota,
} from "@/lib/tracado3d/cena-pista";
import type { PontoRota } from "@/lib/tracado3d/rota";

export interface ControlePista3D {
  enquadrar: (vista: "topo" | "perspectiva") => void;
  reiniciar: () => void;
  canvas: () => HTMLCanvasElement | null;
}

interface Props {
  pontos: PontoRota[];
  fechado: boolean;
  selecionado?: number;
  modo?: ModoCena;
  visaoPiloto?: boolean;
  reproduzindo?: boolean;
  velocidadeKmh?: number;
  className?: string;
  controle?: React.Ref<ControlePista3D>;
  // Só chega depois do modelo carregado (antes disso toda rota pareceria
  // estar fora do asfalto).
  onResumo?: (resumo: ResumoDaRota) => void;
  onAdicionar?: (ponto: PontoRota) => void;
  onIniciarArraste?: (indice: number) => void;
  onMover?: (indice: number, ponto: PontoRota) => void;
  onSelecionar?: (indice: number) => void;
  onProgresso?: (distancia: number, total: number) => void;
  onFim?: () => void;
  onAviso?: (mensagem: string) => void;
  onPronto?: (temAsfalto: boolean) => void;
}

// Cena 3D da pista (modelo GLB) para o editor, o site e o vídeo do traçado.
// Quem usa decide o que é editável; o servidor/arquivo guarda só a rota.
export function Pista3D(props: Props) {
  const { className, controle } = props;
  const contenedor = useRef<HTMLDivElement>(null);
  const cena = useRef<CenaPista | null>(null);
  // Última versão das props, lida pelos callbacks da cena (que vive fora do
  // ciclo de renderização do React).
  const atual = useRef(props);
  const pronto = useRef(false);
  const ultimoProgresso = useRef(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    atual.current = props;
  });

  useImperativeHandle(controle, () => ({
    enquadrar: (vista) => cena.current?.enquadrar(vista),
    reiniciar: () => cena.current?.reiniciar(),
    canvas: () => cena.current?.canvas ?? null,
  }));

  useEffect(() => {
    const alvo = contenedor.current;
    if (!alvo) return;
    let instancia: CenaPista;
    try {
      instancia = new CenaPista(alvo, {
        onPronto: (temAsfalto) => {
          const p = atual.current;
          pronto.current = true;
          instancia.definirModo(p.modo ?? "navegar");
          instancia.definirVelocidade(p.velocidadeKmh ?? 30);
          const resumo = instancia.definirRota(
            p.pontos,
            p.fechado,
            p.selecionado ?? -1,
          );
          instancia.definirVisaoPiloto(!!p.visaoPiloto);
          instancia.definirReproduzindo(!!p.reproduzindo);
          if (!temAsfalto) {
            setErro("O modelo não contém superfícies com material asfalto.");
          }
          setCarregando(false);
          p.onResumo?.(resumo);
          p.onPronto?.(temAsfalto);
        },
        onErro: (mensagem) => {
          setErro(mensagem);
          setCarregando(false);
        },
        onAdicionar: (ponto) => atual.current.onAdicionar?.(ponto),
        onIniciarArraste: (i) => atual.current.onIniciarArraste?.(i),
        onMover: (i, ponto) => atual.current.onMover?.(i, ponto),
        onSelecionar: (i) => atual.current.onSelecionar?.(i),
        onProgresso: (distancia, total) => {
          const agora = performance.now();
          // ~10 atualizações por segundo bastam para a barra e o texto.
          if (agora - ultimoProgresso.current < 100 && distancia < total)
            return;
          ultimoProgresso.current = agora;
          atual.current.onProgresso?.(distancia, total);
        },
        onFim: () => atual.current.onFim?.(),
        onAviso: (m) => atual.current.onAviso?.(m),
      });
    } catch (e) {
      console.error(e);
      // Sem WebGL (ou contexto recusado): o resto da tela continua usável.
      queueMicrotask(() => {
        setErro("Este navegador não conseguiu iniciar o 3D (WebGL).");
        setCarregando(false);
      });
      return;
    }
    cena.current = instancia;
    return () => {
      pronto.current = false;
      instancia.dispose();
      cena.current = null;
    };
  }, []);

  const { pontos, fechado, selecionado, onResumo } = props;
  useEffect(() => {
    if (!pronto.current || !cena.current) return;
    const resumo = cena.current.definirRota(pontos, fechado, selecionado ?? -1);
    onResumo?.(resumo);
  }, [pontos, fechado, selecionado, onResumo]);

  const { modo, velocidadeKmh, visaoPiloto, reproduzindo } = props;
  useEffect(() => {
    if (pronto.current) cena.current?.definirModo(modo ?? "navegar");
  }, [modo]);
  useEffect(() => {
    if (pronto.current) cena.current?.definirVelocidade(velocidadeKmh ?? 30);
  }, [velocidadeKmh]);
  useEffect(() => {
    if (pronto.current) cena.current?.definirVisaoPiloto(!!visaoPiloto);
  }, [visaoPiloto]);
  useEffect(() => {
    if (pronto.current) cena.current?.definirReproduzindo(!!reproduzindo);
  }, [reproduzindo]);

  return (
    <div className={clsx("relative overflow-hidden bg-[#bcc8c5]", className)}>
      <div ref={contenedor} className="absolute inset-0" />
      {carregando ? (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-[#bcc8c5] px-4 text-center text-sm font-medium text-[#15181e]"
        >
          Carregando a pista e as texturas… (primeira vez pode levar alguns
          segundos)
        </div>
      ) : null}
      {erro ? (
        <div
          role="alert"
          className="absolute inset-x-3 top-3 rounded-md bg-[#15181e] px-3 py-2 text-sm text-white"
        >
          {erro}
        </div>
      ) : null}
    </div>
  );
}
