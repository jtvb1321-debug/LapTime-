"use client";

import { useEffect, useState } from "react";

const CHAVE = "gl:efeitos";

// Preferência de efeitos (luz no mapa, abertura, fumaça do login, vídeo do piloto...).
// Por padrão os efeitos ficam LIGADOS, mesmo que o aparelho esteja com "reduzir movimento" (celulares
// em economia de bateria ligam isso sozinhos e o site ficava todo parado). Quem preferir menos
// movimento usa o botão "Reduzir efeitos"; a escolha fica salva neste aparelho.
function lerSalvo(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === "reduzidos";
  } catch {
    return false;
  }
}

export function efeitosReduzidos() {
  return document.documentElement.dataset.efeitos === "reduzidos" || lerSalvo();
}

function aplicar(reduzidos: boolean) {
  if (reduzidos) document.documentElement.dataset.efeitos = "reduzidos";
  else delete document.documentElement.dataset.efeitos;
}

// Sem aparência: só aplica a escolha salva em qualquer página do site.
export function AplicadorDeEfeitos() {
  useEffect(() => {
    aplicar(lerSalvo());
  }, []);
  return null;
}

export function AlternarEfeitos({ className = "" }: { className?: string }) {
  const [reduzidos, setReduzidos] = useState(false);

  useEffect(() => {
    // Lê a escolha salva depois da hidratação (o servidor não sabe qual é).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura do localStorage no cliente
    setReduzidos(lerSalvo());
  }, []);

  function alternar() {
    const novo = !reduzidos;
    setReduzidos(novo);
    aplicar(novo);
    try {
      if (novo) window.localStorage.setItem(CHAVE, "reduzidos");
      else window.localStorage.removeItem(CHAVE);
    } catch {
      // Sem armazenamento: vale só até recarregar a página.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={reduzidos}
      className={`min-h-11 rounded-md px-3 text-xs text-[#9fb2d4] underline-offset-2 hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-[#4cc9ff] focus-visible:outline-none ${className}`}
    >
      {reduzidos ? "Efeitos reduzidos · ligar" : "Efeitos ligados · reduzir"}
    </button>
  );
}
