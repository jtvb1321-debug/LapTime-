"use client";

import { useEffect, useRef, useState } from "react";
import { BandeiraUf } from "@/components/ui/bandeira-uf";
import { ESTADOS_BRASIL } from "@/lib/estados-brasil";

// Escolha do estado com a bandeira de cada um (grade de botões, como um mostruário). Envia a sigla
// no campo `name` (igual ao <select> de antes) e abre/fecha por teclado: Esc fecha e devolve o foco.
export function SeletorEstado({
  id,
  name,
  defaultValue = "",
}: {
  id: string;
  name: string;
  defaultValue?: string;
}) {
  const [uf, setUf] = useState(defaultValue);
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const escolhido = ESTADOS_BRASIL.find((e) => e.sigla === uf);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    };
    document.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <input type="hidden" name={name} value={uf} />
      <button
        ref={botao}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="campo flex items-center gap-2.5 text-left"
      >
        {escolhido ? (
          <>
            <BandeiraUf uf={escolhido.sigla} className="size-6" />
            <span className="min-w-0 flex-1 truncate">
              {escolhido.sigla} — {escolhido.nome}
            </span>
          </>
        ) : (
          <span className="text-ink-3 flex-1">Selecione</span>
        )}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`size-3 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>
      {aberto ? (
        <div
          role="listbox"
          aria-label="Estados"
          className="border-border-strong absolute inset-x-0 top-full z-30 mt-1 max-h-[22rem] overflow-y-auto rounded-xl border bg-[#0c1630] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)] sm:right-0 sm:left-auto sm:w-[28rem] sm:max-w-[92vw]"
        >
          <div className="grid grid-cols-4 gap-x-1 gap-y-2.5 sm:grid-cols-5">
            {ESTADOS_BRASIL.map((e) => (
              <button
                key={e.sigla}
                type="button"
                role="option"
                aria-selected={uf === e.sigla}
                title={e.nome}
                onClick={() => {
                  setUf(e.sigla);
                  setAberto(false);
                  botao.current?.focus();
                }}
                className={`flex min-h-11 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-white/10 focus-visible:outline-2 ${
                  uf === e.sigla ? "bg-white/10 ring-1 ring-[#4cc9ff]/60" : ""
                }`}
              >
                <BandeiraUf uf={e.sigla} className="size-9" />
                <span className="text-ink-2 text-[0.65rem] leading-tight">
                  {e.sigla}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
