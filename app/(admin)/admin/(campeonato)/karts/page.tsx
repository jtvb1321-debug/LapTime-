import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { listarKarts } from "@/lib/cronometragem/cadastros-store";

export const metadata: Metadata = { title: "Karts" };
export const dynamic = "force-dynamic";

const ROTULO = {
  ativo: "Ativo",
  manutencao: "Manutenção",
  inativo: "Inativo",
} as const;
const TOM = {
  ativo: "success",
  manutencao: "warning",
  inativo: "neutral",
} as const;

// A frota é a mesma da cronometragem (karts e sensores da pista): aqui só se consulta.
export default async function AdminKartsPage() {
  const karts = await listarKarts().catch(() => []);
  const ativos = karts.filter((k) => k.status === "ativo").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Karts"
        description="Frota de karts da pista, a mesma usada na cronometragem."
      />
      <p className="text-ink-2 text-sm">
        {karts.length} kart(s) cadastrado(s), {ativos} ativo(s). Para cadastrar,
        trocar sensor ou mudar a situação, use{" "}
        <Link
          href="/admin/cronometragem/pista"
          className="text-orange-ink font-medium hover:underline"
        >
          Pista e baterias
        </Link>
        .
      </p>
      {karts.length === 0 ? (
        <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
          Nenhum kart cadastrado ainda.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {karts.map((k) => (
            <li
              key={k.id}
              className="border-border bg-surface flex flex-col gap-1.5 rounded-xl border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-ink text-xl font-bold">
                  {k.numero}
                </span>
                <StatusPill tone={TOM[k.status]}>{ROTULO[k.status]}</StatusPill>
              </div>
              <p className="text-ink-2 truncate text-xs">
                {k.apelido || "Sem apelido"}
              </p>
              <p className="text-ink-3 truncate text-xs">
                {k.transponderFixo
                  ? `Sensor ${k.transponderFixo}`
                  : "Sem sensor vinculado"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
