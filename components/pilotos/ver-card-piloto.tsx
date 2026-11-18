"use client";

import { useState } from "react";
import { ApresentacaoPiloto } from "@/components/pilotos/apresentacao-piloto";
import { Dialog } from "@/components/ui/dialog";
import type { DadosApresentacao } from "@/lib/video-piloto/apresentacao";

// "Ver card do piloto": abre a arte personalizada (o vídeo de apresentação) num modal, com opção de
// ampliar. O download continua só para o admin (mesma regra de antes).
export function VerCardPiloto({
  dados,
  fotoUrl,
  podeBaixar,
  nomeArquivo,
}: {
  dados: DadosApresentacao;
  fotoUrl: string;
  podeBaixar: boolean;
  nomeArquivo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [ampliado, setAmpliado] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#4cc9ff]/60 px-4 text-sm font-semibold text-[#4cc9ff] transition-colors hover:bg-[#4cc9ff]/10 focus-visible:ring-2 focus-visible:ring-[#4cc9ff] focus-visible:outline-none"
      >
        Ver card do piloto
      </button>
      {aberto ? (
        <Dialog
          open
          onClose={() => {
            setAberto(false);
            setAmpliado(false);
          }}
          rotulo={`Card do piloto ${dados.nome}`}
          className={ampliado ? "max-w-6xl" : "max-w-3xl"}
        >
          <div className="flex flex-col gap-4 [&_*]:text-[inherit]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-ink text-lg font-semibold">
                Card do piloto
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmpliado((v) => !v)}
                  className="text-ink border-border-strong min-h-11 rounded-md border px-3 text-sm font-medium"
                  aria-pressed={ampliado}
                >
                  {ampliado ? "Reduzir" : "Ampliar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    setAmpliado(false);
                  }}
                  className="text-ink border-border-strong min-h-11 rounded-md border px-3 text-sm font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
            <ApresentacaoPiloto
              dados={dados}
              fotoUrl={fotoUrl}
              podeBaixar={podeBaixar}
              nomeArquivo={nomeArquivo}
            />
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
