import Link from "next/link";
import type { ReactNode } from "react";
import type { Kart } from "@/lib/cronometragem/cadastros-store";
import type { PilotoDaCorrida } from "@/lib/cronometragem/corridas-store";
import {
  garagemDaBateria,
  matrizDeProntidao,
  pilotosSemKart,
  posicoesDoGrid,
  resumoDaGaragem,
  resumoDeProntidao,
  situacaoDaPreparacao,
  type EstadoDaExigencia,
  type ExigenciasDoPiloto,
  type LinhaDeProntidao,
} from "@/lib/cronometragem/preparacao-visual";

// Tela de preparação da bateria, composição "pit wall". Só mostra e organiza o que o
// sistema já sabe (grid, karts e pendências); não decide nada. As ações (cadastrar,
// sortear, check-in, remover, termos, iniciar) continuam nos componentes de sempre.

const COR: Record<EstadoDaExigencia, string> = {
  ok: "text-[var(--pw-verde)]",
  falta: "font-semibold text-[var(--pw-vermelho)]",
  aviso: "font-medium text-[var(--pw-ambar)]",
  "nao-se-aplica": "text-[var(--pw-dim)]",
};
const SIMBOLO: Record<EstadoDaExigencia, string> = {
  ok: "✓",
  falta: "✕",
  aviso: "!",
  "nao-se-aplica": "–",
};

function Celula({
  estado,
  texto,
}: {
  estado: EstadoDaExigencia;
  texto: string;
}) {
  return (
    <td className={`px-3 py-2 whitespace-nowrap ${COR[estado]}`}>
      <span aria-hidden="true" className="mr-1.5 inline-block w-3 text-center">
        {SIMBOLO[estado]}
      </span>
      {texto}
    </td>
  );
}

function textosDaLinha(
  l: LinhaDeProntidao,
): Record<keyof ExigenciasDoPiloto, string> {
  const { piloto: p, exigencias: e } = l;
  return {
    termo:
      e.termo === "ok"
        ? "Assinado"
        : p.termo === "sem_cadastro"
          ? "Sem cadastro"
          : "Pendente",
    pagamento:
      e.pagamento === "ok"
        ? "Pago"
        : e.pagamento === "aviso"
          ? "A receber"
          : "—",
    kart: e.kart === "ok" ? `Kart ${p.kartNumero}` : "Sem kart",
    sensor:
      e.sensor === "ok"
        ? "Sensor ok"
        : e.sensor === "falta"
          ? "Sem sensor"
          : "—",
    checkin: e.checkin === "ok" ? "Presente" : "Aguardando",
  };
}

