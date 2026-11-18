import type { PainelDaCorrida } from "@/lib/cronometragem/corridas-store";
import {
  compararComOMotor,
  destaquesDaLinha,
  type ComparacaoDeClassificacao,
  type Destaque,
  type LinhaDaComparacao,
  type SituacaoNaComparacao,
} from "@/lib/cronometragem/comparacao-visual";
import type { Elegibilidade } from "@/lib/cronometragem/classificacao-melhor-volta";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";

// FASE 1, MODO SOMBRA: comparação NÃO OFICIAL entre a ordem do motor (oficial, na torre) e a ordem
// proposta por melhor volta. Só aparece em sessões de classificação. Não substitui a torre, não é
// gravada, não publica nada, não inicia nem encerra bateria e não forma o grid. As cores mostram
// diferenças da simulação; não são alertas de falha.

const SITUACAO: Record<SituacaoNaComparacao, string> = {
  normal: "Normal",
  dnf: "DNF",
  dns: "DNS",
  dsq: "DSQ",
  sem_volta_valida: "Sem volta válida",
};
const MOTIVO: Record<string, string> = {
  sem_sensor: "sem sensor",
  nao_largou: "não passou pelo sensor",
  sem_volta_fechada: "só a largada",
};
const ELEGIBILIDADE: Record<Elegibilidade, string> = {
  elegivel: "Elegível",
  inelegivel: "Inelegível",
  depende_do_regulamento: "Depende do regulamento",
};

// Cores da identidade Pit Wall para cada destaque.
const COR: Record<Destaque, string> = {
  sobe: "var(--pw-verde)",
  desce: "var(--pw-laranja)",
  empate: "var(--pw-azul)",
  dsq: "var(--pw-ink)",
  dns: "var(--pw-dim)",
  dnf_pendente: "var(--pw-ambar)",
  sem_volta_valida: "var(--pw-dim)",
  igual: "transparent",
};

function textoDaMarca(tipo: Destaque, l: LinhaDaComparacao): string {
  const m = l.movimento;
  switch (tipo) {
    case "sobe":
      return `▲ subiria ${typeof m === "object" && "sobe" in m ? m.sobe : ""}`;
    case "desce":
      return `▼ perderia ${typeof m === "object" && "desce" in m ? m.desce : ""}`;
    case "empate":
      return "Empate absoluto";
    case "dsq":
      return "DSQ · sem posição";
    case "dns":
      return "DNS · sem posição";
    case "dnf_pendente":
      return "DNF · elegibilidade pendente";
    case "sem_volta_valida":
      return `Sem volta válida${l.motivoSemPosicao && MOTIVO[l.motivoSemPosicao] ? ` (${MOTIVO[l.motivoSemPosicao]})` : ""}`;
    default:
      return "";
  }
}

function Marca({ tipo, l }: { tipo: Destaque; l: LinhaDaComparacao }) {
  if (tipo === "igual") return null;
  return (
    <span
      data-marca={tipo}
      className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{
        color: COR[tipo],
        borderColor: COR[tipo],
        borderStyle: tipo === "sem_volta_valida" ? "dashed" : "solid",
      }}
    >
      {textoDaMarca(tipo, l)}
    </span>
  );
}

function Movimento({ l }: { l: LinhaDaComparacao }) {
  const m = l.movimento;
  if (m === "igual") return <span style={{ color: "var(--pw-dim)" }}>=</span>;
  if (m === "sem_posicao")
    return <span style={{ color: "var(--pw-dim)" }}>—</span>;
  if ("sobe" in m) {
    return (
      <span style={{ color: COR.sobe }}>
        <span aria-hidden="true">▲ </span>
        <span className="sr-only">sobe </span>
        {m.sobe}
      </span>
    );
  }
  return (
    <span style={{ color: COR.desce }}>
      <span aria-hidden="true">▼ </span>
      <span className="sr-only">desce </span>
      {m.desce}
    </span>
  );
}

const tempo = (ms: number | null) =>
  ms === null ? "—" : formatarTempoVolta(ms);

// Marcas de situação (não de movimento), para a coluna/linha de situação.
const MARCAS_DE_SITUACAO: Destaque[] = [
  "dsq",
  "dns",
  "sem_volta_valida",
  "empate",
  "dnf_pendente",
];

