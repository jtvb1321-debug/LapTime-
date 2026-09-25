import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { campeonato } from "@/lib/mock/data";

export const metadata: Metadata = { title: "Configurações" };

export default function AdminConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Dados gerais do campeonato."
      />

      <Card>
        <CardBody className="flex max-w-lg flex-col gap-4">
          {!campeonato ? (
            <p className="text-ink-2 text-sm">
              Nenhum campeonato ativo. Cadastre um em{" "}
              <span className="text-ink font-medium">Campeonatos</span> para
              editar os dados gerais aqui.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-ink text-sm font-medium">
                  Nome do campeonato
                </label>
                <input
                  defaultValue={campeonato.nome}
                  disabled
                  className="border-border-strong bg-bg text-ink-2 rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-ink text-sm font-medium">
                  Temporada
                </label>
                <input
                  defaultValue={campeonato.temporada}
                  disabled
                  className="border-border-strong bg-bg text-ink-2 rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-ink text-sm font-medium">
                  Descrição
                </label>
                <textarea
                  defaultValue={campeonato.descricao}
                  disabled
                  rows={3}
                  className="border-border-strong bg-bg text-ink-2 rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <Button disabled className="self-start">
                Salvar
              </Button>
              <p className="text-ink-3 text-xs">
                Edição habilitada quando o campeonato estiver conectado ao
                Supabase.
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
