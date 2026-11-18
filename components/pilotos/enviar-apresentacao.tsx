"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ApresentacaoPiloto } from "@/components/pilotos/apresentacao-piloto";
import { FotoMacacao } from "@/components/site/foto-macacao";
import {
  atualizarApresentacaoAction,
  type ApresentacaoState,
} from "@/lib/apresentacao-actions";

const INICIAL: ApresentacaoState = {};

// Área do piloto: enviar (ou trocar) a foto de macacão e a cor da faixa do vídeo de apresentação.
export function EnviarApresentacao({
  numero,
  nome,
  corDestaque,
  corFaixa,
  temVideo,
  slug,
}: {
  numero: number;
  nome: string;
  corDestaque: string;
  corFaixa: string;
  temVideo: boolean;
  slug: string;
}) {
  const [state, acao, enviando] = useActionState(
    atualizarApresentacaoAction,
    INICIAL,
  );
  const [fotoCorpo, setFotoCorpo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="fotoCorpo" value={fotoCorpo} />
      <FotoMacacao
        fotoCorpo={fotoCorpo}
        aoMudar={setFotoCorpo}
        aoOcupar={setOcupado}
      />
      {fotoCorpo ? (
        <ApresentacaoPiloto
          parado
          fotoUrl={fotoCorpo}
          dados={{ numero, nome, corFaixa, corDestaque }}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!fotoCorpo || ocupado || enviando}
          className="bg-orange text-on-orange rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {enviando
            ? "Salvando…"
            : temVideo
              ? "Trocar meu vídeo"
              : "Criar meu vídeo"}
        </button>
        {state.ok ? (
          <p role="status" className="text-ink-2 text-sm">
            Pronto!{" "}
            <Link
              href={`/pilotos/${slug}`}
              className="text-orange-ink font-medium hover:underline"
            >
              Ver meu vídeo →
            </Link>
          </p>
        ) : null}
        {state.erro ? (
          <p role="alert" className="text-orange-ink text-sm">
            {state.erro}
          </p>
        ) : null}
      </div>
    </form>
  );
}
