"use client";

import { useEffect, useRef, useState } from "react";

function formatar(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Mostra o tempo restante (ou decorrido) SEM ser a fonte da verdade: o
// servidor manda o instante de referência (prazo ou início) e o relógio dele;
// o navegador só anima entre uma atualização e outra, corrigindo a diferença
// entre o relógio do computador e o do servidor a cada atualização da tela.
export function Contador({
  modo,
  referenciaMs,
  agoraServidorMs,
}: {
  modo: "regressivo" | "progressivo";
  referenciaMs: number;
  agoraServidorMs: number;
}) {
  const deslocamento = useRef(0);
  const [agora, setAgora] = useState(agoraServidorMs);

  useEffect(() => {
    deslocamento.current = agoraServidorMs - Date.now();
  }, [agoraServidorMs]);

  useEffect(() => {
    const id = setInterval(
      () => setAgora(Date.now() + deslocamento.current),
      250,
    );
    return () => clearInterval(id);
  }, []);

  const ms =
    modo === "regressivo" ? referenciaMs - agora : agora - referenciaMs;
  return <span suppressHydrationWarning>{formatar(ms)}</span>;
}
