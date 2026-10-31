"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const MAX = 2 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

// Imagem de apresentação do campeonato: prévia, envio, substituição e remoção.
// O servidor valida de novo formato, tamanho e permissão.
export function ImagemCampeonato({
  campeonatoId,
  nomeCampeonato,
  existente,
  altAtual,
  versao,
  podeEditar,
}: {
  campeonatoId: string;
  nomeCampeonato: string;
  existente: boolean;
  altAtual: string;
  // Muda a cada gravação, para o navegador não mostrar a versão antiga.
  versao: number;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [alt, setAlt] = useState(altAtual);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    null,
  );
  const previa = useMemo(
    () => (arquivo ? URL.createObjectURL(arquivo) : null),
    [arquivo],
  );
  const endereco = `/api/campeonatos/${encodeURIComponent(campeonatoId)}/imagem`;

  useEffect(
    () => () => {
      if (previa) URL.revokeObjectURL(previa);
    },
    [previa],
  );

  function escolher(f: File | undefined) {
    setMsg(null);
    if (!f) return setArquivo(null);
    if (!TIPOS.includes(f.type)) {
      setArquivo(null);
      return setMsg({
        tipo: "erro",
        texto: "Use uma imagem JPG, PNG ou WebP.",
      });
    }
    if (f.size > MAX) {
      setArquivo(null);
      return setMsg({ tipo: "erro", texto: "A imagem passa de 2 MB." });
    }
    setArquivo(f);
  }

  async function chamar(metodo: "PUT" | "DELETE") {
    setOcupado(true);
    setMsg(null);
    try {
      const corpo = new FormData();
      if (metodo === "PUT" && arquivo) {
        corpo.set("arquivo", arquivo);
        corpo.set("alt", alt);
      }
      const r = await fetch(endereco, {
        method: metodo,
        body: metodo === "PUT" ? corpo : undefined,
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível concluir.");
      setArquivo(null);
      if (entrada.current) entrada.current.value = "";
      setMsg({
        tipo: "ok",
        texto: metodo === "PUT" ? "Imagem salva." : "Imagem removida.",
      });
      router.refresh();
    } catch (e) {
      setMsg({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Falha de conexão.",
      });
    } finally {
      setOcupado(false);
    }
  }

  const mostrada = previa ?? (existente ? `${endereco}?v=${versao}` : null);

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-bg aspect-[16/7] w-full max-w-xl overflow-hidden rounded-lg border">
        {mostrada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mostrada}
            alt={previa ? `Prévia: ${alt || nomeCampeonato}` : altAtual}
            className="size-full object-cover"
          />
        ) : (
          <div className="text-ink-3 flex size-full items-center justify-center px-4 text-center text-sm">
            Sem imagem: o site usa o fundo padrão do Grid Lap.
          </div>
        )}
      </div>

      {podeEditar ? (
        <div className="flex max-w-xl flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="imagem-campeonato"
              className="text-ink text-sm font-medium"
            >
              {existente ? "Substituir imagem" : "Escolher imagem"}
            </label>
            <input
              id="imagem-campeonato"
              ref={entrada}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => escolher(e.target.files?.[0])}
              className="text-ink-2 file:bg-surface file:border-border-strong file:text-ink text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:px-3 md:file:min-h-9"
            />
            <p className="text-ink-3 text-xs">
              JPG, PNG ou WebP, até 2 MB. Proporção sugerida 16:7.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="imagem-alt"
              className="text-ink text-sm font-medium"
            >
              Texto alternativo
            </label>
            <input
              id="imagem-alt"
              value={alt}
              maxLength={200}
              onChange={(e) => setAlt(e.target.value)}
              placeholder={`Imagem do campeonato ${nomeCampeonato}`}
              className="border-border-strong bg-surface text-ink focus:border-orange min-h-11 rounded-md border px-3 py-2 text-sm outline-none md:min-h-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!arquivo || ocupado}
              aria-busy={ocupado}
              onClick={() => chamar("PUT")}
            >
              {ocupado ? "Aguarde…" : "Salvar imagem"}
            </Button>
            {existente ? (
              <Button
                type="button"
                variant="secondary"
                disabled={ocupado}
                onClick={() => {
                  if (window.confirm("Remover a imagem deste campeonato?")) {
                    void chamar("DELETE");
                  }
                }}
              >
                Remover imagem
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-ink-3 text-sm">
          Você pode ver a imagem, mas não alterá-la.
        </p>
      )}

      {msg ? (
        <p
          role={msg.tipo === "erro" ? "alert" : "status"}
          className={
            msg.tipo === "erro"
              ? "text-danger text-sm font-medium"
              : "text-success text-sm font-medium"
          }
        >
          {msg.texto}
        </p>
      ) : null}
    </div>
  );
}
