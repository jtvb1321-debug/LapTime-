import type { Metadata } from "next";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { BuscarDecoder } from "@/components/cronometragem/buscar-decoder";
import { ComputadorDaPistaSecao } from "@/components/cronometragem/computador-da-pista";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Alerta } from "@/components/ui/alerta";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import { listarComputadores } from "@/lib/cronometragem/computadores-store";
import {
  eventosDeConexao,
  listarDecoders,
  ultimasPassagens,
  type Decoder,
} from "@/lib/cronometragem/decoders-store";
import { formatarHoraComMs } from "@/lib/cronometragem/voltas";
import { agoraMs } from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";
import { urlPublica } from "@/lib/url-publica";

export const metadata: Metadata = { title: "Decoder" };
export const dynamic = "force-dynamic";

const ROTULO_EVENTO = {
  coletor_iniciado: "Agente iniciado",
  conectado: "Decoder conectado",
  desconectado: "Decoder desconectado",
  erro: "Erro",
} as const;

function haQuanto(data: Date | null, agora: number): string {
  if (!data) return "nunca";
  const s = Math.max(0, Math.round((agora - data.getTime()) / 1000));
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

function dataCurta(data: Date): string {
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// O decoder real conectado primeiro; o simulador só se for o que há.
function escolherDecoder(decoders: Decoder[]): Decoder | null {
  const ativos = decoders.filter((d) => d.ativo);
  return (
    ativos.find((d) => !d.simulado && d.estadoConexao === "conectado") ??
    ativos.find((d) => !d.simulado) ??
    ativos.find((d) => d.estadoConexao === "conectado") ??
    null
  );
}

function Etapa({
  numero,
  titulo,
  situacao,
  ok,
}: {
  numero: number;
  titulo: string;
  situacao: string;
  ok: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          ok ? "bg-orange text-on-orange" : "bg-ink/10 text-ink-2"
        }`}
      >
        {ok ? "✓" : numero}
      </span>
      <div className="min-w-0">
        <p className="text-ink text-sm font-medium">{titulo}</p>
        <p className="text-ink-2 text-sm">{situacao}</p>
      </div>
    </li>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-3 text-xs">{rotulo}</dt>
      <dd className="text-ink text-sm font-medium break-words tabular-nums">
        {valor}
      </dd>
    </div>
  );
}

const ROTULO_INFO: Record<string, string> = {
  ruido: "Ruído da antena",
};

export default async function DecoderConfigPage() {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeAdministrar = pode(sessao.papel, "equipamento.administrar");

  const [decoders, computadores, eventos, passagens, url] = await Promise.all([
    listarDecoders(),
    listarComputadores(),
    eventosDeConexao(20),
    ultimasPassagens(12),
    urlPublica(),
  ]);
  const agora = agoraMs();
  const decoder = escolherDecoder(decoders);
  const conectado = decoder?.estadoConexao === "conectado";
  const agenteOnline = computadores.some((c) => c.online);
  const lendo =
    conectado &&
    decoder?.ultimoSinal != null &&
    agora - decoder.ultimoSinal.getTime() < 30_000;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <AtualizacaoPeriodica intervaloMs={4000} />
      <PageHeader
        title="Decoder"
        description="Situação do decoder, do computador da pista e das passagens dos sensores, em tempo real. Para ligar outro computador, baixe o instalador abaixo."
      />

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-ink text-base font-semibold">
            {decoder ? decoder.nome : "Decoder"}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {conectado ? (
              <StatusPill tone="ink">Conectado</StatusPill>
            ) : (
              <StatusPill tone="orange">
                {agenteOnline ? "Procurando o decoder" : "Sem agente"}
              </StatusPill>
            )}
            <BuscarDecoder rotulo="Atualizar agora" />
          </div>
        </CardHeader>
        <CardBody className="flex flex-col gap-5">
          {decoder?.simulado ? (
            <Alerta nivel="atencao" titulo="Decoder simulado">
              Este não é o equipamento real: são passagens de demonstração.
            </Alerta>
          ) : null}

          <ol className="flex flex-col gap-3">
            <Etapa
              numero={1}
              titulo="Computador da pista ligado ao sistema"
              ok={agenteOnline}
              situacao={
                computadores.length === 0
                  ? "Nenhum computador ligado ainda. Baixe o instalador abaixo e rode no computador do decoder."
                  : agenteOnline
                    ? `${computadores.filter((c) => c.online).length} computador(es) com o agente ativo.`
                    : "O agente não responde. Ligue o computador do decoder (o agente abre sozinho com o Windows)."
              }
            />
            <Etapa
              numero={2}
              titulo="Decoder encontrado na rede"
              ok={conectado}
              situacao={
                conectado
                  ? `${decoder?.nome}${decoder?.endereco ? ` em ${decoder.endereco}` : ""}.`
                  : agenteOnline
                    ? "O agente está procurando. Confira a energia do decoder e o cabo de rede no computador."
                    : "Depende do passo 1."
              }
            />
            <Etapa
              numero={3}
              titulo="Lendo as passagens dos sensores"
              ok={lendo}
              situacao={
                lendo
                  ? `Sinal ${haQuanto(decoder?.ultimoSinal ?? null, agora)}; última passagem ${haQuanto(decoder?.ultimaPassagem ?? null, agora)}.`
                  : "Começa assim que o decoder for encontrado."
              }
            />
          </ol>

          {decoder ? (
            <dl className="border-border grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-4">
              <Dado rotulo="Endereço" valor={decoder.endereco ?? "—"} />
              <Dado rotulo="Driver" valor={decoder.driver} />
              <Dado
                rotulo="Conectado desde"
                valor={
                  decoder.conectadoDesde
                    ? dataCurta(decoder.conectadoDesde)
                    : "—"
                }
              />
              <Dado
                rotulo="Último sinal"
                valor={haQuanto(decoder.ultimoSinal, agora)}
              />
              <Dado
                rotulo="Última passagem"
                valor={haQuanto(decoder.ultimaPassagem, agora)}
              />
              <Dado
                rotulo="Passagens em 24 h"
                valor={String(decoder.passagens24h)}
              />
              {Object.entries(decoder.info ?? {}).map(([chave, valor]) => (
                <Dado
                  key={chave}
                  rotulo={ROTULO_INFO[chave] ?? chave}
                  valor={String(valor)}
                />
              ))}
              {decoder.ultimoErro ? (
                <Dado
                  rotulo="Último aviso"
                  valor={`${decoder.ultimoErro}${decoder.ultimoErroEm ? ` (${haQuanto(decoder.ultimoErroEm, agora)})` : ""}`}
                />
              ) : null}
            </dl>
          ) : null}
        </CardBody>
      </Card>

      {podeAdministrar ? (
        <Card>
          <CardHeader>
            <h2 className="text-ink text-base font-semibold">
              Ligar outro computador (instalador)
            </h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <ol className="text-ink-2 list-decimal space-y-1 pl-5 text-sm">
              <li>Baixe o instalador aqui e leve ao computador do decoder.</li>
              <li>
                Extraia o <code>.zip</code> e dê duplo clique em{" "}
                <code>Instalar.cmd</code>. Ele instala o que faltar, liga o
                computador a <code className="break-all">{url}</code> e abre o
                agente sozinho no Windows.
              </li>
              <li>
                Conecte e ligue o decoder: ele aparece aqui em poucos segundos.
              </li>
            </ol>
            <form
              method="post"
              action="/api/cronometragem/coletor/instalador"
              className="flex flex-wrap items-center gap-3"
            >
              <button
                type="submit"
                className="bg-orange text-on-orange min-h-11 rounded-md px-5 text-sm font-semibold"
              >
                Baixar instalador do agente
              </button>
              <span className="text-ink-3 text-xs">
                Cada download gera um código novo (vale 15 minutos, uso único).
                Só precisa ser rodado uma vez em cada computador.
              </span>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <ComputadorDaPistaSecao
        computadores={computadores}
        podeAdministrar={podeAdministrar}
        urlDoSistema={url}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-ink text-base font-semibold">
              Histórico de conexão
            </h2>
          </CardHeader>
          <CardBody>
            {eventos.length === 0 ? (
              <p className="text-ink-2 text-sm">Nenhum evento ainda.</p>
            ) : (
              <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {eventos.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
                  >
                    <span className="text-ink">
                      {ROTULO_EVENTO[e.tipo]}
                      {e.detalhe ? (
                        <span className="text-ink-3"> · {e.detalhe}</span>
                      ) : null}
                    </span>
                    <span className="text-ink-3 text-xs tabular-nums">
                      {dataCurta(e.ocorridoEm)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-ink text-base font-semibold">
              Últimas passagens
            </h2>
          </CardHeader>
          <CardBody>
            {passagens.length === 0 ? (
              <p className="text-ink-2 text-sm">
                Nenhuma passagem registrada ainda.
              </p>
            ) : (
              <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {passagens.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
                  >
                    <span className="text-ink font-mono">
                      {p.rotulo ?? p.transponder}
                      {p.simulado ? (
                        <span className="text-ink-3"> · simulado</span>
                      ) : null}
                    </span>
                    <span className="text-ink-3 text-xs tabular-nums">
                      {formatarHoraComMs(p.instanteMs)}
                      {p.forca !== null ? ` · força ${p.forca}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
