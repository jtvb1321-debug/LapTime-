"use client";

import { Button } from "@/components/ui/button";

export function BotaoImprimir({ rotulo = "Imprimir" }: { rotulo?: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      {rotulo}
    </Button>
  );
}
