// Aviso das telas do campeonato que ainda usam dados de demonstração. Cada tela ainda não pronta o
// inclui; ao ficar pronta, é só tirá-lo de lá.
export function AvisoEmDesenvolvimento() {
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
