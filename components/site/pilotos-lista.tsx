"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { corSolidaCategoria } from "@/lib/categoria-cor";
import { corParaFundoClaro } from "@/lib/cor-contraste";
import { formatCidadeUf, nomeExibicaoPiloto } from "@/lib/mock/data";
import { useMockStore } from "@/lib/use-mock-store";
import type { Categoria, Piloto } from "@/lib/types";

// Client component: precisa de estado pro card que abre ao clicar no nome
// (não existe modal reutilizável antes deste — ver components/ui/dialog.tsx)
// e lê categorias via useMockStore porque categorias criadas no admin ficam
// no localStorage (mesmo motivo de tracados/etapas). Os pilotos, por outro
// lado, já chegam prontos via prop — persistem num arquivo no servidor (ver
// lib/pilotos-store.ts), então não precisam desse mesmo truque.
export function PilotosLista({
  categoriasIniciais,
  pilotos,
}: {
  categoriasIniciais: Categoria[];
  pilotos: Piloto[];
}) {
  const [categorias] = useMockStore("gridlap:categorias", categoriasIniciais);
  const [pilotoSelecionado, setPilotoSelecionado] = useState<Piloto | null>(
    null,
  );

  if (pilotos.length === 0) {
    return (
      <p className="text-ink-2 text-sm">Nenhum piloto cadastrado ainda.</p>
    );
  }

  const categoriaDoSelecionado = pilotoSelecionado
    ? categorias.find((c) => c.id === pilotoSelecionado.categoriaId)
    : undefined;

  return (
    <div className="flex flex-col gap-8">
      {categorias.map((categoria) => {
        const pilotosDaCategoria = pilotos.filter(
          (p) => p.categoriaId === categoria.id,
        );
        if (pilotosDaCategoria.length === 0) return null;

        return (
          <section key={categoria.id} className="flex flex-col gap-3">
            <h2 className="text-ink flex items-center gap-2 text-base font-semibold">
              <span
                className={clsx(
                  "h-2.5 w-2.5 rounded-full",
                  corSolidaCategoria(categoria.id),
                )}
              />
              {categoria.nome}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pilotosDaCategoria.map((piloto) => (
                <Card key={piloto.id} className="h-full overflow-hidden">
                  <div
                    className={clsx(
                      "h-1 w-full",
                      corSolidaCategoria(categoria.id),
                    )}
                  />
                  <CardBody className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar nome={piloto.nome} avatarUrl={piloto.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setPilotoSelecionado(piloto)}
                          className="text-ink hover:text-orange-ink block truncate text-left font-medium"
                        >
                          {nomeExibicaoPiloto(piloto)}
                        </button>
                        <p
                          className="font-mono text-xs"
                          style={{
                            color: corParaFundoClaro(
                              piloto.corNumero,
                              "#9399a6",
                            ),
                          }}
                        >
                          #{piloto.numero}
                        </p>
                      </div>
                      <span className="text-orange-ink shrink-0 font-mono text-sm font-semibold">
                        {piloto.pontos} pts
                      </span>
                    </div>
                    {formatCidadeUf(piloto) ? (
                      <p className="text-ink-2 text-sm">
                        {formatCidadeUf(piloto)}
                      </p>
                    ) : null}
                    <Link
                      href={`/pilotos/${piloto.slug}`}
                      className="text-orange-ink text-xs font-medium hover:underline"
                    >
                      Ver perfil completo →
                    </Link>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      <Dialog
        open={pilotoSelecionado !== null}
        onClose={() => setPilotoSelecionado(null)}
      >
        {pilotoSelecionado ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                nome={pilotoSelecionado.nome}
                avatarUrl={pilotoSelecionado.avatarUrl}
                tamanho="lg"
              />
              <div>
                <p className="text-ink text-lg font-semibold">
                  {nomeExibicaoPiloto(pilotoSelecionado)}
                </p>
                <p
                  className="font-mono text-sm"
                  style={{
                    color: corParaFundoClaro(
                      pilotoSelecionado.corNumero,
                      "#9399a6",
                    ),
                  }}
                >
                  #{pilotoSelecionado.numero}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-ink-3 text-xs tracking-wide uppercase">
                  Categoria
                </p>
                <p className="text-ink font-medium">
                  {categoriaDoSelecionado?.nome ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-ink-3 text-xs tracking-wide uppercase">
                  Estado
                </p>
                <p className="text-ink font-medium">
                  {pilotoSelecionado.uf ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-ink-3 text-xs tracking-wide uppercase">
                  Idade
                </p>
                <p className="text-ink font-medium">
                  {pilotoSelecionado.idade
                    ? `${pilotoSelecionado.idade} anos`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-ink-3 text-xs tracking-wide uppercase">
                  Peso
                </p>
                <p className="text-ink font-medium">
                  {pilotoSelecionado.pesoKg
                    ? `${pilotoSelecionado.pesoKg} kg`
                    : "—"}
                </p>
              </div>
            </div>
            <Link
              href={`/pilotos/${pilotoSelecionado.slug}`}
              className="text-orange-ink text-sm font-medium hover:underline"
            >
              Ver perfil completo →
            </Link>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
