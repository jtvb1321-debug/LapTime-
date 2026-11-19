"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  anularPunicaoAction,
  criarPunicaoAction,
  decidirRecursoAction,
  recalcularClassificacaoAction,
  salvarPontuacaoAction,
} from "@/lib/resultados-campeonato-actions";
import type { AcaoState } from "@/lib/operacao-actions";
import type { ConfigDePontuacao } from "@/lib/pontuacao-campeonato";
import type {
  PunicaoCompleta,
  RecursoCompleto,
} from "@/lib/resultados-campeonato-store";

function Mensagem({ estado }: { estado: AcaoState | null }) {
  if (!estado) return null;
  if (estado.erro)
    return (
      <p role="alert" className="text-danger text-sm">
        {estado.erro}
      </p>
    );
  if (estado.ok)
    return (
      <p role="status" className="text-success text-sm">
        {estado.ok}
      </p>
    );
  return null;
}

export function RecalcularBotao() {
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        disabled={pendente}
        carregando={pendente}
        onClick={() =>
          iniciar(async () =>
            setResultado(await recalcularClassificacaoAction()),
          )
        }
      >
        Recalcular classificação
      </Button>
      <Mensagem estado={resultado} />
    </div>
  );
}

// ---- Tabela de pontos ---------------------------------------------------------------------

export function PontuacaoEditor({
  campeonatoId,
  config,
  podeEditar,
}: {
  campeonatoId: string;
  config: ConfigDePontuacao;
  podeEditar: boolean;
}) {
  const [posicoes, setPosicoes] = useState<string[]>(
    config.porPosicao.map(String),
  );
  const [pole, setPole] = useState(String(config.pole));
  const [volta, setVolta] = useState(String(config.voltaRapida));
  const [participacao, setParticipacao] = useState(String(config.participacao));
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();

  function numero(v: string) {
    return v.trim() === "" ? 0 : Number(v);
  }

  function salvar() {
    iniciar(async () => {
      setResultado(
        await salvarPontuacaoAction(campeonatoId, {
          porPosicao: posicoes.map(numero),
          pole: numero(pole),
          voltaRapida: numero(volta),
          participacao: numero(participacao),
        }),
      );
    });
  }

  const campo = "campo w-full";
  return (
    <div className="flex flex-col gap-5">
      <section className="border-border bg-surface flex max-w-2xl flex-col gap-3 rounded-xl border p-4">
        <h2 className="text-ink text-base font-semibold">Pontos por posição</h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {posicoes.map((p, i) => (
            <li key={i} className="flex flex-col gap-1">
              <label htmlFor={`pos-${i}`} className="text-ink-3 text-xs">
                {i + 1}º lugar
              </label>
              <input
                id={`pos-${i}`}
                inputMode="numeric"
                value={p}
                disabled={!podeEditar}
                onChange={(e) =>
                  setPosicoes((atual) =>
                    atual.map((x, j) => (j === i ? e.target.value : x)),
                  )
                }
                className={campo}
              />
            </li>
          ))}
        </ul>
        {podeEditar ? (
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              onClick={() =>
                setPosicoes((a) =>
                  a.length < 40
                    ? [...a, String(Math.max(0, numero(a.at(-1) ?? "1") - 1))]
                    : a,
                )
              }
              className="text-orange-ink min-h-11 font-medium hover:underline md:min-h-0"
            >
              Adicionar posição
            </button>
            <button
              type="button"
              onClick={() =>
                setPosicoes((a) => (a.length > 1 ? a.slice(0, -1) : a))
              }
              className="text-ink-2 min-h-11 font-medium hover:underline md:min-h-0"
            >
              Tirar a última
            </button>
          </div>
        ) : null}
        <p className="text-ink-3 text-xs">
          Quem chegar numa posição além da tabela não pontua pela chegada.
        </p>
      </section>

      <section className="border-border bg-surface grid max-w-2xl gap-3 rounded-xl border p-4 sm:grid-cols-3">
        {[
          [
            "pole",
            "Bônus de pole",
            pole,
            setPole,
            "Largar em 1º (melhor volta da classificação).",
          ],
          [
            "volta",
            "Bônus de volta mais rápida",
            volta,
            setVolta,
            "Melhor volta da corrida.",
          ],
          [
            "part",
            "Pontos por participar",
            participacao,
            setParticipacao,
            "Para quem largou.",
          ],
        ].map(([id, rotulo, valor, set, ajuda]) => (
          <div key={id as string} className="flex flex-col gap-1.5">
            <label
              htmlFor={`cfg-${id}`}
              className="text-ink text-sm font-medium"
            >
              {rotulo as string}
            </label>
            <input
              id={`cfg-${id}`}
              inputMode="numeric"
              value={valor as string}
              disabled={!podeEditar}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
              className={campo}
            />
            <p className="text-ink-3 text-xs">{ajuda as string}</p>
          </div>
        ))}
      </section>

      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pendente} carregando={pendente} onClick={salvar}>
            Salvar tabela de pontos
          </Button>
          <Mensagem estado={resultado} />
        </div>
      ) : null}
    </div>
  );
}

