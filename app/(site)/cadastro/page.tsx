import type { Metadata } from "next";
import { CadastroForm } from "@/components/site/cadastro-form";
import { categorias } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Cadastro de piloto" };

export default function CadastroPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-ink text-2xl font-semibold">Cadastro de piloto</h1>
        <p className="text-ink-2 mt-1 text-sm">
          Crie sua conta para aparecer nas listas de pilotos e na transmissão.
        </p>
      </div>
      <CadastroForm categoriasIniciais={categorias} />
    </div>
  );
}
