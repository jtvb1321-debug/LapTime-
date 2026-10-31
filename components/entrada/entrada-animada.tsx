"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmarEntrada } from "@/lib/entrada-cliente";

type Fase = "carregando" | "erro" | "saindo" | "fim";

// Pequeno circuito ao redor da logo (pathLength normalizado em CSS).
const CIRCUITO =
  "M120 150 C120 80 180 50 260 50 L420 50 C480 50 520 70 540 110 C555 140 530 170 490 175 L430 178 C400 180 395 215 420 235 C445 255 430 260 380 260 L200 260 C140 260 120 220 120 150 Z";

export function EntradaAnimada() {
  const [fase, setFase] = useState<Fase>("carregando");
  const [demora, setDemora] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const router = useRouter();
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let ativo = true;
    const reduzido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const aviso = setTimeout(() => setDemora(true), 2200);
    void confirmarEntrada({ minimoMs: reduzido ? 700 : 1500 }).then((r) => {
      if (!ativo) return;
      clearTimeout(aviso);
      if (r === "negado") router.replace("/login");
      else setFase(r === "erro" ? "erro" : "saindo");
    });
    return () => {
      ativo = false;
      clearTimeout(aviso);
    };
  }, [tentativa, router]);

  useEffect(() => {
    if (fase !== "saindo") return;
    const t = setTimeout(() => setFase("fim"), 400);
    return () => clearTimeout(t);
  }, [fase]);

  useEffect(() => {
    if (fase === "erro") botao.current?.focus();
  }, [fase]);

  if (fase === "fim") return null;

  return (
    <div
      className={`gl-entrada${fase === "saindo" ? "gl-entrada--saindo" : ""}`}
      role="status"
      aria-live="polite"
    >
      <noscript>
        <style>{".gl-entrada{display:none}"}</style>
      </noscript>
      <div className="gl-entrada__palco">
        <svg
          viewBox="0 0 660 310"
          className="gl-entrada__circuito"
          aria-hidden="true"
          focusable="false"
        >
          <g transform="translate(-30 0)">
            <path d={CIRCUITO} className="gl-entrada__trilho" />
            <path
              d={CIRCUITO}
              pathLength={1}
              className="gl-entrada__linha"
              key={tentativa}
            />
          </g>
        </svg>
        <Image
          src="/logo-gridlap.webp"
          alt="Grid Lap"
          width={2000}
          height={667}
          priority
          className="gl-entrada__logo"
        />
      </div>

      {fase === "erro" ? (
        <div className="gl-entrada__erro" role="alert">
          <p>Não foi possível preparar o painel. Verifique a conexão.</p>
          <button
            ref={botao}
            type="button"
            onClick={() => {
              setFase("carregando");
              setDemora(false);
              setTentativa((n) => n + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <p className="gl-entrada__texto">
          Preparando seu grid…
          {demora ? (
            <span className="gl-entrada__giro" aria-hidden="true" />
          ) : null}
        </p>
      )}
    </div>
  );
}