function Legenda() {
  const itens: [Destaque, string][] = [
    ["sobe", "subiria"],
    ["desce", "perderia posições"],
    ["empate", "empate absoluto"],
    ["dsq", "DSQ"],
    ["dns", "DNS"],
    ["dnf_pendente", "DNF com elegibilidade pendente"],
    ["sem_volta_valida", "sem volta válida"],
  ];
  return (
    <div className="flex flex-col gap-1">
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]"
        aria-label="Legenda das cores"
      >
        {itens.map(([t, rotulo]) => (
          <li key={t} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-1"
              style={{
                background: t === "sem_volta_valida" ? "transparent" : COR[t],
                border:
                  t === "sem_volta_valida" ? `1px dashed ${COR[t]}` : undefined,
              }}
            />
            <span style={{ color: "var(--pw-dim)" }}>{rotulo}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px]" style={{ color: "var(--pw-dim)" }}>
        As cores mostram diferenças da simulação; não indicam falha de
        equipamento nem de operação.
      </p>
    </div>
  );
}

// Desktop e tablet: tabela completa.
function Tabela({ c }: { c: ComparacaoDeClassificacao }) {
  return (
    <div className="hidden overflow-x-auto md:block" data-comparacao-tabela>
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead>
          <tr
            className="text-[10px] tracking-[0.12em] uppercase"
            style={{ color: "var(--pw-dim)" }}
          >
            <th scope="col" className="px-3 py-2 font-medium">
              Kart
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Piloto
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Pos. motor (oficial)
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Pos. proposta (simulação)
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Diferença
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              Melhor volta
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              2ª melhor
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              Situação
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Elegibilidade para largar
            </th>
          </tr>
        </thead>
        <tbody>
          {c.linhas.map((l) => {
            const d = destaquesDaLinha(l);
            return (
              <tr
                key={l.participanteId}
                data-comparacao-kart={l.kartNumero ?? ""}
                data-situacao={l.situacao}
                data-destaque={d.principal}
                className="border-t"
                style={{ borderColor: "var(--pw-line)" }}
              >
                <td
                  className="px-3 py-2"
                  style={{ boxShadow: `inset 3px 0 0 ${COR[d.principal]}` }}
                >
                  <span
                    className="pw-placa"
                    data-estado={l.kartNumero ? "em-uso" : "vazio"}
                  >
                    {l.kartNumero ?? "—"}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span className="block font-medium">{l.nome}</span>
                  {l.semPilotoIdentificado ? (
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--pw-ambar)" }}
                    >
                      sem piloto identificado
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right font-display" data-pos-motor>
                  {l.posicaoMotor ?? "—"}
                </td>
                <td
                  className="px-2 py-2 text-right font-display"
                  data-pos-proposta
                >
                  {l.posicaoProposta ?? "—"}
                </td>
                <td className="px-2 py-2 text-right font-display">
                  <Movimento l={l} />
                </td>
                <td className="px-2 py-2 text-right font-display">
                  {tempo(l.melhorVoltaMs)}
                </td>
                <td className="px-2 py-2 text-right font-display">
                  {tempo(l.segundaMelhorVoltaMs)}
                </td>
                <td className="px-2 py-2">
                  <span className="flex flex-wrap items-center gap-1">
                    {d.marcas.some((m) => MARCAS_DE_SITUACAO.includes(m)) ? (
                      d.marcas
                        .filter((m) => MARCAS_DE_SITUACAO.includes(m))
                        .map((m) => <Marca key={m} tipo={m} l={l} />)
                    ) : (
                      <span>{SITUACAO[l.situacao]}</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {ELEGIBILIDADE[l.elegibilidade]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Celular: um cartão compacto por piloto, sem rolagem horizontal.
function Cartoes({ c }: { c: ComparacaoDeClassificacao }) {
  return (
    <ul className="flex flex-col gap-2 md:hidden" data-comparacao-cartoes>
      {c.linhas.map((l) => {
        const d = destaquesDaLinha(l);
        return (
          <li
            key={l.participanteId}
            data-comparacao-cartao={l.kartNumero ?? ""}
            data-destaque={d.principal}
            data-situacao={l.situacao}
            className="flex min-w-0 flex-col gap-2 rounded-sm px-3 py-2.5"
            style={{
              background: "var(--pw-panel)",
              boxShadow: `inset 3px 0 0 ${COR[d.principal]}`,
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="pw-placa shrink-0"
                data-estado={l.kartNumero ? "em-uso" : "vazio"}
              >
                {l.kartNumero ?? "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {l.nome}
                </span>
                {l.semPilotoIdentificado ? (
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--pw-ambar)" }}
                  >
                    sem piloto identificado
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-display text-sm">
                <Movimento l={l} />
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt
                  className="text-[10px] uppercase"
                  style={{ color: "var(--pw-dim)" }}
                >
                  Motor
                </dt>
                <dd className="font-display text-base font-bold" data-pos-motor>
                  {l.posicaoMotor ?? "—"}
                </dd>
              </div>
              <div>
                <dt
                  className="text-[10px] uppercase"
                  style={{ color: "var(--pw-dim)" }}
                >
                  Proposta
                </dt>
                <dd className="font-display text-base font-bold" data-pos-proposta>
                  {l.posicaoProposta ?? "—"}
                </dd>
              </div>
              <div>
                <dt
                  className="text-[10px] uppercase"
                  style={{ color: "var(--pw-dim)" }}
                >
                  Melhor
                </dt>
                <dd className="font-display text-sm">{tempo(l.melhorVoltaMs)}</dd>
              </div>
            </dl>
            {d.marcas.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {d.marcas.map((m) => (
                  <Marca key={m} tipo={m} l={l} />
                ))}
              </div>
            ) : null}
            <details className="text-xs">
              <summary
                className="min-h-11 cursor-pointer content-center"
                style={{ color: "var(--pw-dim)" }}
              >
                Mais detalhes
              </summary>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                <dt style={{ color: "var(--pw-dim)" }}>2ª melhor</dt>
                <dd className="font-display">{tempo(l.segundaMelhorVoltaMs)}</dd>
                <dt style={{ color: "var(--pw-dim)" }}>Situação</dt>
                <dd>{SITUACAO[l.situacao]}</dd>
                <dt style={{ color: "var(--pw-dim)" }}>Largar</dt>
                <dd>{ELEGIBILIDADE[l.elegibilidade]}</dd>
              </dl>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function ComparacaoDeClassificacao({
  painel,
}: {
  painel: PainelDaCorrida;
}) {
  // Proteção: um erro na simulação nunca pode derrubar a tela de cronometragem ao vivo.
  let c: ComparacaoDeClassificacao | null = null;
  try {
    c = compararComOMotor(painel.classificacao, painel.grid);
  } catch {
    c = null;
  }
  return (
    <details className="pw group" data-comparacao-simulacao>
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold tracking-wide uppercase">
          Comparação de classificação — Simulação
        </span>
        <span className="flex items-center gap-2">
          <span
            className="rounded-sm border px-2 py-0.5 text-[11px] font-bold tracking-wider"
            style={{ color: "var(--pw-ambar)", borderColor: "var(--pw-ambar)" }}
          >
            SIMULAÇÃO — NÃO OFICIAL
          </span>
          {c && c.quantasDiferem > 0 ? (
            <span className="text-xs" style={{ color: "var(--pw-dim)" }}>
              {c.quantasDiferem} posição(ões) diferente(s)
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className="text-xs group-open:rotate-180"
            style={{ color: "var(--pw-dim)" }}
          >
            ▾
          </span>
        </span>
      </summary>
      <div
        className="flex min-w-0 flex-col gap-4 border-t px-4 pt-3 pb-5 sm:px-5"
        style={{ borderColor: "var(--pw-line)" }}
      >
        <p
          role="note"
          className="rounded-sm px-3 py-2 text-sm font-semibold"
          style={{
            background: "rgba(255,176,32,0.12)",
            color: "var(--pw-ambar)",
          }}
        >
          SIMULAÇÃO — NÃO OFICIAL. Compara a ordem do motor com a classificação
          proposta por melhor volta. A classificação oficial é a da torre acima.
          Nada aqui é gravado, publicado nem usado para iniciar, encerrar ou
          formar o grid.
        </p>
        {c === null ? (
          <p className="text-sm" style={{ color: "var(--pw-dim)" }}>
            Comparação indisponível no momento. A cronometragem não é afetada.
          </p>
        ) : c.linhas.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pw-dim)" }}>
            Nenhum piloto na classificação ainda.
          </p>
        ) : (
          <>
            <Legenda />
            <Tabela c={c} />
            <Cartoes c={c} />
            <section aria-labelledby="pw-cmp-pend">
              <h4
                id="pw-cmp-pend"
                className="text-xs font-semibold tracking-wide uppercase"
              >
                Pendências regulamentares
              </h4>
              {c.pendenciasDeRegulamento.length === 0 &&
              c.grid.pendencias.length === 0 ? (
                <p className="mt-1 text-xs" style={{ color: "var(--pw-dim)" }}>
                  Nenhuma pendência nesta simulação.
                </p>
              ) : (
                <ul
                  className="mt-1 flex flex-col gap-1 text-xs"
                  data-pendencias-simulacao
                >
                  {c.pendenciasDeRegulamento.map((t, i) => (
                    <li key={`r${i}`} style={{ color: "var(--pw-azul)" }}>
                      • {t}
                    </li>
                  ))}
                  {c.grid.pendencias.map((t, i) => (
                    <li key={`g${i}`} style={{ color: "var(--pw-dim)" }}>
                      • {t}
                    </li>
                  ))}
                </ul>
              )}
              <p
                className="mt-2 text-xs"
                style={{ color: "var(--pw-dim)" }}
                data-grid-simulacao
              >
                Grid (só avaliação, nada é publicado):{" "}
                {c.grid.publicacaoBloqueada
                  ? "uma publicação definitiva ficaria bloqueada por empate absoluto até decisão autorizada."
                  : "sem empate absoluto entre quem largaria."}{" "}
                Pilotos com elegibilidade “depende do regulamento” não seriam
                autorizados a largar automaticamente.
              </p>
            </section>
          </>
        )}
      </div>
    </details>
  );
}
