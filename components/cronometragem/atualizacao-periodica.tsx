"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

// Se uma atualização ficar presa sem resposta por mais que isto, uma nova pode começar.
const LIMITE_DE_UMA_ATUALIZACAO_MS = 20_000;

// Atualiza os dados da página (sem recarregar) enquanto a aba está visível: o "ao vivo" das telas
// administrativas de cronometragem. Substitui o AutoAtualizar nessas telas; o AutoAtualizar original
// continua sem mudança porque também é usado pela TV, que não é alterada nesta etapa.
//
// As atualizações NÃO se sobrepõem: a próxima só começa depois que a anterior terminou. Antes, um
// novo `router.refresh()` era disparado a cada intervalo mesmo com o anterior ainda em andamento; com
// o servidor respondendo mais devagar que o intervalo, cada pedido novo substituía o anterior e
// nenhuma atualização chegava a ser aplicada (a tela ficava parada, por exemplo sem mostrar o sensor
// recém-lido no assistente de karts). Também atualiza assim que a rede volta ou a aba volta a ficar
// visível.
export function AtualizacaoPeriodica({
  intervaloMs = 3000,
}: {
  intervaloMs?: number;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const pendenteRef = useRef(false);
  const iniciadaEm = useRef(0);

  useEffect(() => {
    pendenteRef.current = pendente;
  }, [pendente]);

  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState !== "visible") return;
      if (
        pendenteRef.current &&
        performance.now() - iniciadaEm.current < LIMITE_DE_UMA_ATUALIZACAO_MS
      ) {
        return; // a anterior ainda não terminou
      }
      iniciadaEm.current = performance.now();
      pendenteRef.current = true;
      iniciar(() => router.refresh());
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizar();
    };
    const id = setInterval(atualizar, intervaloMs);
    window.addEventListener("online", atualizar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", atualizar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router, intervaloMs, iniciar]);
  return null;
}
