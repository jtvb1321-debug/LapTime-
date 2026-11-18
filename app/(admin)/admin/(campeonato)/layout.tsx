import { SemPermissao } from "@/components/operacao/sem-permissao";
import { getSession } from "@/lib/auth";

// Telas do campeonato. A recepção só opera o balcão: o menu já as esconde e
// aqui a URL digitada à mão também é barrada (a rota segue a mesma).
export default async function CampeonatoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await getSession();
  if (sessao?.papel === "recepcao") return <SemPermissao />;
  return (
    <div className="flex flex-col gap-4">
      {/* Aviso compacto, sempre visível; o detalhe abre com um clique. */}
      <details className="bg-warning-bg text-warning border-warning-fill rounded-lg border-l-4 px-4 py-1 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium md:min-h-8">
          Campeonato em desenvolvimento: parte dos dados é de demonstração.
        </summary>
        <p role="note" className="pb-2">
          Estas telas não mostram nem alteram as baterias, pagamentos e
          resultados do balcão (veja Operação e Cronometragem).
        </p>
      </details>
      {children}
    </div>
  );
}
