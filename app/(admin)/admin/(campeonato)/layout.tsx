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
      <p
        role="note"
        className="bg-warning-bg text-warning rounded-md px-3 py-2 text-sm"
      >
        Campeonato: telas em desenvolvimento; parte dos dados é de demonstração.
        Elas não mostram nem alteram as baterias, pagamentos e resultados do
        balcão (veja Operação e Cronometragem).
      </p>
      {children}
    </div>
  );
}
