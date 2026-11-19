import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import {
  CategoriasEditor,
  type CategoriaEditavel,
} from "@/components/admin/categorias-editor";
import { getSession } from "@/lib/auth";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import { categorias } from "@/lib/mock/data";
import { pode } from "@/lib/permissoes";
import { lerPilotos } from "@/lib/pilotos-store";

export const metadata: Metadata = { title: "Categorias" };

export default async function AdminCategoriasPage() {
  await aplicarAjustesDeCategoria();
  const [pilotos, sessao] = await Promise.all([lerPilotos(), getSession()]);
  const fichas: CategoriaEditavel[] = categorias.map((c) => ({
    id: c.id,
    nome: c.nome,
    descricao: c.descricao,
    pesoMinimoKg: c.pesoMinimoKg,
    pilotos: pilotos.filter((p) => p.categoriaId === c.id).length,
  }));
  const podeEditar = Boolean(
    sessao && pode(sessao.papel, "cadastro.gerenciar"),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categorias"
        description={
          podeEditar
            ? "Veja cada categoria e ajuste nome, descrição e peso mínimo."
            : "Categorias do campeonato."
        }
      />
      <CategoriasEditor categorias={fichas} podeEditar={podeEditar} />
    </div>
  );
}
