"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoCarregando } from "@/components/ui/logo-carregando";
import { confirmarEntrada } from "@/lib/entrada-cliente";

type Fase = "carregando" | "erro" | "saindo" | "fim";

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
      <LogoCarregando key={tentativa} />

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
