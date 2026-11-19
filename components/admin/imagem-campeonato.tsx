"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  CapaDoCampeonato,
  type EnquadramentoDaCapa,
} from "@/components/ui/capa-do-campeonato";
import { salvarEnquadramentoAction } from "@/lib/campeonatos-actions";

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
  enquadramento,
  focoY,
  podeEditar,
}: {
  campeonatoId: string;
  nomeCampeonato: string;
  existente: boolean;
  altAtual: string;
  // Muda a cada gravação, para o navegador não mostrar a versão antiga.
  versao: number;
  enquadramento: EnquadramentoDaCapa;
  focoY: number;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<EnquadramentoDaCapa>(enquadramento);
  const [foco, setFoco] = useState(focoY);
  const [msgEnq, setMsgEnq] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);
  const [salvandoEnq, iniciarEnq] = useTransition();
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
      <div className="max-w-3xl">
        {mostrada ? (
          <CapaDoCampeonato
            src={mostrada}
            alt={previa ? `Prévia: ${alt || nomeCampeonato}` : altAtual}
            enquadramento={modo}
            focoY={foco}
          />
        ) : (
          <div className="border-border bg-bg text-ink-3 flex aspect-[16/7] w-full items-center justify-center rounded-lg border px-4 text-center text-sm">
            Sem imagem: o site usa o fundo padrão do Grid Lap.
          </div>
        )}
        {mostrada ? (
          <p className="text-ink-3 mt-1 text-xs">
            Prévia: é assim que a capa aparece na página inicial.
          </p>
        ) : null}
      </div>

      {podeEditar && mostrada ? (
        <fieldset className="border-border bg-surface flex max-w-xl flex-col gap-3 rounded-lg border p-4">
          <legend className="text-ink px-1 text-sm font-semibold">
            Enquadramento
          </legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="enquadramento"
              checked={modo === "inteira"}
              onChange={() => setModo("inteira")}
              className="mt-1"
            />
            <span>
              <span className="text-ink font-medium">Imagem inteira</span>{" "}
              (recomendado)
              <span className="text-ink-3 block text-xs">
                Mostra a imagem completa, sem cortar nada, na proporção dela.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="enquadramento"
              checked={modo === "preencher"}
              onChange={() => setModo("preencher")}
              className="mt-1"
            />
            <span>
              <span className="text-ink font-medium">Faixa panorâmica</span>
              <span className="text-ink-3 block text-xs">
                Preenche uma faixa larga e corta o que sobrar em cima e embaixo.
              </span>
            </span>
          </label>
          {modo === "preencher" ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="imagem-foco"
                className="text-ink text-sm font-medium"
              >
                Parte da imagem que fica visível
              </label>
              <input
                id="imagem-foco"
                type="range"
                min={0}
                max={100}
                step={1}
                value={foco}
                onChange={(e) => setFoco(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-ink-3 flex justify-between text-xs">
                <span>Topo</span>
                <span>Base</span>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={salvandoEnq}
              carregando={salvandoEnq}
              onClick={() =>
                iniciarEnq(async () => {
                  const r = await salvarEnquadramentoAction(
                    campeonatoId,
                    modo,
                    foco,
                  );
                  setMsgEnq(
                    r.erro
                      ? { tipo: "erro", texto: r.erro }
                      : { tipo: "ok", texto: r.ok ?? "Salvo." },
                  );
                  if (!r.erro) router.refresh();
                })
              }
            >
              Salvar enquadramento
            </Button>
            {msgEnq ? (
              <span
                role={msgEnq.tipo === "erro" ? "alert" : "status"}
                className={
                  msgEnq.tipo === "erro"
                    ? "text-danger text-sm"
                    : "text-success text-sm"
                }
              >
                {msgEnq.texto}
              </span>
            ) : null}
          </div>
        </fieldset>
      ) : null}

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
              JPG, PNG ou WebP, até 2 MB. Qualquer proporção: use &ldquo;Imagem
              inteira&rdquo; para não cortar nada.
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
              className="campo min-h-11 md:min-h-9"
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