// ---- Punições -----------------------------------------------------------------------------

const ROTULO_TIPO = {
  advertencia: "Advertência",
  perda_pontos: "Perda de pontos",
  desclassificacao: "Desclassificação da etapa",
} as const;

export function PunicoesAdmin({
  campeonatoId,
  punicoes,
  etapas,
  pilotos,
  podeEditar,
}: {
  campeonatoId: string;
  punicoes: PunicaoCompleta[];
  etapas: { id: string; nome: string }[];
  pilotos: { id: string; nome: string; numero: number }[];
  podeEditar: boolean;
}) {
  const [tipo, setTipo] = useState("perda_pontos");
  const [etapa, setEtapa] = useState("");
  const [piloto, setPiloto] = useState("");
  const [pontos, setPontos] = useState("");
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      {podeEditar ? (
        <section className="border-border bg-surface flex max-w-2xl flex-col gap-3 rounded-xl border p-4">
          <h2 className="text-ink text-base font-semibold">
            Registrar punição
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pun-tipo"
                className="text-ink text-sm font-medium"
              >
                Tipo
              </label>
              <select
                id="pun-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="campo"
              >
                {Object.entries(ROTULO_TIPO).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pun-piloto"
                className="text-ink text-sm font-medium"
              >
                Piloto
              </label>
              <select
                id="pun-piloto"
                value={piloto}
                onChange={(e) => setPiloto(e.target.value)}
                className="campo"
              >
                <option value="">Escolha o piloto</option>
                {pilotos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.numero} · {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pun-etapa"
                className="text-ink text-sm font-medium"
              >
                Etapa {tipo === "advertencia" ? "(opcional)" : ""}
              </label>
              <select
                id="pun-etapa"
                value={etapa}
                onChange={(e) => setEtapa(e.target.value)}
                className="campo"
              >
                <option value="">
                  {tipo === "advertencia" ? "Sem etapa" : "Escolha a etapa"}
                </option>
                {etapas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
            {tipo === "perda_pontos" ? (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="pun-pontos"
                  className="text-ink text-sm font-medium"
                >
                  Pontos perdidos
                </label>
                <input
                  id="pun-pontos"
                  inputMode="numeric"
                  value={pontos}
                  onChange={(e) => setPontos(e.target.value)}
                  className="campo"
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="pun-motivo"
              className="text-ink text-sm font-medium"
            >
              Motivo
            </label>
            <textarea
              id="pun-motivo"
              rows={2}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="campo"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={pendente || !piloto}
              carregando={pendente}
              onClick={() =>
                iniciar(async () => {
                  const r = await criarPunicaoAction(campeonatoId, {
                    etapaId: etapa || null,
                    pilotoId: piloto,
                    tipo,
                    pontos: Number(pontos || 0),
                    motivo,
                  });
                  setResultado(r);
                  if (r.ok) {
                    setMotivo("");
                    setPontos("");
                  }
                })
              }
            >
              Registrar
            </Button>
            <Mensagem estado={resultado} />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-ink text-base font-semibold">
          Punições registradas
        </h2>
        {punicoes.length === 0 ? (
          <p className="text-ink-2 text-sm">Nenhuma punição registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {punicoes.map((u) => (
              <li
                key={u.id}
                className="border-border bg-surface flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="text-ink text-sm font-semibold">
                    #{u.pilotoNumero} {u.pilotoNome}{" "}
                    <span className="text-ink-3 font-normal">
                      · {ROTULO_TIPO[u.tipo]}
                      {u.tipo === "perda_pontos" ? ` (−${u.pontos})` : ""}
                      {u.etapaNome ? ` · ${u.etapaNome}` : ""}
                    </span>
                  </p>
                  <p className="text-ink-2 text-sm">{u.motivo}</p>
                </div>
                {u.anulada ? (
                  <StatusPill tone="neutral">anulada</StatusPill>
                ) : podeEditar ? (
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => {
                      if (!window.confirm("Anular esta punição?")) return;
                      iniciar(async () =>
                        setResultado(await anularPunicaoAction(u.id)),
                      );
                    }}
                    className="text-danger min-h-11 text-xs font-medium hover:underline md:min-h-0"
                  >
                    Anular
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---- Recursos -----------------------------------------------------------------------------

export function RecursosAdmin({
  recursos,
  podeEditar,
}: {
  recursos: RecursoCompleto[];
  podeEditar: boolean;
}) {
  const [pareceres, setPareceres] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<AcaoState | null>(null);
  const [pendente, iniciar] = useTransition();

  if (recursos.length === 0) {
    return (
      <p className="border-border text-ink-2 rounded-xl border border-dashed px-5 py-10 text-center text-sm">
        Nenhum recurso recebido. Os pilotos enviam pela Área do piloto.
      </p>
    );
  }

  function decidir(id: string, decisao: "deferido" | "indeferido") {
    iniciar(async () =>
      setResultado(
        await decidirRecursoAction(id, decisao, pareceres[id] ?? ""),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {recursos.map((r) => (
          <li
            key={r.id}
            className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink text-sm font-semibold">
                #{r.pilotoNumero} {r.pilotoNome}{" "}
                <span className="text-ink-3 font-normal">
                  {r.etapaNome ? `· ${r.etapaNome}` : "· sem etapa"} ·{" "}
                  {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
                </span>
              </p>
              <StatusPill
                tone={
                  r.status === "aberto"
                    ? "warning"
                    : r.status === "deferido"
                      ? "success"
                      : "neutral"
                }
              >
                {r.status === "aberto" ? "aguardando decisão" : r.status}
              </StatusPill>
            </div>
            <p className="text-ink-2 text-sm whitespace-pre-line">{r.texto}</p>
            {r.status !== "aberto" ? (
              <p className="text-ink text-sm">
                <span className="font-medium">Parecer:</span> {r.parecer}
              </p>
            ) : podeEditar ? (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`parecer-${r.id}`}
                  className="text-ink text-sm font-medium"
                >
                  Parecer
                </label>
                <textarea
                  id={`parecer-${r.id}`}
                  rows={2}
                  maxLength={1500}
                  value={pareceres[r.id] ?? ""}
                  onChange={(e) =>
                    setPareceres((p) => ({ ...p, [r.id]: e.target.value }))
                  }
                  className="campo"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={pendente}
                    onClick={() => decidir(r.id, "deferido")}
                  >
                    Deferir (aceitar)
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={pendente}
                    onClick={() => decidir(r.id, "indeferido")}
                  >
                    Indeferir (negar)
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <Mensagem estado={resultado} />
      <p className="text-ink-3 text-xs">
        Deferir um recurso não muda o resultado sozinho: se for o caso, registre
        a correção em Punições (anulando ou aplicando) ou na cronometragem.
      </p>
    </div>
  );
}
