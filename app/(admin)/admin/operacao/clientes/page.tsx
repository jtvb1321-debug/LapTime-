import type { Metadata } from "next";
import Link from "next/link";
import { Campo, FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissao } from "@/lib/auth";
import { criarClienteAction } from "@/lib/operacao-actions";
import { listarClientesComResumo } from "@/lib/operacao/clientes-store";
import {
  diaLocal,
  formatarDiaCurto,
  formatarReais,
} from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await exigirPermissao("cliente.gerenciar"))) return <SemPermissao />;

  const { q = "" } = await searchParams;
  const clientes = await listarClientesComResumo(q);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Quem já reservou ou vai reservar bateria no balcão."
        actions={
          <ButtonLink
            href="/admin/operacao/clientes/relacionamento"
            variant="secondary"
          >
            Aniversariantes e clientes sumidos
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-3">
          <form method="get" className="flex items-end gap-2">
            <Campo
              id="q"
              rotulo="Buscar por nome ou telefone"
              defaultValue={q}
              className="max-w-sm flex-1"
            />
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
          <DataTable
            colunas={[
              {
                header: "Nome",
                cell: (c) => (
                  <Link
                    href={`/admin/operacao/clientes/${c.id}`}
                    className="text-orange-ink font-medium hover:underline"
                  >
                    {c.nome}
                  </Link>
                ),
              },
              { header: "Telefone", cell: (c) => c.telefone },
              { header: "Visitas", cell: (c) => c.visitas, numerica: true },
              {
                header: "Última visita",
                cell: (c) =>
                  c.ultimaVisita
                    ? formatarDiaCurto(diaLocal(c.ultimaVisita))
                    : "—",
              },
              {
                header: "Já pagou",
                cell: (c) => formatarReais(c.gastoCentavos),
                numerica: true,
              },
            ]}
            linhas={clientes}
            chave={(c) => c.id}
            vazio={
              q ? "Ninguém encontrado." : "Nenhum cliente cadastrado ainda."
            }
          />
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-ink text-sm font-semibold">Novo cliente</h2>
          </CardHeader>
          <CardBody>
            <FormAcao action={criarClienteAction} rotulo="Cadastrar cliente">
              <Campo id="nome" rotulo="Nome" required autoComplete="off" />
              <Campo
                id="apelido"
                rotulo="Apelido (opcional)"
                maxLength={40}
                autoComplete="off"
              />
              <Campo
                id="telefone"
                rotulo="Telefone com DDD"
                inputMode="tel"
                required
                autoComplete="off"
              />
              <Campo
                id="nascimento"
                rotulo="Nascimento (opcional)"
                type="date"
              />
              <Campo id="email" rotulo="E-mail (opcional)" type="email" />
              <Campo
                id="documento"
                rotulo="CPF (opcional)"
                inputMode="numeric"
              />
            </FormAcao>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
