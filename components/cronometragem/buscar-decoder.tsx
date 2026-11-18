"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

// "Buscar de novo": o agente do computador da pista procura o decoder sozinho a cada poucos
// segundos; este botão só traz o estado mais recente na hora, sem esperar a próxima atualização.
export function BuscarDecoder({ rotulo }: { rotulo: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      carregando={pendente}
      onClick={() => iniciar(() => router.refresh())}
    >
      {pendente ? "Buscando…" : rotulo}
    </Button>
  );
}
