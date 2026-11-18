import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Campo, FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissao } from "@/lib/auth";
import { reservarAction } from "@/lib/operacao-actions";
import { lerSlot } from "@/lib/operacao/agenda-store";
import { buscarClientes } from "@/lib/operacao/clientes-store";
import {
  diaLocal,
  formatarDiaLongo,
  formatarHora,
  formatarReais,
} from "@/lib/operacao/tempo";

export const metadata: Metadata = { title: "Nova reserva" };
export const dynamic = "force-dynamic";

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; q?: string }>;
}) {
  if (!(await exigirPermissao("agenda.gerenciar"))) return <SemPermissao />;

  const { slot: slotId, q = "" } = await searchParams;
  const slot = slotId ? await lerSlot(slotId) : null;
  if (!slot) notFound();

  const dia = diaLocal(slot.inicio);
  const vagas = slot.capacidade - slot.ocupadas;
  const encontrados = await buscarClientes(q);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Nova reserva"
        description={`${formatarDiaLongo(dia)}, ${formatarHora(slot.inicio)} · ${formatarReais(slot.precoCentavos)} por piloto · ${vagas} ${vagas === 1 ? "vaga" : "vagas"}`}
        actions={
          <Link
            href={`/admin/operacao/agenda?dia=${dia}`}
            className="text-ink-2 hover:text-orange-ink text-sm"
          >
            ← Voltar à agenda
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="text-ink text-sm font-semibold">
            1. Quem vai correr?
          </h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <form method="get" className="flex items-end gap-2">
            <input type="hidden" name="slot" value={slot.id} />
            <Campo
              id="q"
              rotulo="Buscar cliente por nome ou telefone"
              defaultValue={q}
              className="flex-1"
            />
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
          {q && encontrados.length === 0 ? (
            <p className="text-ink-2 text-sm">
              Ninguém encontrado. Cadastre o cliente no formulário abaixo.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-ink text-sm font-semibold">
            2. Dados da reserva
          </h2>
        </CardHeader>
        <CardBody>
          <FormAcao
            action={reservarAction}
            rotulo="Confirmar reserva"
            limpar={false}
          >
            <input type="hidden" name="slotId" value={slot.id} />
            <input type="hidden" name="dia" value={dia} />

            {encontrados.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-ink mb-1 text-sm font-medium">
                  Cliente encontrado
                </legend>
                {encontrados.map((c) => (
                  <label
                    key={c.id}
                    className="border-border flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <input type="radio" name="clienteId" value={c.id} />
                    <span className="text-ink font-medium">{c.nome}</span>
                    <span className="text-ink-2">{c.telefone}</span>
                  </label>
                ))}
                <label className="text-ink-2 flex cursor-pointer items-center gap-3 px-3 py-1 text-sm">
                  <input
                    type="radio"
                    name="clienteId"
                    value=""
                    defaultChecked
                  />
                  Cadastrar um cliente novo (preencha abaixo)
                </label>
              </fieldset>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                id="nome"
                rotulo="Nome (cliente novo)"
                autoComplete="off"
              />
              <Campo
                id="telefone"
                rotulo="Telefone com DDD (cliente novo)"
                inputMode="tel"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                id="pilotos"
                rotulo="Quantos pilotos"
                type="number"
                min={1}
                max={Math.max(vagas, 1)}
                defaultValue={1}
                required
              />
              <Campo
                id="desconto"
                rotulo="Desconto (R$, opcional)"
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
          </FormAcao>
        </CardBody>
      </Card>
    </div>
  );
}
