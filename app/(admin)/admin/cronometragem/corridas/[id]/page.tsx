import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { TabelaClassificacao } from "@/components/cronometragem/classificacao";
import { Contador } from "@/components/cronometragem/contador";
import { PistaAoVivo } from "@/components/cronometragem/pista-ao-vivo";
import { KartsNaPista } from "@/components/cronometragem/karts-na-pista";
import { PreparacaoDaBateria } from "@/components/cronometragem/preparacao-da-bateria";
import { PilotosDaBateria } from "@/components/cronometragem/pilotos-da-bateria";
import { PendenciasDaPista } from "@/components/cronometragem/pendencias-da-pista";
import { OcorrenciasDaBateria } from "@/components/cronometragem/ocorrencias-da-bateria";
import {
  TabelaQualificacao,
  TabelaVoltaAVolta,
} from "@/components/cronometragem/volta-a-volta";
import { Campo, FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  adicionarPilotoAction,
  adicionarPilotosAction,
  anularCorrecaoAction,
  armarCapturaAction,
  cancelarCorridaAction,
  definirKartAction,
  desvincularSensorAction,
  encerrarAgoraAction,
  excluirCorridaAction,
  finalizarCorridaAction,
  iniciarCorridaAction,
  inserirPassagemAction,
  invalidarPassagemAction,
  marcarProntaAction,
  definirDuracoesAction,
  novaBateriaAction,
  prepararCorridaAction,
  pularClassificacaoAction,
  reabrirPreparacaoAction,
  removerPilotoAction,
  rotularSensorAction,
  vincularSensorAction,
} from "@/lib/corrida-actions";
import { listarDecoders } from "@/lib/cronometragem/decoders-store";
import {
  criterioDaSessao,
  lerConfigDeClassificacao,
} from "@/lib/cronometragem/classificacao-oficial";
import {
  listarKarts,
  lerModeloDeVinculo,
  type Kart,
  type ModeloVinculo,
} from "@/lib/cronometragem/cadastros-store";
import {
  DURACAO_PADRAO_MIN,
  lerPainel,
  type CorrecaoDaCorrida,
  type EstadoCorrida,
  type FaseCorrida,
  type PassagemDoHistorico,
  type PilotoDaCorrida,
  type SensorDetectado,
} from "@/lib/cronometragem/corridas-store";
import {
  ESTADO_CORRIDA,
  MODO_ENCERRAMENTO,
  REGRA_LARGADA,
  STATUS_PASSAGEM,
  nomeDoSensor,
} from "@/lib/cronometragem/rotulos";
import { kartsNaPista } from "@/lib/cronometragem/karts-na-pista";
import {
  formatarDuracao,
  formatarHoraComMs,
  formatarTempoVolta,
} from "@/lib/cronometragem/voltas";
import { caixaAberto } from "@/lib/operacao/caixa-store";
import { buscarClientes } from "@/lib/operacao/clientes-store";
import { formatarHora } from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Bateria" };
export const dynamic = "force-dynamic";

const CLASSE_CAMPO = "campo";

const CLASSE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors";

// ---- Passo a passo -------------------------------------------------------

function passosDaBateria(porKart: boolean): string[] {
  return porKart
    ? ["Preparar", "Bateria", "Resultado"]
    : ["Pilotos e sensores", "Confirmar", "Bateria", "Resultado"];
}

function indiceDoPasso(estado: EstadoCorrida, porKart: boolean): number {
  const ultimo = passosDaBateria(porKart).length - 1;
  switch (estado) {
    case "preparada":
      return 0;
    case "pronta":
      return porKart ? 0 : 1;
    case "em_andamento":
    case "encerrando":
      return ultimo - 1;
    default:
      return ultimo;
  }
}

