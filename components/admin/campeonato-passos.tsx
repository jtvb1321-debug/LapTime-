"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TracadoMiniatura } from "@/components/tracado/tracado-miniatura";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { corSolidaCategoria } from "@/lib/categoria-cor";
import {
  adicionarLogoAction,
  ativarCampeonatoAction,
  criarCampeonatoAction,
  encerrarCampeonatoAction,
  excluirCampeonatoAction,
  removerLogoAction,
  salvarCategoriasDoCampeonatoAction,
  salvarDadosAction,
  salvarTracadosDoCampeonatoAction,
} from "@/lib/campeonatos-actions";
import { LOGO_TAMANHO_MAXIMO_BYTES, reduzirLogo } from "@/lib/logo-reduzido";
import type { AcaoState } from "@/lib/operacao-actions";
import type { Tracado } from "@/lib/types";

const INICIAL: AcaoState = {};

function Mensagem({ estado }: { estado: AcaoState | null }) {
  if (!estado) return null;
  if (estado.erro) {
    return (
      <p role="alert" className="text-danger text-sm">
        {estado.erro}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p role="status" className="text-success text-sm">
        {estado.ok}
      </p>
    );
  }
  return null;
}

// ---- Passo 1: criar / editar os dados -----------------------------------------------------

export function NovoCampeonatoForm() {
  const [estado, acao, pendente] = useActionState(
    criarCampeonatoAction,
    INICIAL,
  );
  const [nome, setNome] = useState("");
  const [temporada, setTemporada] = useState(String(new Date().getFullYear()));
  const [descricao, setDescricao] = useState("");
  return (
    <form action={acao} className="flex max-w-xl flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="novo-nome" className="text-ink text-sm font-medium">
            Nome do campeonato
          </label>
          <input
            id="novo-nome"
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Copa Grid Lap"
            required
            minLength={2}
            maxLength={80}
            className="campo"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="novo-temporada"
            className="text-ink text-sm font-medium"
          >
            Temporada
          </label>
          <input
            id="novo-temporada"
            name="temporada"
            value={temporada}
            onChange={(e) => setTemporada(e.target.value)}
            required
            maxLength={20}
            className="campo"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="novo-descricao"
          className="text-ink text-sm font-medium"
        >
          Descrição (opcional)
        </label>
        <textarea
          id="novo-descricao"
          name="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          maxLength={400}
          className="campo"
        />
      </div>
      <Mensagem estado={estado} />
      <div>
        <Button type="submit" disabled={pendente} carregando={pendente}>
          Criar e continuar
        </Button>
      </div>
    </form>
  );
}

export function DadosDoCampeonatoForm({
  id,
  nome: nomeInicial,
  temporada: temporadaInicial,
  descricao: descricaoInicial,
  podeEditar,
}: {
  id: string;
  nome: string;
  temporada: string;
  descricao: string;
  podeEditar: boolean;
}) {
  const [estado, acao, pendente] = useActionState(salvarDadosAction, INICIAL);
  const [nome, setNome] = useState(nomeInicial);
  const [temporada, setTemporada] = useState(temporadaInicial);
  const [descricao, setDescricao] = useState(descricaoInicial);
  return (
    <form action={acao} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dados-nome" className="text-ink text-sm font-medium">
            Nome
          </label>
          <input
            id="dados-nome"
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={!podeEditar}
            required
            minLength={2}
            maxLength={80}
            className="campo"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="dados-temporada"
            className="text-ink text-sm font-medium"
          >
            Temporada
          </label>
          <input
            id="dados-temporada"
            name="temporada"
            value={temporada}
            onChange={(e) => setTemporada(e.target.value)}
            disabled={!podeEditar}
            required
            maxLength={20}
            className="campo"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="dados-descricao"
          className="text-ink text-sm font-medium"
        >
          Descrição
        </label>
        <textarea
          id="dados-descricao"
          name="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          disabled={!podeEditar}
          rows={2}
          maxLength={400}
          className="campo"
        />
      </div>
      <Mensagem estado={estado} />
      {podeEditar ? (
        <div>
          <Button type="submit" disabled={pendente} carregando={pendente}>
            Salvar dados
          </Button>
        </div>
      ) : null}
    </form>
  );
}

// ---- Passo 3: categorias do campeonato ---------------------------------------------------

