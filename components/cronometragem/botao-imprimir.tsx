"use client";

import { Button } from "@/components/ui/button";

// Abre a impressão do navegador (ou "salvar como PDF"). O menu e os botões da
// tela somem no papel; só o resultado é impresso.
export function BotaoImprimir({ rotulo = "Imprimir resultados" }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      {rotulo}
    </Button>
  );
}