// A sequência é real (cada passo só vale depois do anterior), por isso é numerada.
function PassoAPasso({
  estado,
  porKart,
}: {
  estado: EstadoCorrida;
  porKart: boolean;
}) {
  if (estado === "cancelada") return null;
  const passos = passosDaBateria(porKart);
  const atual = indiceDoPasso(estado, porKart);
  return (
    <ol
      className="flex flex-wrap gap-x-6 gap-y-2"
      aria-label="Etapas da bateria"
    >
      {passos.map((rotulo, i) => {
        const feito = i < atual || estado === "finalizada";
        const ativo = i === atual && estado !== "finalizada";
        return (
          <li
            key={rotulo}
            aria-current={ativo ? "step" : undefined}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className={
                feito
                  ? "bg-ink flex size-6 items-center justify-center rounded-full text-xs text-white"
                  : ativo
                    ? "bg-orange text-on-orange flex size-6 items-center justify-center rounded-full text-xs font-semibold"
                    : "border-border-strong text-ink-3 flex size-6 items-center justify-center rounded-full border text-xs"
              }
            >
              {feito ? "✓" : i + 1}
            </span>
            <span
              className={
                ativo
                  ? "text-ink font-semibold"
                  : feito
                    ? "text-ink-2"
                    : "text-ink-3"
              }
            >
              {rotulo}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ---- Controles do modelo "piloto" (sensor ligado ao piloto) -----------------

function SelecaoDeKart({
  piloto,
  karts,
}: {
  piloto: PilotoDaCorrida;
  karts: Kart[];
}) {
  return (
    <FormAcao
      action={definirKartAction}
      rotulo="Definir kart"
      variante="secondary"
    >
      <input type="hidden" name="pilotoId" value={piloto.id} />
      <select
        name="kartId"
        id={`kart-${piloto.id}`}
        aria-label={`Kart de ${piloto.nome}`}
        defaultValue={piloto.kartId ?? ""}
        className={CLASSE_CAMPO}
      >
        <option value="">(sem kart)</option>
        {karts
          .filter((k) => k.status === "ativo" || k.id === piloto.kartId)
          .map((k) => (
            <option key={k.id} value={k.id}>
              Kart {k.numero}
              {k.apelido ? ` · ${k.apelido}` : ""}
              {k.transponderFixo ? "" : " (sem transponder fixo)"}
            </option>
          ))}
      </select>
    </FormAcao>
  );
}

function ControlesDoSensor({
  piloto,
  detectados,
}: {
  piloto: PilotoDaCorrida;
  detectados: SensorDetectado[];
}) {
  if (piloto.transponder) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm">
          {nomeDoSensor(piloto.transponder, piloto.rotulo)}
        </span>
        <FormAcao
          action={desvincularSensorAction}
          rotulo="Soltar sensor"
          variante="ghost"
        >
          <input type="hidden" name="pilotoId" value={piloto.id} />
        </FormAcao>
      </div>
    );
  }
  if (piloto.capturaArmada) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone="orange">
          Aguardando: passe o kart pelo sensor
        </StatusPill>
        <FormAcao
          action={armarCapturaAction}
          rotulo="Cancelar"
          variante="ghost"
        >
          <input type="hidden" name="pilotoId" value={piloto.id} />
          <input type="hidden" name="armar" value="0" />
        </FormAcao>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <FormAcao action={armarCapturaAction} rotulo="Capturar próximo sensor">
        <input type="hidden" name="pilotoId" value={piloto.id} />
        <input type="hidden" name="armar" value="1" />
      </FormAcao>
      {detectados.length > 0 ? (
        <FormAcao
          action={vincularSensorAction}
          rotulo="Vincular"
          variante="secondary"
        >
          <input type="hidden" name="pilotoId" value={piloto.id} />
          <select
            name="sensor"
            id={`sensor-${piloto.id}`}
            aria-label={`Sensor de ${piloto.nome}`}
            defaultValue=""
            className={CLASSE_CAMPO}
          >
            <option value="" disabled>
              ou escolha um sensor já lido…
            </option>
            {detectados.map((s) => (
              <option key={s.transponder} value={s.transponder}>
                {nomeDoSensor(s.transponder, s.rotulo)}
              </option>
            ))}
          </select>
        </FormAcao>
      ) : null}
    </div>
  );
}

// ---- Ações principais ------------------------------------------------------

function AcoesDaBateria({
  corridaId,
  estado,
  porKart,
  podeOperar,
  podeIniciar,
  semSensor,
  totalPilotos,
  kartsProntos,
  fase,
  duracaoMin,
  duracaoCorridaMin,
  barraNoCelular = false,
}: {
  // Tela nova: no celular a fileira de botões fica fixa na base da tela.
  barraNoCelular?: boolean;
  corridaId: string;
  fase: FaseCorrida;
  duracaoMin?: number;
  duracaoCorridaMin?: number;
  estado: EstadoCorrida;
  porKart: boolean;
  podeOperar: boolean;
  podeIniciar: boolean;
  semSensor: string[];
  totalPilotos: number;
  kartsProntos: number;
}) {
  const oculto = <input type="hidden" name="corridaId" value={corridaId} />;
  const ehQuali = fase === "classificacao";
  const nomeDaFase = ehQuali
    ? "classificação"
    : fase === "corrida"
      ? "corrida"
      : "bateria";
  const ativa = estado === "em_andamento" || estado === "encerrando";
  if (estado === "finalizada" || estado === "cancelada") return null;
  if (!podeOperar && !podeIniciar) return null;

  const texto = (() => {
    if (estado === "preparada" && porKart && fase === "classificacao") {
      return `Classificação de ${duracaoMin ?? 5} min: define o grid da corrida (de ${duracaoCorridaMin ?? 12} min). Inicie, ou pule para ir direto à corrida.`;
    }
    if (estado === "preparada" && porKart && fase === "corrida") {
      return `Corrida de ${duracaoMin ?? 12} min, largando na ordem do grid. Inicie quando os pilotos estiverem nos karts.`;
    }
    if (estado === "preparada" && porKart) {
      return kartsProntos > 0
        ? `${kartsProntos} kart(s) com sensor cadastrado. Inicie: cada kart entra sozinho na classificação ao passar pelo decoder.`
        : "Nenhum kart com sensor cadastrado ainda. Cadastre em Equipamentos → Karts (ou a bateria começará vazia).";
    }
    if (estado === "preparada") {
      if (totalPilotos === 0) {
        return "Adicione os pilotos abaixo e depois ligue cada um a um sensor.";
      }
      return semSensor.length > 0
        ? `Falta sensor para: ${semSensor.join(", ")}. Vincule abaixo ou remova o piloto da lista.`
        : "Tudo pronto: confirme o grid para poder iniciar.";
    }
    if (estado === "pronta") {
      return "Grid confirmado. Inicie quando os karts estiverem na pista.";
    }
    if (estado === "em_andamento") {
      return ehQuali
        ? `Classificação em andamento (${duracaoMin ?? 5} min): termina sozinha no fim do tempo, e a corrida de ${duracaoCorridaMin ?? 12} min é criada na hora. Dá para encerrar antes.`
        : "Bateria em andamento: ao fim do tempo ela passa para “Encerrando”.";
    }
    return "Tempo esgotado: finalize quando todos tiverem cruzado a linha (ou deixe o sistema finalizar, conforme a regra).";
  })();

  return (
    <Card>
      <CardBody>
        <div
          className={
            barraNoCelular
              ? "max-md:border-border-strong max-md:bg-surface flex flex-wrap items-start gap-3 max-md:fixed max-md:inset-x-0 max-md:bottom-[var(--nav-inferior)] max-md:z-20 max-md:max-h-[45vh] max-md:overflow-y-auto max-md:border-t max-md:p-3 max-md:pb-3 max-md:shadow-[0_-4px_12px_rgba(0,0,0,0.18)] max-md:empty:hidden max-md:[&>form]:min-w-[45%] max-md:[&>form]:flex-1"
              : "flex flex-wrap items-start gap-3"
          }
        >
          {estado === "preparada" && !porKart && podeOperar ? (
            <FormAcao action={marcarProntaAction} rotulo="Confirmar grid">
              {oculto}
            </FormAcao>
          ) : null}
          {(estado === "pronta" || (estado === "preparada" && porKart)) &&
          podeIniciar ? (
            <FormAcao
              action={iniciarCorridaAction}
              rotulo={
                ehQuali
                  ? `Iniciar classificação (${duracaoMin ?? 5} min)`
                  : `Iniciar ${nomeDaFase}`
              }
            >
              {oculto}
            </FormAcao>
          ) : null}
          {ehQuali &&
          (estado === "pronta" || estado === "preparada") &&
          podeOperar ? (
            <FormAcao
              action={pularClassificacaoAction}
              rotulo="Pular classificação"
              variante="secondary"
            >
              {oculto}
            </FormAcao>
          ) : null}
          {estado === "pronta" && podeOperar ? (
            <FormAcao
              action={reabrirPreparacaoAction}
              rotulo="Voltar à preparação"
              variante="secondary"
            >
              {oculto}
            </FormAcao>
          ) : null}
          {estado === "em_andamento" && podeIniciar && !ehQuali ? (
            <FormAcao
              action={encerrarAgoraAction}
              rotulo="Dar bandeira (encerrar agora)"
              variante="secondary"
            >
              {oculto}
            </FormAcao>
          ) : null}
          {ativa && podeIniciar ? (
            <FormAcao
              action={finalizarCorridaAction}
              confirmar={
                ehQuali
                  ? "Encerrar a classificação agora? Os pilotos param de pontuar voltas."
                  : "Finalizar a bateria? Depois disso o resultado é fechado."
              }
              rotulo={
                ehQuali ? "Encerrar a classificação agora" : "Finalizar bateria"
              }
            >
              {oculto}
            </FormAcao>
          ) : null}
        </div>
        <p className="text-ink-2 mt-3 text-sm">{texto}</p>
        {podeOperar && duracaoMin ? (
          <details className="mt-3">
            <summary className="text-ink-2 cursor-pointer text-sm font-medium">
              Tempos:{" "}
              {ehQuali
                ? `classificação ${duracaoMin} min`
                : `${duracaoMin} min`}
              {ehQuali && duracaoCorridaMin
                ? ` · corrida ${duracaoCorridaMin} min`
                : ""}{" "}
              (editar)
            </summary>
            <FormAcao
              action={definirDuracoesAction}
              rotulo="Salvar tempos"
              limpar={false}
              className="mt-3 max-w-xs"
            >
              {oculto}
              <Campo
                id="duracao"
                rotulo={
                  ehQuali
                    ? "Classificação (minutos)"
                    : fase === "corrida"
                      ? "Corrida (minutos)"
                      : "Duração (minutos)"
                }
                type="number"
                min={1}
                max={240}
                defaultValue={duracaoMin}
                dica={
                  estado === "em_andamento"
                    ? "A bateria está rodando: o novo tempo conta desde a largada."
                    : undefined
                }
              />
              {ehQuali && estado !== "em_andamento" ? (
                <Campo
                  id="duracaoCorrida"
                  rotulo="Corrida (minutos)"
                  type="number"
                  min={1}
                  max={240}
                  defaultValue={duracaoCorridaMin ?? DURACAO_PADRAO_MIN}
                  dica="Criada sozinha quando a classificação terminar ou for pulada."
                />
              ) : null}
            </FormAcao>
          </details>
        ) : null}
        {podeOperar ? (
          <details className="mt-3">
            <summary className="text-ink-3 cursor-pointer text-xs">
              Mais ações
            </summary>
            <div className="mt-2 flex flex-wrap items-start gap-3">
              <details>
                <summary className="text-ink-2 cursor-pointer text-sm">
                  Cancelar bateria
                </summary>
                <FormAcao
                  action={cancelarCorridaAction}
                  confirmar="Cancelar esta bateria? Essa ação fica registrada na auditoria."
                  rotulo="Confirmar cancelamento"
                  variante="secondary"
                  className="mt-2 w-64"
                >
                  {oculto}
                  <Campo id="motivo" rotulo="Motivo" required minLength={3} />
                </FormAcao>
              </details>
              {estado === "preparada" || estado === "pronta" ? (
                <FormAcao
                  action={excluirCorridaAction}
                  rotulo="Excluir bateria"
                  variante="ghost"
                >
                  {oculto}
                </FormAcao>
              ) : null}
            </div>
          </details>
        ) : null}
      </CardBody>
    </Card>
  );
}

// Seção que abre e fecha (o que não é urgente fica recolhido).
function Recolhivel({
  titulo,
  resumo,
  aberta,
  children,
}: {
  titulo: string;
  resumo?: string;
  aberta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={aberta}
      className="border-border bg-surface group rounded-lg border"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4">
        <span className="text-ink text-sm font-semibold">{titulo}</span>
        {resumo ? <span className="text-ink-3 text-xs">{resumo}</span> : null}
      </summary>
      <div className="border-border flex flex-col gap-3 border-t px-5 py-4">
        {children}
      </div>
    </details>
  );
}

// PDF abre no navegador (de onde dá para imprimir) ou baixa direto.
function LinhaDeRelatorio({
  corridaId,
  tipo,
  titulo,
  descricao,
}: {
  corridaId: string;
  tipo: "completo" | "qualy" | "voltas" | "resultado";
  titulo: string;
  descricao: string;
}) {
  const base = `/api/cronometragem/corridas/${corridaId}/relatorio?tipo=${tipo}`;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div>
        <p className="text-ink text-sm font-medium">{titulo}</p>
        <p className="text-ink-3 text-xs">{descricao}</p>
      </div>
      <div className="flex gap-2">
        <a
          href={base}
          target="_blank"
          rel="noopener noreferrer"
          className={`${CLASSE_BOTAO} bg-ink hover:bg-ink/90 text-white`}
        >
          Abrir / imprimir
        </a>
        <a
          href={`${base}&baixar=1`}
          download
          className={`${CLASSE_BOTAO} bg-surface text-ink border-border-strong hover:border-orange/50 hover:text-orange-ink border`}
        >
          Baixar PDF
        </a>
      </div>
    </li>
  );
}

// As duas fases da bateria: classificação (define o grid) e corrida.
function BarraDeFases({
  fases,
  atual,
  podeOperar,
  classificacaoId,
  classificacaoFinalizada,
}: {
  fases: NonNullable<Awaited<ReturnType<typeof lerPainel>>>["fases"];
  atual: "unica" | "classificacao" | "corrida";
  podeOperar: boolean;
  classificacaoId?: string;
  classificacaoFinalizada: boolean;
}) {
  if (!fases) return null;
  const itens = [
    {
      chave: "classificacao" as const,
      rotulo: "Classificação",
      fase: fases.classificacao,
    },
    { chave: "corrida" as const, rotulo: "Corrida", fase: fases.corrida },
  ];
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap items-center gap-2">
        {itens.map((i, n) => (
          <li key={i.chave} className="flex items-center gap-2">
            {n > 0 ? <span className="text-ink-3">→</span> : null}
            {i.fase ? (
              <Link
                href={`/admin/cronometragem/corridas/${i.fase.id}`}
                aria-current={atual === i.chave ? "step" : undefined}
                className={
                  atual === i.chave
                    ? "bg-ink text-bg rounded-md px-3 py-1.5 text-sm font-medium"
                    : "border-border-strong text-ink hover:bg-ink/5 rounded-md border px-3 py-1.5 text-sm font-medium"
                }
              >
                {i.rotulo} · {ESTADO_CORRIDA[i.fase.estado].rotulo}
              </Link>
            ) : (
              <span className="border-border text-ink-3 rounded-md border border-dashed px-3 py-1.5 text-sm">
                {i.rotulo} · ainda não criada
              </span>
            )}
          </li>
        ))}
      </ol>
      {classificacaoId &&
      classificacaoFinalizada &&
      fases.corrida &&
      fases.corrida.estado !== "finalizada" ? (
        <Card className="border-orange">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-orange-ink text-xs font-semibold tracking-wide uppercase">
                Classificação encerrada
              </p>
              <p className="text-ink text-lg font-semibold">
                A corrida já foi criada
              </p>
              <p className="text-ink-2 text-sm">
                O grid vem da melhor volta de cada piloto. Confira ou altere o
                tempo da corrida e inicie.
              </p>
            </div>
            <Link
              href={`/admin/cronometragem/corridas/${fases.corrida.id}`}
              className="bg-ink text-bg inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
            >
              Ir para a corrida →
            </Link>
          </CardBody>
        </Card>
      ) : null}
      {classificacaoId &&
      classificacaoFinalizada &&
      !fases.corrida &&
      podeOperar ? (
        <Card>
          <CardHeader>
            <h2 className="text-ink text-base font-semibold">
              Próximo passo: a corrida
            </h2>
            <p className="text-ink-2 mt-1 text-sm">
              A classificação terminou. A corrida leva os mesmos pilotos, karts
              e sensores e larga na ordem da melhor volta de cada um (quem não
              fez tempo larga atrás). Os termos já assinados valem.
            </p>
          </CardHeader>
          <CardBody>
            <FormAcao
              action={prepararCorridaAction}
              rotulo="Criar a corrida"
              className="max-w-xs"
            >
              <input
                type="hidden"
                name="classificacaoId"
                value={classificacaoId}
              />
              <Campo
                id="duracao-corrida"
                name="duracao"
                rotulo="Duração da corrida (minutos)"
                type="number"
                min={1}
                max={240}
                defaultValue={DURACAO_PADRAO_MIN}
              />
            </FormAcao>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

// Os termos são resolvidos na aba Termos, antes da bateria; aqui só o resumo e o atalho.
function ResumoDosTermos({ grid }: { grid: PilotoDaCorrida[] }) {
  const pilotos = grid.filter((p) => p.clienteId && !p.vaga);
  if (pilotos.length === 0) return null;
  const faltam = pilotos.filter((p) => p.termo !== "valido");
  return (
    <div
      id="termos"
      className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-lg border px-5 py-4"
    >
      <div>
        <p className="text-ink text-sm font-semibold">
          Termos de responsabilidade: {pilotos.length - faltam.length} de{" "}
          {pilotos.length} assinados
        </p>
        {faltam.length > 0 ? (
          <p role="status" className="text-warning text-sm font-medium">
            Faltam assinar: {faltam.map((p) => p.nome).join(", ")}.
          </p>
        ) : (
          <p className="text-ink-3 text-xs">Todos os pilotos já assinaram.</p>
        )}
      </div>
      <Link
        href="/admin/cronometragem/termos"
        className="text-orange-ink inline-flex min-h-11 items-center text-sm font-medium hover:underline"
      >
        Abrir a aba Termos
      </Link>
    </div>
  );
}

export default async function BateriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ busca?: string; visual?: string }>;
}) {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeOperar = pode(sessao.papel, "sessao.operar");
  const podeIniciar = pode(sessao.papel, "prova.iniciar_encerrar");
  const podeCorrigir = pode(sessao.papel, "resultado.corrigir");

  const { id } = await params;
  const consulta = await searchParams;
  const busca = (consulta.busca ?? "").slice(0, 60).trim();
  // ?visual=anterior mantém a tela de preparação anterior (mesmos dados e ações).
  const visualAnterior = consulta.visual === "anterior";
  const painel = await lerPainel(id);
  if (!painel) notFound();
  const {
    corrida,
    responsavel,
    grid,
    classificacao,
    historico,
    detectados,
    correcoes,
    alertas,
    agoraMs,
    prazoMs,
    totalPassagens,
    corrigidaAposPublicar,
  } = painel;
  const [karts, modelo, caixa]: [Kart[], ModeloVinculo, unknown] =
    await Promise.all([listarKarts(), lerModeloDeVinculo(), caixaAberto()]);
  const porKart = modelo === "kart";
  const resultadosBusca = busca ? await buscarClientes(busca, 8) : [];

  const estado = ESTADO_CORRIDA[corrida.estado];
  const emPreparo =
    corrida.estado === "preparada" || corrida.estado === "pronta";
  // Karts que passaram pela antena e ainda não têm piloto (só antes de iniciar, no modelo do kart).
  const presentes =
    emPreparo && porKart && podeOperar ? await kartsNaPista(corrida.id) : [];
  const aoVivo =
    corrida.estado === "em_andamento" || corrida.estado === "encerrando";
  const terminada =
    corrida.estado === "finalizada" || corrida.estado === "cancelada";
  // Estado dos decoders só é lido para a tela ao vivo nova.
  const decoders = aoVivo && !visualAnterior ? await listarDecoders() : [];
  const editavel = emPreparo || aoVivo;
  const comSensor = grid.filter((p) => p.transponder).length;
  const semSensor = grid.filter((p) => !p.transponder).map((p) => p.nome);
  const kartsProntos = karts.filter(
    (k) => k.status === "ativo" && k.transponderFixo,
  ).length;
  const totalVoltas = classificacao.reduce((t, l) => t + l.voltas, 0);
  const melhor = classificacao
    .filter((l) => l.melhorVoltaMs !== null)
    .sort((a, b) => (a.melhorVoltaMs ?? 0) - (b.melhorVoltaMs ?? 0))[0];
  const rotulos = new Map(grid.map((p) => [p.transponder ?? "", p.rotulo]));
  const fim = corrida.encerradaEm ?? corrida.canceladaEm;
  const duracaoDecorridaMs = corrida.iniciadaEm
    ? (fim?.getTime() ?? agoraMs) - corrida.iniciadaEm.getTime()
    : 0;
  const pilotosComSensor = grid.filter((p) => p.transponder);
  const alertasVisiveis = alertas.slice(0, 4);

  // Nomes: karts que entraram sozinhos e a lista de pilotos ainda sem kart.
  const nomeacao =
    podeOperar && porKart && !corrida.canceladaEm
      ? {
          naoNomeados: new Set(grid.filter((p) => !p.nomeado).map((p) => p.id)),
          pendentes: grid
            .filter((p) => !p.transponder && p.nomeado)
            .map((p) => ({ id: p.id, nome: p.nome })),
        }
      : undefined;
  const semNome = grid.filter((p) => !p.nomeado).length;
  const pilotosDaLista = grid.filter((p) => !p.transponder);

  const blocoAdicionar =
    editavel && podeOperar ? (
      <Card>
        <CardHeader>
          <h3 className="text-ink text-sm font-semibold">
            {porKart ? "Pilotos desta bateria" : "Adicionar piloto"}
          </h3>
        </CardHeader>
        <CardBody>
          {porKart ? (
            <FormAcao
              action={adicionarPilotosAction}
              rotulo="Adicionar à lista"
            >
              <input type="hidden" name="corridaId" value={corrida.id} />
              <div className="flex flex-col gap-1">
                <label htmlFor="nomes" className="text-ink text-sm font-medium">
                  Nomes dos pilotos (um por linha)
                </label>
                <textarea
                  id="nomes"
                  name="nomes"
                  rows={5}
                  required
                  placeholder={"Ana Souza\nBeto Lima\nCarla Dias"}
                  className="border-border-strong bg-surface text-ink focus:border-orange w-full rounded-md border px-3 py-2 text-sm outline-none"
                />
              </div>
            </FormAcao>
          ) : (
            <FormAcao action={adicionarPilotoAction} rotulo="Adicionar">
              <input type="hidden" name="corridaId" value={corrida.id} />
              <Campo id="nome" rotulo="Nome do piloto" required minLength={2} />
            </FormAcao>
          )}
        </CardBody>
      </Card>
    ) : null;

  const colunasLista: Coluna<PilotoDaCorrida>[] = [
    {
      header: "Piloto",
      cell: (p) => <span className="font-medium">{p.nome}</span>,
    },
    ...(editavel && podeOperar
      ? [
          {
            header: "",
            cell: (p: PilotoDaCorrida) => (
              <FormAcao
                action={removerPilotoAction}
                rotulo="Remover"
                variante="ghost"
              >
                <input type="hidden" name="pilotoId" value={p.id} />
              </FormAcao>
            ),
          },
        ]
      : []),
  ];

  // Modelo "piloto": um cartão por piloto, com kart e sensor.
  const blocoGridPorPiloto =
    grid.length === 0 ? (
      <div className="border-border bg-surface text-ink-2 rounded-lg border px-5 py-8 text-center text-sm">
        Nenhum piloto ainda. Adicione abaixo.
      </div>
    ) : (
      <ul className="flex flex-col gap-3">
        {grid.map((p) => {
          const podeEditar = editavel && podeOperar;
          return (
            <li
              key={p.id}
              className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-ink text-base font-semibold">{p.nome}</p>
                {podeEditar ? (
                  <FormAcao
                    action={removerPilotoAction}
                    rotulo="Remover"
                    variante="ghost"
                  >
                    <input type="hidden" name="pilotoId" value={p.id} />
                  </FormAcao>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <p className="text-ink-3 text-xs tracking-wide uppercase">
                    Kart
                  </p>
                  {podeEditar ? (
                    <SelecaoDeKart piloto={p} karts={karts} />
                  ) : (
                    <p className="text-ink text-sm">{p.kartNumero ?? "—"}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-ink-3 text-xs tracking-wide uppercase">
                    Sensor
                  </p>
                  {podeEditar ? (
                    <ControlesDoSensor piloto={p} detectados={detectados} />
                  ) : p.transponder ? (
                    <p className="font-mono text-sm">
                      {nomeDoSensor(p.transponder, p.rotulo)}
                    </p>
                  ) : (
                    <p className="text-ink-3 text-sm">sem sensor</p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );

  const colunasDetectados: Coluna<SensorDetectado>[] = [
    {
      header: "Sensor",
      cell: (s) => (
        <div>
          <span className="font-mono">{s.transponder}</span>
          {!s.cadastrado ? (
            <StatusPill tone="orange" className="ml-2">
              desconhecido
            </StatusPill>
          ) : null}
        </div>
      ),
    },
    {
      header: "Nome (ex.: Kart 7)",
      cell: (s) =>
        podeOperar ? (
          <FormAcao
            action={rotularSensorAction}
            rotulo="Salvar"
            variante="secondary"
            limpar={false}
          >
            <input type="hidden" name="sensor" value={s.transponder} />
            <input
              name="rotulo"
              id={`rotulo-${s.transponder}`}
              aria-label={`Nome do sensor ${s.transponder}`}
              defaultValue={s.rotulo ?? ""}
              maxLength={40}
              className={CLASSE_CAMPO}
            />
          </FormAcao>
        ) : (
          (s.rotulo ?? "—")
        ),
    },
    { header: "Leituras", cell: (s) => s.leituras, numerica: true },
    {
      header: "Última leitura",
      cell: (s) => formatarHoraComMs(s.ultimaMs),
      numerica: true,
    },
  ];

  const colunasHistorico: Coluna<PassagemDoHistorico>[] = [
    {
      header: "Hora",
      cell: (h) => (
        <span>
          {formatarHoraComMs(h.instanteMs)}
          {h.origem === "manual" ? " (manual)" : ""}
        </span>
      ),
      numerica: true,
    },
    {
      header: "Piloto",
      cell: (h) => (
        <div>
          <p>{h.participante ?? "—"}</p>
          <p className="text-ink-3 font-mono text-xs">
            {h.transponder}
            {h.kartNumero ? ` · kart ${h.kartNumero}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Volta",
      cell: (h) =>
        h.tempoVoltaMs !== undefined
          ? `V${h.numeroVolta} · ${formatarTempoVolta(h.tempoVoltaMs)}`
          : "—",
      numerica: true,
    },
    {
      header: "Situação",
      cell: (h) => (
        <div>
          <StatusPill tone={STATUS_PASSAGEM[h.status].tom}>
            {STATUS_PASSAGEM[h.status].rotulo}
          </StatusPill>
          {!h.contada ? (
            <p className="text-ink-3 mt-1 max-w-xs text-xs">{h.motivo}</p>
          ) : null}
          <p className="text-ink-3 mt-1 text-xs">
            {h.origem === "manual" ? "correção manual" : h.decoderNome}
            {h.simulado ? " · SIMULADO" : ""}
          </p>
        </div>
      ),
    },
    ...(podeCorrigir
      ? [
          {
            header: "",
            cell: (h: PassagemDoHistorico) =>
              h.origem === "decoder" &&
              h.status !== "invalidada" &&
              corrida.estado !== "cancelada" ? (
                <details>
                  <summary className="text-ink-2 cursor-pointer text-sm">
                    Invalidar
                  </summary>
                  <FormAcao
                    action={invalidarPassagemAction}
                    confirmar="Invalidar esta passagem? O resultado será recalculado."
                    rotulo="Invalidar passagem"
                    variante="secondary"
                    className="mt-2 w-56"
                  >
                    <input type="hidden" name="corridaId" value={corrida.id} />
                    <input type="hidden" name="passagemId" value={h.id} />
                    <Campo id="motivo" rotulo="Motivo" required minLength={3} />
                  </FormAcao>
                </details>
              ) : null,
          },
        ]
      : []),
  ];

  const colunasCorrecoes: Coluna<CorrecaoDaCorrida>[] = [
    {
      header: "Correção",
      cell: (c) =>
        c.tipo === "invalidar"
          ? `Invalidou a passagem #${c.passagemId}`
          : `Inseriu passagem de ${c.transponder} às ${c.instanteMs !== undefined ? formatarHoraComMs(c.instanteMs) : "?"}`,
    },
    { header: "Motivo", cell: (c) => c.motivo },
    {
      header: "Situação",
      cell: (c) =>
        c.anulada ? (
          <div>
            <StatusPill tone="neutral">Anulada</StatusPill>
            <p className="text-ink-3 mt-1 text-xs">{c.motivoAnulacao}</p>
          </div>
        ) : (
          <StatusPill tone="orange">Em vigor</StatusPill>
        ),
    },
    ...(podeCorrigir
      ? [
          {
            header: "",
            cell: (c: CorrecaoDaCorrida) =>
              c.anulada ? null : (
                <details>
                  <summary className="text-ink-2 cursor-pointer text-sm">
                    Anular
                  </summary>
                  <FormAcao
                    action={anularCorrecaoAction}
                    rotulo="Anular correção"
                    variante="secondary"
                    className="mt-2 w-56"
                  >
                    <input type="hidden" name="correcaoId" value={c.id} />
                    <Campo id="motivo" rotulo="Motivo" required minLength={3} />
                  </FormAcao>
                </details>
              ),
          },
        ]
      : []),
  ];

  const blocoHistorico = corrida.iniciadaEm ? (
    <>
      <DataTable
        colunas={colunasHistorico}
        linhas={historico.slice(0, 300)}
        chave={(h) => h.id}
        vazio="Nenhuma passagem registrada no período."
      />
      <p className="text-ink-3 text-xs">
        Toda leitura do decoder fica registrada. As que não entram na contagem
        mostram o motivo; o registro original nunca é alterado.
      </p>
    </>
  ) : null;

  const blocoCorrecoes =
    corrida.iniciadaEm && (correcoes.length > 0 || podeCorrigir) ? (
      <>
        <DataTable
          colunas={colunasCorrecoes}
          linhas={correcoes}
          chave={(c) => c.id}
          vazio="Nenhuma correção."
        />
        {podeCorrigir &&
        corrida.estado !== "cancelada" &&
        pilotosComSensor.length > 0 ? (
          <Card>
            <CardHeader>
              <h3 className="text-ink text-sm font-semibold">
                Inserir passagem que o decoder não leu
              </h3>
            </CardHeader>
            <CardBody>
              <FormAcao
                action={inserirPassagemAction}
                rotulo="Inserir passagem manual"
                className="max-w-sm"
              >
                <input type="hidden" name="corridaId" value={corrida.id} />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="pilotoId"
                    className="text-ink text-sm font-medium"
                  >
                    Piloto
                  </label>
                  <select
                    id="pilotoId"
                    name="pilotoId"
                    required
                    defaultValue=""
                    className={CLASSE_CAMPO}
                  >
                    <option value="" disabled>
                      Escolha…
                    </option>
                    {pilotosComSensor.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <Campo
                  id="hora"
                  rotulo="Horário da passagem"
                  placeholder="15:42:07.350"
                  required
                  dica="Horário de Brasília, HH:MM:SS ou HH:MM:SS.mmm."
                />
                <Campo id="motivo" rotulo="Motivo" required minLength={3} />
              </FormAcao>
            </CardBody>
          </Card>
        ) : null}
      </>
    ) : null;

  const tituloClassificacao =
    corrida.estado === "finalizada"
      ? "Resultado final"
      : corrida.estado === "cancelada"
        ? "Parcial no cancelamento (sem validade oficial)"
        : "Classificação ao vivo";

  // Preparação no modelo "do kart": nova composição (pit wall). A anterior continua em
  // ?visual=anterior, com os mesmos dados e ações.
  const novaTela = emPreparo && porKart && !visualAnterior;
  // Bateria em andamento: cronometragem ao vivo (pit wall), com os mesmos comandos de
  // sempre na barra de controles. ?visual=anterior mantém a tela anterior.
  const pistaNova = aoVivo && !visualAnterior;
  const acoesDaBateria = (
    <AcoesDaBateria
      corridaId={corrida.id}
      estado={corrida.estado}
      porKart={porKart}
      podeOperar={podeOperar}
      podeIniciar={podeIniciar}
      semSensor={semSensor}
      totalPilotos={grid.length}
      kartsProntos={kartsProntos}
      fase={corrida.fase}
      duracaoMin={corrida.duracaoMin}
      duracaoCorridaMin={corrida.duracaoCorridaMin}
      barraNoCelular={novaTela || pistaNova}
    />
  );

  return (
    <div
      className={`flex flex-col gap-6 ${(novaTela || pistaNova) && (podeOperar || podeIniciar) ? "max-md:pb-[calc(10rem+var(--nav-inferior))]" : ""}`}
    >
      {editavel && !pistaNova ? (
        <AtualizacaoPeriodica intervaloMs={2000} />
      ) : null}
      <PageHeader
        title={corrida.nome}
        description={
          corrida.iniciadaEm
            ? `Iniciada às ${formatarHora(corrida.iniciadaEm)}${fim ? ` · ${corrida.estado === "cancelada" ? "cancelada" : "finalizada"} às ${formatarHora(fim)}` : ""}.`
            : porKart
              ? "Cadastre os pilotos, colete os termos, sorteie os karts e inicie."
              : "Escolha os sensores dos pilotos, confirme o grid e inicie."
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone={estado.tom}>{estado.rotulo}</StatusPill>
            {corrida.fase === "classificacao" ? (
              <Link
                href={`/admin/cronometragem/corridas/${corrida.id}/grid`}
                className="text-orange-ink text-sm font-medium hover:underline"
              >
                Prévia do grid
              </Link>
            ) : null}
            <Link
              href={`/admin/cronometragem/corridas/${corrida.id}/painel`}
              className="text-orange-ink text-sm font-medium hover:underline"
            >
              Painel de cronometragem
            </Link>
            <Link
              href="/admin/cronometragem/corridas"
              className="text-ink-2 text-sm hover:underline"
            >
              ← Baterias
            </Link>
          </div>
        }
      />

      {painel.fases ? (
        <BarraDeFases
          fases={painel.fases}
          atual={corrida.fase}
          podeOperar={podeOperar}
          classificacaoId={
            corrida.fase === "classificacao" ? corrida.id : undefined
          }
          classificacaoFinalizada={
            corrida.fase === "classificacao" && corrida.estado === "finalizada"
          }
        />
      ) : null}

      {novaTela || pistaNova ? null : (
        <PassoAPasso estado={corrida.estado} porKart={porKart} />
      )}

      {podeOperar &&
      corrida.estado === "finalizada" &&
      corrida.fase !== "classificacao" ? (
        <div className="bg-graphite! border-graphite! flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="text-base font-semibold text-white">
              Bateria finalizada
            </p>
            <p className="text-sm text-white/70">
              A próxima começa do mesmo jeito: os karts passam, você define os
              pilotos e inicia a tomada de tempo. Decoder e sensores continuam
              os mesmos.
            </p>
          </div>
          <FormAcao
            action={novaBateriaAction}
            rotulo="Próxima bateria"
            className="w-full max-w-xs"
          >
            <input
              type="hidden"
              name="duasFases"
              value={corrida.fase === "unica" ? "0" : "1"}
            />
          </FormAcao>
        </div>
      ) : null}

      {emPreparo && porKart && podeOperar ? (
        <KartsNaPista
          corridaId={corrida.id}
          presentes={presentes.map((k) => ({
            kartId: k.kartId,
            numero: k.numero,
            passouAs: formatarHoraComMs(k.primeiraMs).slice(0, 8),
          }))}
          comPiloto={grid.filter((p) => p.kartNumero).length}
        />
      ) : null}

      {novaTela ? (
        <PreparacaoDaBateria
          nome={corrida.nome}
          fase={corrida.fase}
          grid={grid}
          karts={karts}
          acoes={acoesDaBateria}
        />
      ) : pistaNova ? (
        <PistaAoVivo
          painel={painel}
          decoders={decoders}
          controles={acoesDaBateria}
        />
      ) : (
        acoesDaBateria
      )}

      {emPreparo ? (
        <>
          {novaTela ? null : <PendenciasDaPista grid={grid} />}
          <ResumoDosTermos grid={grid} />
        </>
      ) : null}

      {podeCorrigir && (aoVivo || corrida.estado === "finalizada") ? (
        <OcorrenciasDaBateria grid={grid} />
      ) : null}

      {!pistaNova && alertasVisiveis.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {alertasVisiveis.map((a, i) => (
            <li
              key={i}
              role={a.nivel === "erro" ? "alert" : undefined}
              className={
                a.nivel === "erro"
                  ? "text-sm font-medium text-red-700"
                  : "text-ink text-sm"
              }
            >
              {a.nivel === "erro" ? "⚠ " : "• "}
              {a.texto}
            </li>
          ))}
        </ul>
      ) : null}

      {corrida.estado === "cancelada" && corrida.motivoCancelamento ? (
        <p className="text-ink text-sm">
          Motivo do cancelamento: {corrida.motivoCancelamento}
        </p>
      ) : null}

      {emPreparo && porKart ? (
        <>
          {novaTela ? null : (
            <Card>
              <CardBody>
                <ol className="text-ink-2 list-decimal space-y-1 pl-5 text-sm">
                  <li>
                    Cadastre todos os pilotos (os da reserva já estão aqui) e
                    envie o termo: cada um assina pelo link ou QR.
                  </li>
                  <li>
                    Sorteie os karts: cada piloto recebe um kart e, com ele, o
                    sensor que já está nele ({kartsProntos} kart(s) com sensor
                    em{" "}
                    <Link
                      href="/admin/cronometragem/pista"
                      className="text-orange-ink font-medium hover:underline"
                    >
                      Pista → Sensores e karts
                    </Link>
                    ).
                  </li>
                  <li>
                    Com o piloto <b>apto</b> (termo assinado e kart definido),
                    ele vai ao kart. Inicie a bateria: os sensores passam a ser
                    lidos a partir da largada.
                  </li>
                </ol>
              </CardBody>
            </Card>
          )}
          <div id="pilotos-da-bateria" className="scroll-mt-4">
            <Recolhivel
              titulo="Responsável e pilotos desta bateria"
              resumo={`${grid.filter((p) => p.termo === "valido").length} de ${grid.length} termos assinados`}
              aberta
            >
              <p className="text-ink-2 text-sm">
                Cada bateria tem pilotos novos. Cadastre o responsável e todos
                os pilotos: cada um recebe o termo de responsabilidade por link
                ou QR para assinar no celular. Os karts e os sensores são sempre
                os mesmos: o sorteio liga cada piloto a um kart (e ao sensor
                dele).
              </p>
              <PilotosDaBateria
                corridaId={corrida.id}
                grid={grid}
                responsavel={responsavel}
                busca={busca}
                resultados={resultadosBusca}
                podeEditar={podeOperar && editavel}
                avulsa={!corrida.slotId}
                caixaEstaAberto={caixa !== null}
                podeReceber={pode(sessao.papel, "caixa.operar")}
                podeSortear={podeOperar && corrida.fase !== "corrida"}
              />
            </Recolhivel>
          </div>
        </>
      ) : null}

      {emPreparo && !porKart ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Pilotos com sensor"
              value={`${comSensor} de ${grid.length}`}
            />
            <StatCard
              label="Duração prevista"
              value={corrida.duracaoMin ? `${corrida.duracaoMin} min` : "—"}
            />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-ink text-base font-semibold">
              Pilotos e sensores
            </h2>
            <p className="text-ink-2 text-sm">
              Para ligar um sensor ao piloto, clique em “Capturar próximo
              sensor” e passe o kart pelo decoder — ou escolha na lista.
            </p>
            {blocoGridPorPiloto}
          </div>
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col gap-2">
              <h3 className="text-ink text-sm font-semibold">
                Sensores lidos que ainda não têm piloto
              </h3>
              <DataTable
                colunas={colunasDetectados}
                linhas={detectados}
                chave={(s) => s.transponder}
                vazio="Nenhum sensor novo lido. Passe um kart pelo sensor do decoder."
              />
            </div>
            {blocoAdicionar}
          </div>
        </>
      ) : null}

      {!emPreparo ? (
        <>
          {pistaNova ? null : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard
                label={
                  corrida.estado === "em_andamento" && prazoMs !== null
                    ? "Tempo restante"
                    : "Tempo da bateria"
                }
                value={
                  corrida.estado === "em_andamento" && corrida.iniciadaEm ? (
                    prazoMs !== null ? (
                      <Contador
                        modo="regressivo"
                        referenciaMs={prazoMs}
                        agoraServidorMs={agoraMs}
                      />
                    ) : (
                      <Contador
                        modo="progressivo"
                        referenciaMs={corrida.iniciadaEm.getTime()}
                        agoraServidorMs={agoraMs}
                      />
                    )
                  ) : corrida.iniciadaEm ? (
                    formatarDuracao(duracaoDecorridaMs)
                  ) : (
                    "—"
                  )
                }
                hint={
                  corrida.duracaoMin
                    ? `Prevista: ${corrida.duracaoMin} min (relógio do servidor)`
                    : undefined
                }
              />
              <StatCard
                label="Voltas contadas"
                value={totalVoltas}
                hint={`${totalPassagens} leitura(s) no período`}
              />
              <StatCard
                label="Melhor volta"
                value={
                  melhor?.melhorVoltaMs
                    ? formatarTempoVolta(melhor.melhorVoltaMs)
                    : "—"
                }
                hint={melhor?.nome}
              />
            </div>
          )}

          {terminada && corrida.iniciadaEm ? (
            <Card>
              <CardHeader>
                <h2 className="text-ink text-base font-semibold">
                  Relatórios da bateria
                </h2>
                <p className="text-ink-2 mt-1 text-sm">
                  {corrida.estado === "finalizada"
                    ? "A bateria terminou. Abra, imprima ou baixe em PDF."
                    : "Bateria cancelada: os relatórios saem marcados como parciais."}
                </p>
              </CardHeader>
              <CardBody>
                {semNome > 0 ? (
                  <p className="mb-2 text-sm font-medium text-red-700">
                    {semNome} kart(s) ainda sem o nome do piloto — dê os nomes
                    antes de imprimir.
                  </p>
                ) : null}
                <ul className="divide-border divide-y">
                  <LinhaDeRelatorio
                    corridaId={corrida.id}
                    tipo="completo"
                    titulo="Relatório completo"
                    descricao="Qualificação, volta a volta e resultado final no mesmo PDF."
                  />
                  <LinhaDeRelatorio
                    corridaId={corrida.id}
                    tipo="qualy"
                    titulo="Qualificação (qualy)"
                    descricao="Ordem pela melhor volta de cada piloto."
                  />
                  <LinhaDeRelatorio
                    corridaId={corrida.id}
                    tipo="voltas"
                    titulo="Volta a volta"
                    descricao="Todos os tempos de cada volta, por piloto."
                  />
                  <LinhaDeRelatorio
                    corridaId={corrida.id}
                    tipo="resultado"
                    titulo="Resultado final"
                    descricao="Classificação por voltas e ordem de chegada."
                  />
                </ul>
                {podeOperar && corrida.fase !== "classificacao" ? (
                  <div className="border-border mt-4 border-t pt-4">
                    <FormAcao
                      action={novaBateriaAction}
                      rotulo="Nova bateria"
                      className="max-w-xs"
                    >
                      <input
                        type="hidden"
                        name="duasFases"
                        value={corrida.fase === "unica" ? "0" : "1"}
                      />
                      <p className="text-ink-2 text-sm">
                        Abre uma bateria nova com as mesmas regras. Os karts e
                        os sensores continuam os mesmos; você cadastra os
                        pilotos da nova bateria.
                      </p>
                    </FormAcao>
                  </div>
                ) : null}
                <details className="mt-4">
                  <summary className="text-ink-2 cursor-pointer text-sm">
                    Ver o PDF completo nesta tela
                  </summary>
                  <iframe
                    title="Relatório completo da bateria"
                    src={`/api/cronometragem/corridas/${corrida.id}/relatorio?tipo=completo`}
                    className="border-border mt-3 h-[70vh] w-full rounded-md border"
                  />
                </details>
              </CardBody>
            </Card>
          ) : null}

          {corrida.iniciadaEm ? (
            pistaNova ? (
              <div id="classificacao-detalhada" className="scroll-mt-4">
                <Recolhivel
                  titulo="Classificação detalhada (nomes e detalhes por piloto)"
                  aberta={semNome > 0 && porKart && podeOperar}
                >
                  <div className="flex flex-col gap-3">
                    <h2 className="text-ink text-base font-semibold">
                      {tituloClassificacao}
                    </h2>
                    {aoVivo && semNome > 0 && porKart && podeOperar ? (
                      <p className="text-ink text-sm">
                        {semNome} kart(s) sem o nome do piloto: use “Dar nome”
                        na linha do kart.
                      </p>
                    ) : null}
                    <TabelaClassificacao
                      linhas={classificacao}
                      rotulosDosSensores={rotulos}
                      mostrarSensor={podeOperar}
                      nomeacao={nomeacao}
                    />
                    {corrigidaAposPublicar ? (
                      <p className="text-sm font-medium text-red-700">
                        Esta classificação foi alterada por correção
                        administrativa depois da publicação do resultado. O
                        resultado publicado fica guardado e as correções estão
                        listadas abaixo.
                      </p>
                    ) : null}
                    <p className="text-ink-3 text-xs">
                      {REGRA_LARGADA[corrida.regraLargada]} · tempo mínimo entre
                      leituras {corrida.tempoMinimoMs / 1000} s ·{" "}
                      {MODO_ENCERRAMENTO[corrida.modoEncerramento]}
                    </p>
                  </div>
                </Recolhivel>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <h2 className="text-ink text-base font-semibold">
                  {tituloClassificacao}
                </h2>
                {aoVivo && semNome > 0 && porKart && podeOperar ? (
                  <p className="text-ink text-sm">
                    {semNome} kart(s) sem o nome do piloto: use “Dar nome” na
                    linha do kart.
                  </p>
                ) : null}
                <TabelaClassificacao
                  linhas={classificacao}
                  rotulosDosSensores={rotulos}
                  mostrarSensor={podeOperar}
                  nomeacao={nomeacao}
                />
                {corrigidaAposPublicar ? (
                  <p className="text-sm font-medium text-red-700">
                    Esta classificação foi alterada por correção administrativa
                    depois da publicação do resultado. O resultado publicado
                    fica guardado e as correções estão listadas abaixo.
                  </p>
                ) : null}
                <p className="text-ink-3 text-xs">
                  {REGRA_LARGADA[corrida.regraLargada]} · tempo mínimo entre
                  leituras {corrida.tempoMinimoMs / 1000} s ·{" "}
                  {MODO_ENCERRAMENTO[corrida.modoEncerramento]}
                </p>
              </div>
            )
          ) : null}

          {corrida.iniciadaEm ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-ink text-base font-semibold">
                Volta a volta
              </h2>
              <TabelaVoltaAVolta linhas={classificacao} />
            </div>
          ) : null}

          {terminada && corrida.iniciadaEm ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-ink text-base font-semibold">
                Qualificação (melhor volta)
              </h2>
              <TabelaQualificacao
                linhas={classificacao}
                criterio={criterioDaSessao(corrida, lerConfigDeClassificacao())}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {aoVivo ? (
              porKart ? (
                <Recolhivel
                  titulo="Lista de pilotos"
                  resumo={`${pilotosDaLista.length} sem kart`}
                >
                  {pilotosDaLista.length > 0 ? (
                    <DataTable
                      colunas={colunasLista}
                      linhas={pilotosDaLista}
                      chave={(p) => p.id}
                    />
                  ) : (
                    <p className="text-ink-2 text-sm">
                      Nenhum piloto na lista. Adicione nomes para escolher na
                      hora de dar o nome ao kart.
                    </p>
                  )}
                  {blocoAdicionar}
                </Recolhivel>
              ) : (
                <Recolhivel
                  titulo="Pilotos e sensores"
                  resumo={`${comSensor} de ${grid.length} com sensor`}
                >
                  {blocoGridPorPiloto}
                  {blocoAdicionar}
                </Recolhivel>
              )
            ) : null}
            {blocoHistorico ? (
              <Recolhivel
                titulo="Histórico de passagens"
                resumo={`${historico.length} leitura(s)`}
              >
                {blocoHistorico}
              </Recolhivel>
            ) : null}
            {blocoCorrecoes ? (
              <Recolhivel
                titulo="Correções administrativas"
                resumo={
                  correcoes.length > 0
                    ? `${correcoes.length} correção(ões)`
                    : undefined
                }
              >
                {blocoCorrecoes}
              </Recolhivel>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
