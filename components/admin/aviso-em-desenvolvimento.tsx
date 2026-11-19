"use client";

import { usePathname } from "next/navigation";

// Telas do campeonato que já funcionam de verdade (banco de dados) não mostram o aviso.
const TELAS_PRONTAS = [
  "/admin/campeonatos",
  "/admin/tracados",
  "/admin/pilotos",
  "/admin/categorias",
];

export function AvisoEmDesenvolvimento() {
  const caminho = usePathname();
  const pronta = TELAS_PRONTAS.some(
    (p) => caminho === p || caminho.startsWith(`${p}/`),
  );
  if (pronta) return null;
  return (
    <details className="bg-warning-bg text-warning border-warning-fill rounded-lg border-l-4 px-4 py-1 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium md:min-h-8">
        Esta tela ainda está em desenvolvimento: parte dos dados é de
        demonstração.
      </summary>
      <p role="note" className="pb-2">
        Estas telas não mostram nem alteram as baterias, pagamentos e resultados
        do balcão (veja Operação e Cronometragem).
      </p>
    </details>
  );
}