export function EscolherCategorias({
  campeonatoId,
  categorias,
  escolhidas,
  podeEditar,
}: {
  campeonatoId: string;
  categorias: { id: string; nome: string; pesoMinimoKg: number }[];
  escolhidas: string[];
  podeEditar: boolean;
}) {
  const [marcadas, setMarcadas] = useState<string[]>(escolhidas);
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();

  function alternar(id: string) {
    setResultado(null);
    setMarcadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-2 text-sm">
        Marque as categorias que vão competir neste campeonato. O nome e o peso
        mínimo de cada uma se ajustam em{" "}
        <Link
          href="/admin/categorias"
          className="text-orange-ink font-medium hover:underline"
        >
          Categorias
        </Link>
        .
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categorias.map((c) => {
          const marcada = marcadas.includes(c.id);
          return (
            <li key={c.id}>
              <label
                className={`bg-surface flex items-center gap-3 overflow-hidden rounded-lg border p-3 ${
                  marcada
                    ? "border-orange ring-orange/40 ring-1"
                    : "border-border"
                } ${podeEditar ? "cursor-pointer" : "cursor-default"}`}
              >
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={!podeEditar}
                  onChange={() => alternar(c.id)}
                  className="size-4 shrink-0"
                />
                <span
                  aria-hidden="true"
                  className={`h-8 w-1.5 shrink-0 rounded-full ${corSolidaCategoria(c.id)}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    <NomeCategoria
                      categoriaId={c.id}
                      className="inline-block rounded-md bg-[#0c1630] px-2 py-0.5"
                    >
                      {c.nome}
                    </NomeCategoria>
                  </span>
                  <span className="text-ink-3 block text-xs">
                    {c.pesoMinimoKg > 0
                      ? `Peso mínimo ${c.pesoMinimoKg} kg`
                      : "Sem peso mínimo"}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`text-sm font-medium ${marcadas.length >= 1 ? "text-success" : "text-warning"}`}
        >
          {marcadas.length === 1
            ? "1 categoria escolhida"
            : `${marcadas.length} categorias escolhidas`}
        </span>
        {podeEditar ? (
          <Button
            disabled={pendente}
            carregando={pendente}
            onClick={() =>
              iniciar(async () => {
                setResultado(
                  await salvarCategoriasDoCampeonatoAction(
                    campeonatoId,
                    marcadas,
                  ),
                );
              })
            }
          >
            Salvar categorias
          </Button>
        ) : null}
      </div>
      <Mensagem estado={resultado} />
    </div>
  );
}

// ---- Passo 4: traçados (da biblioteca) ----------------------------------------------------

export function EscolherTracados({
  campeonatoId,
  tracados,
  escolhidos,
  minimo,
  podeEditar,
}: {
  campeonatoId: string;
  tracados: Tracado[];
  escolhidos: string[];
  minimo: number;
  podeEditar: boolean;
}) {
  const [marcados, setMarcados] = useState<string[]>(escolhidos);
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();

  function alternar(id: string) {
    setResultado(null);
    setMarcados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  if (tracados.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-ink-2 text-sm">
          Ainda não há traçados na biblioteca. Desenhe pelo menos {minimo} sobre
          o asfalto do kartódromo e volte aqui para escolhê-los.
        </p>
        <div>
          <Link
            href="/admin/tracados"
            className="bg-orange text-on-orange inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium md:min-h-9"
          >
            Desenhar traçados
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-2 text-sm">
        Marque os traçados usados neste campeonato (mínimo {minimo}).{" "}
        <Link
          href="/admin/tracados"
          className="text-orange-ink font-medium hover:underline"
        >
          Desenhar um novo traçado
        </Link>
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tracados.map((t) => {
          const marcado = marcados.includes(t.id);
          return (
            <li key={t.id}>
              <label
                className={`bg-surface flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                  marcado
                    ? "border-orange ring-orange/40 ring-1"
                    : "border-border"
                } ${podeEditar ? "" : "cursor-default"}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={!podeEditar}
                  onChange={() => alternar(t.id)}
                  className="size-4 shrink-0"
                />
                <TracadoMiniatura
                  pontos={t.pontos}
                  fechado={t.fechado}
                  className="border-border h-12 w-20 shrink-0 rounded border"
                />
                <span className="min-w-0">
                  <span className="text-ink block truncate text-sm font-medium">
                    {t.nome}
                  </span>
                  <span className="text-ink-3 block text-xs">
                    {t.fechado ? "Circuito fechado" : "Rota aberta"}
                    {t.extensaoMetros ? ` · ≈ ${t.extensaoMetros} m` : ""}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`text-sm font-medium ${marcados.length >= minimo ? "text-success" : "text-warning"}`}
        >
          {marcados.length} de {minimo} necessários
        </span>
        {podeEditar ? (
          <Button
            disabled={pendente}
            carregando={pendente}
            onClick={() =>
              iniciar(async () => {
                setResultado(
                  await salvarTracadosDoCampeonatoAction(
                    campeonatoId,
                    marcados,
                  ),
                );
              })
            }
          >
            Salvar traçados
          </Button>
        ) : null}
      </div>
      <Mensagem estado={resultado} />
    </div>
  );
}

// ---- Passo 5: logos dos patrocinadores ----------------------------------------------------

export function LogosDoCampeonato({
  campeonatoId,
  logos,
  podeEditar,
}: {
  campeonatoId: string;
  logos: { id: string; nome: string; logo: string }[];
  podeEditar: boolean;
}) {
  const [nome, setNome] = useState("");
  const [novo, setNovo] = useState("");
  const [erroLocal, setErroLocal] = useState("");
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    setErroLocal("");
    if (!arquivo) return;
    if (arquivo.size > LOGO_TAMANHO_MAXIMO_BYTES) {
      return setErroLocal("Imagem muito grande — use um arquivo de até 8 MB.");
    }
    try {
      setNovo(await reduzirLogo(arquivo));
    } catch (erro) {
      setErroLocal(
        erro instanceof Error ? erro.message : "Não foi possível ler a imagem.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {logos.length === 0 ? (
        <p className="text-ink-2 text-sm">
          Nenhum logo ainda. Envie pelo menos 1 para poder ativar o campeonato.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {logos.map((l) => (
            <li
              key={l.id}
              className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex h-20 items-center justify-center rounded bg-[#0c1630] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.logo}
                  alt={`Logo ${l.nome}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink truncate text-sm font-medium">
                  {l.nome}
                </span>
                {podeEditar ? (
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() =>
                      iniciar(async () => {
                        setResultado(
                          await removerLogoAction(campeonatoId, l.id),
                        );
                      })
                    }
                    className="text-danger min-h-11 shrink-0 text-xs font-medium hover:underline md:min-h-0"
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {podeEditar ? (
        <div className="border-border bg-surface flex max-w-xl flex-col gap-3 rounded-lg border p-4">
          <p className="text-ink text-sm font-semibold">Novo logo</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="logo-nome" className="text-ink text-sm font-medium">
              Nome do patrocinador
            </label>
            <input
              id="logo-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={60}
              className="campo"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-28 items-center justify-center rounded bg-[#0c1630] p-2">
              {novo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={novo}
                  alt="Prévia do logo"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-white/50">Sem imagem</span>
              )}
            </div>
            <label
              htmlFor="logo-arquivo"
              className="text-orange-ink cursor-pointer text-sm font-medium hover:underline"
            >
              {novo ? "Trocar imagem" : "Escolher imagem"}
            </label>
            <input
              id="logo-arquivo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={aoEscolher}
            />
          </div>
          {erroLocal ? (
            <p role="alert" className="text-danger text-sm">
              {erroLocal}
            </p>
          ) : null}
          <div>
            <Button
              disabled={pendente || !novo || !nome.trim()}
              carregando={pendente}
              onClick={() =>
                iniciar(async () => {
                  const r = await adicionarLogoAction(campeonatoId, nome, novo);
                  setResultado(r);
                  if (r.ok) {
                    setNome("");
                    setNovo("");
                  }
                })
              }
            >
              Adicionar logo
            </Button>
          </div>
        </div>
      ) : null}
      <Mensagem estado={resultado} />
    </div>
  );
}

// ---- Passo 6: ativar ----------------------------------------------------------------------

export function AtivacaoDoCampeonato({
  campeonatoId,
  status,
  itens,
  podeEditar,
}: {
  campeonatoId: string;
  status: "rascunho" | "ativo" | "encerrado";
  itens: { rotulo: string; feito: boolean }[];
  podeEditar: boolean;
}) {
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();
  const pronto = itens.every((i) => i.feito);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {itens.map((i) => (
          <li key={i.rotulo} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`flex size-5 items-center justify-center rounded-full text-xs font-bold ${
                i.feito
                  ? "bg-success-bg text-success"
                  : "bg-warning-bg text-warning"
              }`}
            >
              {i.feito ? "✓" : "!"}
            </span>
            <span className={i.feito ? "text-ink" : "text-ink-2"}>
              {i.rotulo}
              <span className="sr-only">
                {i.feito ? " (feito)" : " (falta)"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-2">
          {status !== "ativo" ? (
            <Button
              disabled={!pronto || pendente}
              carregando={pendente}
              onClick={() =>
                iniciar(async () => {
                  setResultado(await ativarCampeonatoAction(campeonatoId));
                })
              }
            >
              {status === "encerrado"
                ? "Reativar campeonato"
                : "Ativar campeonato"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={pendente}
              onClick={() => {
                if (
                  !window.confirm(
                    "Encerrar o campeonato? Ele sai do site até ser ativado de novo.",
                  )
                ) {
                  return;
                }
                iniciar(async () => {
                  setResultado(await encerrarCampeonatoAction(campeonatoId));
                });
              }}
            >
              Encerrar campeonato
            </Button>
          )}
          {status !== "ativo" ? (
            <Button
              variant="ghost"
              disabled={pendente}
              onClick={() => {
                if (
                  !window.confirm(
                    "Excluir este campeonato? Imagem e logos dele também são apagados. Não dá para desfazer.",
                  )
                ) {
                  return;
                }
                iniciar(async () => {
                  setResultado(await excluirCampeonatoAction(campeonatoId));
                });
              }}
            >
              Excluir
            </Button>
          ) : null}
        </div>
      ) : null}
      {!pronto && status !== "ativo" ? (
        <p className="text-ink-3 text-xs">
          O botão de ativar libera quando todos os itens acima estiverem feitos.
        </p>
      ) : null}
      <Mensagem estado={resultado} />
    </div>
  );
}
