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
  excluirEtapaAction,
  removerLogoAction,
  salvarCategoriasDoCampeonatoAction,
  salvarEtapaAction,
  salvarPilotosDoCampeonatoAction,
  salvarDadosAction,
  salvarTracadosDoCampeonatoAction,
} from "@/lib/campeonatos-actions";
import { LOGO_TAMANHO_MAXIMO_BYTES, reduzirLogo } from "@/lib/logo-reduzido";
import type { AcaoState } from "@/lib/operacao-actions";
import { formatDataEHora } from "@/lib/etapa-formato";
import { formatMoeda } from "@/lib/mock/data";
import type { Etapa, Tracado } from "@/lib/types";

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

// ---- Etapas (calendário com data e horário) -----------------------------------------------

const ROTULO_SITUACAO: Record<string, string> = {
  agendada: "Agendada",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export function EtapasDoCampeonato({
  campeonatoId,
  etapas,
  tracados,
  podeEditar,
}: {
  campeonatoId: string;
  etapas: Etapa[];
  tracados: Tracado[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<string | "nova" | null>(null);
  const [nome, setNome] = useState("");
  const [kartodromo, setKartodromo] = useState("");
  const [cidade, setCidade] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [tracadoId, setTracadoId] = useState("");
  const [situacao, setSituacao] = useState("agendada");
  const [valor, setValor] = useState("");
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();

  function abrir(etapa?: Etapa) {
    setResultado(null);
    setEditando(etapa ? etapa.id : "nova");
    setNome(etapa?.nome ?? `Etapa ${etapas.length + 1}`);
    setKartodromo(etapa?.kartodromo ?? etapas.at(-1)?.kartodromo ?? "");
    setCidade(etapa?.cidade ?? etapas.at(-1)?.cidade ?? "");
    setData(etapa?.data ?? "");
    setHora(etapa?.hora ?? "");
    setTracadoId(etapa?.tracadoId ?? "");
    setSituacao(etapa?.status ?? "agendada");
    setValor(
      etapa?.valorInscricaoCentavos
        ? (etapa.valorInscricaoCentavos / 100).toFixed(2).replace(".", ",")
        : "",
    );
  }

  function salvar() {
    const reais =
      valor.trim() === ""
        ? 0
        : Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(reais) || reais < 0) {
      setResultado({
        erro: "Informe o valor da inscrição em reais (ex.: 80,00) ou deixe em branco.",
      });
      return;
    }
    iniciar(async () => {
      const r = await salvarEtapaAction(
        campeonatoId,
        editando === "nova" ? null : editando,
        {
          nome,
          kartodromo,
          cidade,
          data,
          hora,
          tracadoId: tracadoId || undefined,
          status: situacao,
          valorInscricaoCentavos: Math.round(reais * 100),
        },
      );
      setResultado(r);
      if (r.ok) setEditando(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {etapas.length === 0 ? (
        <p className="text-ink-2 text-sm">
          Nenhuma etapa ainda. Adicione as etapas com data e horário: elas viram
          o calendário da página inicial.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {etapas.map((e) => {
            const tracado = tracados.find((t) => t.id === e.tracadoId);
            return (
              <li
                key={e.id}
                className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="text-ink text-sm font-semibold">
                    {e.nome}{" "}
                    <span className="text-ink-3 font-normal">
                      · {ROTULO_SITUACAO[e.status] ?? e.status}
                    </span>
                  </p>
                  <p className="text-orange-ink text-sm font-medium">
                    {formatDataEHora(e)}
                  </p>
                  <p className="text-ink-2 text-xs">
                    {e.kartodromo}, {e.cidade}
                    {tracado ? ` · ${tracado.nome}` : ""}
                    {" · Inscrição "}
                    {e.valorInscricaoCentavos
                      ? formatMoeda(e.valorInscricaoCentavos)
                      : "gratuita"}
                  </p>
                </div>
                {podeEditar ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => abrir(e)}
                      className="text-orange-ink min-h-11 text-xs font-medium hover:underline md:min-h-0"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => {
                        if (!window.confirm(`Excluir a etapa ${e.nome}?`))
                          return;
                        iniciar(async () => {
                          setResultado(
                            await excluirEtapaAction(campeonatoId, e.id),
                          );
                        });
                      }}
                      className="text-danger min-h-11 text-xs font-medium hover:underline md:min-h-0"
                    >
                      Excluir
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {podeEditar && editando === null ? (
        <div>
          <Button variant="secondary" onClick={() => abrir()}>
            Adicionar etapa
          </Button>
        </div>
      ) : null}

      {podeEditar && editando !== null ? (
        <div className="border-border bg-surface flex max-w-2xl flex-col gap-3 rounded-lg border p-4">
          <p className="text-ink text-sm font-semibold">
            {editando === "nova" ? "Nova etapa" : "Editar etapa"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-nome"
                className="text-ink text-sm font-medium"
              >
                Nome
              </label>
              <input
                id="etapa-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                className="campo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-kartodromo"
                className="text-ink text-sm font-medium"
              >
                Kartódromo
              </label>
              <input
                id="etapa-kartodromo"
                value={kartodromo}
                onChange={(e) => setKartodromo(e.target.value)}
                maxLength={80}
                className="campo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-cidade"
                className="text-ink text-sm font-medium"
              >
                Cidade
              </label>
              <input
                id="etapa-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                maxLength={80}
                className="campo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="etapa-data"
                  className="text-ink text-sm font-medium"
                >
                  Data
                </label>
                <input
                  id="etapa-data"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="campo"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="etapa-hora"
                  className="text-ink text-sm font-medium"
                >
                  Horário
                </label>
                <input
                  id="etapa-hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="campo"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-tracado"
                className="text-ink text-sm font-medium"
              >
                Traçado (opcional)
              </label>
              <select
                id="etapa-tracado"
                value={tracadoId}
                onChange={(e) => setTracadoId(e.target.value)}
                className="campo"
              >
                <option value="">Sem traçado definido</option>
                {tracados.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              {tracados.length === 0 ? (
                <p className="text-ink-3 text-xs">
                  Escolha os traçados do campeonato no passo anterior para poder
                  vincular um aqui.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="etapa-valor"
                className="text-ink text-sm font-medium"
              >
                Valor da inscrição (R$)
              </label>
              <input
                id="etapa-valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Em branco = gratuita"
                className="campo"
              />
            </div>
            {editando !== "nova" ? (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="etapa-situacao"
                  className="text-ink text-sm font-medium"
                >
                  Situação
                </label>
                <select
                  id="etapa-situacao"
                  value={situacao}
                  onChange={(e) => setSituacao(e.target.value)}
                  className="campo"
                >
                  {Object.entries(ROTULO_SITUACAO).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button disabled={pendente} carregando={pendente} onClick={salvar}>
              {editando === "nova" ? "Adicionar etapa" : "Salvar etapa"}
            </Button>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      <Mensagem estado={resultado} />
    </div>
  );
}

// ---- Pilotos do campeonato ----------------------------------------------------------------

export function PilotosDoCampeonato({
  campeonatoId,
  pilotos,
  escolhidos,
  categoriasDoCampeonato,
  podeEditar,
}: {
  campeonatoId: string;
  pilotos: {
    id: string;
    nome: string;
    numero: number;
    categoriaId: string;
    categoriaNome: string;
  }[];
  escolhidos: string[];
  categoriasDoCampeonato: string[];
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

  if (pilotos.length === 0) {
    return (
      <p className="text-ink-2 text-sm">
        Ainda não há pilotos no sistema. Quem se cadastrar entra automaticamente
        neste campeonato.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-2 text-sm">
        Todos os pilotos cadastrados entram no campeonato. Desmarque quem não
        vai participar. Quem se cadastrar depois também entra automaticamente.
      </p>
      {podeEditar ? (
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => setMarcados(pilotos.map((p) => p.id))}
            className="text-orange-ink font-medium hover:underline"
          >
            Marcar todos
          </button>
          <button
            type="button"
            onClick={() => setMarcados([])}
            className="text-orange-ink font-medium hover:underline"
          >
            Desmarcar todos
          </button>
        </div>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pilotos.map((p) => {
          const marcado = marcados.includes(p.id);
          const foraDasCategorias =
            categoriasDoCampeonato.length > 0 &&
            !categoriasDoCampeonato.includes(p.categoriaId);
          return (
            <li key={p.id}>
              <label
                className={`bg-surface flex items-center gap-3 rounded-lg border p-2.5 ${
                  marcado
                    ? "border-orange ring-orange/40 ring-1"
                    : "border-border"
                } ${podeEditar ? "cursor-pointer" : "cursor-default"}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={!podeEditar}
                  onChange={() => alternar(p.id)}
                  className="size-4 shrink-0"
                />
                <span className="font-display text-ink-3 w-7 shrink-0 text-right text-sm">
                  {p.numero}
                </span>
                <span className="min-w-0">
                  <span className="text-ink block truncate text-sm font-medium">
                    {p.nome}
                  </span>
                  <span className="block text-xs">
                    <NomeCategoria
                      categoriaId={p.categoriaId}
                      className="inline-block rounded bg-[#0c1630] px-1.5"
                    >
                      {p.categoriaNome}
                    </NomeCategoria>
                    {foraDasCategorias ? (
                      <span className="text-warning ml-1">
                        · categoria fora do campeonato
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-ink-2 text-sm font-medium">
          {marcados.length} de {pilotos.length} pilotos
        </span>
        {podeEditar ? (
          <Button
            disabled={pendente}
            carregando={pendente}
            onClick={() =>
              iniciar(async () => {
                setResultado(
                  await salvarPilotosDoCampeonatoAction(campeonatoId, marcados),
                );
              })
            }
          >
            Salvar pilotos
          </Button>
        ) : null}
      </div>
      <Mensagem estado={resultado} />
    </div>
  );
}