function Cabecalho({
  nome,
  fase,
  grid,
}: {
  nome: string;
  fase: string;
  grid: PilotoDaCorrida[];
}) {
  const s = situacaoDaPreparacao(grid);
  const r = resumoDeProntidao(grid);
  const cor =
    s.tom === "pronta"
      ? "var(--pw-verde)"
      : s.tom === "pendente"
        ? "var(--pw-ambar)"
        : "var(--pw-dim)";
  const segmentos = matrizDeProntidao(grid);
  return (
    <header className="flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p
          className="text-xs font-semibold tracking-[0.18em] uppercase"
          style={{ color: "var(--pw-laranja)" }}
        >
          {fase === "classificacao"
            ? "Classificação"
            : fase === "corrida"
              ? "Corrida"
              : "Bateria"}{" "}
          · em preparação
        </p>
        <h2 className="mt-1 truncate text-xl font-semibold md:text-2xl">
          {nome}
        </h2>
        <p className="mt-2 text-lg font-semibold" style={{ color: cor }}>
          {s.titulo}
        </p>
        {s.faltas.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="O que falta">
            {s.faltas.map((f) => (
              <li
                key={f}
                className="rounded-sm border px-2 py-0.5 text-xs"
                style={{
                  borderColor: "var(--pw-line)",
                  color: "var(--pw-ink)",
                }}
              >
                {f}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {r.total > 0 ? (
        <div className="md:w-72">
          <p className="font-display text-3xl font-bold" style={{ color: cor }}>
            {r.aptos}
            <span className="text-lg" style={{ color: "var(--pw-dim)" }}>
              {" "}
              / {r.total}
            </span>
          </p>
          <div
            className="mt-2 flex gap-1"
            role="img"
            aria-label={`${r.aptos} de ${r.total} pilotos prontos para largar`}
          >
            {segmentos.map((l) => (
              <span
                key={l.piloto.id}
                className="pw-seg h-2 flex-1 rounded-sm"
                style={{
                  background: l.bloqueado
                    ? "var(--pw-vermelho)"
                    : l.completo
                      ? "var(--pw-verde)"
                      : "var(--pw-ambar)",
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Matriz({ grid }: { grid: PilotoDaCorrida[] }) {
  const linhas = matrizDeProntidao(grid);
  if (linhas.length === 0) return null;
  const todosCompletos = linhas.every((l) => l.completo);
  return (
    <section
      aria-labelledby="pw-matriz"
      className="border-t"
      style={{ borderColor: "var(--pw-line)" }}
    >
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <h3
          id="pw-matriz"
          className="text-sm font-semibold tracking-wide uppercase"
        >
          Prontidão
        </h3>
        <p className="text-xs" style={{ color: "var(--pw-dim)" }}>
          {todosCompletos
            ? "Nada pendente."
            : "O que falta aparece em destaque; o que já está feito fica esmaecido."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr
              className="text-xs uppercase"
              style={{ color: "var(--pw-dim)" }}
            >
              <th scope="col" className="px-5 py-2 font-medium">
                Piloto
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Termo
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Pagamento
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Kart
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Sensor
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Check-in
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const t = textosDaLinha(l);
              const e = l.exigencias;
              return (
                <tr
                  key={l.piloto.id}
                  data-situacao={
                    l.bloqueado
                      ? "bloqueado"
                      : l.completo
                        ? "completo"
                        : "aviso"
                  }
                  className={`border-t ${l.completo ? "opacity-60" : ""}`}
                  style={{ borderColor: "var(--pw-line)" }}
                >
                  <th
                    scope="row"
                    className="px-5 py-2 font-medium whitespace-nowrap"
                  >
                    {l.piloto.vaga ? (
                      <span style={{ color: "var(--pw-ambar)" }}>
                        Vaga sem piloto cadastrado
                      </span>
                    ) : (
                      l.piloto.nome
                    )}
                  </th>
                  {l.piloto.vaga ? (
                    <td
                      colSpan={5}
                      className="px-3 py-2"
                      style={{ color: "var(--pw-ambar)" }}
                    >
                      <span aria-hidden="true" className="mr-1.5">
                        !
                      </span>
                      Cadastre o piloto para esta vaga
                    </td>
                  ) : (
                    <>
                      <Celula estado={e.termo} texto={t.termo} />
                      <Celula estado={e.pagamento} texto={t.pagamento} />
                      <Celula estado={e.kart} texto={t.kart} />
                      <Celula estado={e.sensor} texto={t.sensor} />
                      <Celula estado={e.checkin} texto={t.checkin} />
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Largada({ grid }: { grid: PilotoDaCorrida[] }) {
  const posicoes = posicoesDoGrid(grid);
  const oficial = posicoes.some((p) => p.oficial);
  return (
    <section aria-labelledby="pw-grid" className="min-w-0">
      <h3
        id="pw-grid"
        className="text-sm font-semibold tracking-wide uppercase"
      >
        Grid de largada
      </h3>
      <p className="mt-1 text-xs" style={{ color: "var(--pw-dim)" }}>
        {oficial
          ? "Posições vindas da classificação."
          : "Sem classificação ainda: ordem de cadastro."}
      </p>
      {posicoes.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--pw-dim)" }}>
          Nenhum piloto ainda. Cadastre-os na lista abaixo.
        </p>
      ) : (
        <ol className="mt-3 grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
          {posicoes.map((x) => {
            const p = x.piloto;
            const pendente = !p.vaga && !p.apto;
            return (
              <li
                key={p.id}
                className={`pw-chanfro flex items-center gap-3 px-3 py-2 ${x.coluna === 1 ? "sm:mt-5" : ""}`}
                style={{
                  background: "var(--pw-panel)",
                  borderLeft: `3px solid ${p.vaga || pendente ? "var(--pw-ambar)" : "var(--pw-verde)"}`,
                }}
              >
                <span
                  className="w-6 shrink-0 font-display text-xs"
                  style={{ color: "var(--pw-dim)" }}
                >
                  P{x.posicao}
                </span>
                <span
                  className="pw-placa shrink-0"
                  data-estado={p.kartNumero ? "em-uso" : "vazio"}
                >
                  {p.kartNumero ?? "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {p.vaga ? "Vaga aberta" : p.nome}
                </span>
                <span
                  className="shrink-0 text-xs"
                  style={{
                    color:
                      p.vaga || pendente
                        ? "var(--pw-ambar)"
                        : "var(--pw-verde)",
                  }}
                >
                  {p.vaga ? "! vaga" : pendente ? "! pendente" : "✓ apto"}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function SemKartEGaragem({
  grid,
  karts,
}: {
  grid: PilotoDaCorrida[];
  karts: Kart[];
}) {
  const semKart = pilotosSemKart(grid);
  const itens = garagemDaBateria(karts, grid);
  const r = resumoDaGaragem(itens, grid);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {semKart.length > 0 ? (
        <section aria-labelledby="pw-semkart">
          <h3
            id="pw-semkart"
            className="text-sm font-semibold tracking-wide uppercase"
          >
            Pilotos sem kart
          </h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {semKart.map((p) => (
              <li
                key={p.id}
                className="truncate"
                style={{ color: "var(--pw-ambar)" }}
              >
                {p.nome}
              </li>
            ))}
          </ul>
          <a
            href="#pilotos-da-bateria"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium underline md:min-h-0"
            style={{ color: "var(--pw-ink)" }}
          >
            Ir ao sorteio de karts
          </a>
          {r.sobramParaSortear < 0 ? (
            <p className="mt-1 text-xs" style={{ color: "var(--pw-vermelho)" }}>
              Faltam {-r.sobramParaSortear} kart(s) livres com sensor para
              todos.
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="pw-garagem">
        <div className="flex items-baseline justify-between gap-2">
          <h3
            id="pw-garagem"
            className="text-sm font-semibold tracking-wide uppercase"
          >
            Garagem
          </h3>
          <Link
            href="/admin/cronometragem/pista"
            className="text-xs underline"
            style={{ color: "var(--pw-dim)" }}
          >
            Sensores e karts
          </Link>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--pw-dim)" }}>
          {r.emUso} em uso · {r.livres} livres
          {r.semSensor ? ` · ${r.semSensor} sem sensor` : ""}
          {r.fora ? ` · ${r.fora} fora` : ""}
        </p>
        {itens.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--pw-dim)" }}>
            Nenhum kart cadastrado. Cadastre em Equipamentos.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3 xl:grid-cols-4">
            {itens.map((k) => (
              <li
                key={k.kart.id}
                className="flex flex-col items-center gap-1 text-center"
                title={`Kart ${k.kart.numero}: ${k.texto}`}
              >
                <span className="pw-placa" data-estado={k.estado}>
                  {k.kart.numero}
                </span>
                <span
                  className="w-full truncate text-[11px]"
                  style={{
                    color:
                      k.estado === "sem-sensor"
                        ? "var(--pw-ambar)"
                        : "var(--pw-dim)",
                  }}
                >
                  {k.estado === "em-uso" ? k.piloto?.nome : k.texto}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PreparacaoDaBateria({
  nome,
  fase,
  grid,
  karts,
  acoes,
}: {
  nome: string;
  fase: string;
  grid: PilotoDaCorrida[];
  karts: Kart[];
  // Botões e orientação da bateria (AcoesDaBateria), sempre sob o estado atual.
  acoes?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {acoes}
      <div className="pw">
        <Cabecalho nome={nome} fase={fase} grid={grid} />
        <Matriz grid={grid} />
        <div
          className="grid grid-cols-1 gap-6 border-t p-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
          style={{ borderColor: "var(--pw-line)" }}
        >
          <Largada grid={grid} />
          <SemKartEGaragem grid={grid} karts={karts} />
        </div>
      </div>
    </div>
  );
}
