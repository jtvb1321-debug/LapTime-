"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Atualiza os dados da página (sem recarregar) enquanto a aba está visível —
// é o "ao vivo" da tela de cronometragem.
export function AutoAtualizar({
  intervaloMs = 3000,
}: {
  intervaloMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervaloMs);
    return () => clearInterval(id);
  }, [router, intervaloMs]);
  return null;
}
