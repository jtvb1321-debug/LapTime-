import type { Metadata } from "next";
import Link from "next/link";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { BuscarDecoder } from "@/components/cronometragem/buscar-decoder";
import { ComputadorDaPistaSecao } from "@/components/cronometragem/computador-da-pista";
import { VincularSensores } from "@/components/cronometragem/vincular-sensores";
import { FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Alerta } from "@/components/ui/alerta";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import { removerSensorDoKartAction } from "@/lib/cadastros-cronometragem-actions";
import { novaBateriaAction } from "@/lib/corrida-actions";
import {
  listarKarts,
  sensoresSemKart,
} from "@/lib/cronometragem/cadastros-store";
import { listarComputadores } from "@/lib/cronometragem/computadores-store";
import {
  corridaAtiva,
  listarCorridas,
} from "@/lib/cronometragem/corridas-store";
import {
  listarDecoders,
  ultimasPassagens,
  type Decoder,
} from "@/lib/cronometragem/decoders-store";
import { ESTADO_CORRIDA } from "@/lib/cronometragem/rotulos";
import { formatarHoraComMs } from "@/lib/cronometragem/voltas";
import { agoraMs } from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";
import { urlPublica } from "@/lib/url-publica";

export const metadata: Metadata = { title: "Pista" };
export const dynamic = "force-dynamic";

function haQuanto(data: Date | null, agora: number): string {
  if (!data) return "nunca";
  const s = Math.max(0, Math.round((agora - data.getTime()) / 1000));
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  return `há ${Math.floor(s / 3600)} h`;
}

function Passo({
  numero,
  titulo,
  resumo,
  children,
}: {
  numero: number;
  titulo: string;
  resumo?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-ink flex items-center gap-3 text-base font-semibold">
          <span className="bg-graphite font-display flex size-8 shrink-0 items-center justify-center rounded-full text-base font-bold text-white">
            {numero}
          </span>
          {titulo}
        </h2>
        {resumo}
      </CardHeader>
      <CardBody className="flex flex-col gap-4">{children}</CardBody>
    </Card>
  );
}

// O decoder que interessa à pista: o real conectado primeiro; simulador só se for o que há.
function escolherDecoder(decoders: Decoder[]): Decoder | null {
  const ativos = decoders.filter((d) => d.ativo);
  return (
    ativos.find((d) => !d.simulado && d.estadoConexao === "conectado") ??
    ativos.find((d) => !d.simulado) ??
    ativos.find((d) => d.estadoConexao === "conectado") ??
    null
  );
}

export default async function PistaPage() {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeAdministrar = pode(sessao.papel, "equipamento.administrar");
  const podeOperar = pode(sessao.papel, "sessao.operar");
  const [
    decoders,
    computadores,
    karts,
    livres,
    passagens,
    ativa,
    recentes,
    url,
  ] = await Promise.all([
    listarDecoders(),
    listarComputadores(),
    listarKarts(),
    sensoresSemKart(60),
    ultimasPassagens(12),
    corridaAtiva(),
    listarCorridas(5),
    urlPublica(),
  ]);
  // Sensor em uso -> número do kart (para o painel de passagens).
  const kartDoSensor = new Map<string, string>();
  for (const k of karts) {
    for (const sensor of k.sensores) {
      if (sensor.ativo) kartDoSensor.set(sensor.codigo, k.numero);
    }
  }
  const agora = agoraMs();
  const decoder = escolherDecoder(decoders);
  const conectado = decoder?.estadoConexao === "conectado";
  const computadorOnline = computadores.some((c) => c.online);
  const comSensor = karts
    .filter((k) => k.transponderFixo)
    .sort((a, b) =>
      a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }),
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pista"
        description="Do decoder à bateria, na ordem: achar o decoder, ligar os sensores aos karts e abrir a bateria."
      />

      <Passo
        numero={1}
        titulo="Decoder"
        resumo={
          <BuscarDecoder
            rotulo={conectado ? "Buscar de novo" : "Buscar decoder"}
          />
        }
      >
        {decoder && conectado ? (
          <Alerta nivel="sucesso" titulo="Decoder encontrado">
            {decoder.nome}
            {decoder.endereco ? ` em ${decoder.endereco}` : ""} · último sinal{" "}
            {haQuanto(decoder.ultimoSinal, agora)}
            {decoder.info?.ruido !== undefined
              ? ` · ruído da antena ${decoder.info.ruido}`
              : ""}
            {decoder.simulado ? " · SIMULADO (não é o decoder real)" : ""}
          </Alerta>
        ) : computadores.length === 0 ? (
          <Alerta
            nivel="atencao"
            titulo="Nenhum computador da pista ligado ao sistema"
          >
            O decoder fica plugado no computador da pista, e é o agente desse
            computador que o encontra. Ligue o computador ao sistema uma vez,
            abaixo.
          </Alerta>
        ) : !computadorOnline ? (
          <Alerta
            nivel="atencao"
            titulo="O agente do computador da pista não está respondendo"
          >
            Abra o agente do Grid Lap no computador onde o decoder está plugado.
            Ele procura o decoder sozinho assim que inicia.
          </Alerta>
        ) : (
          <Alerta nivel="atencao" titulo="Decoder não encontrado">
            O agente está ativo e procurando. Confira se o decoder está ligado
            na tomada e se o cabo dele está no adaptador USB do computador da
            pista.
            {decoder?.ultimoErro ? ` Último aviso: ${decoder.ultimoErro}.` : ""}
          </Alerta>
        )}
        <details open={computadores.length === 0}>
          <summary className="text-orange-ink min-h-11 cursor-pointer py-2 text-sm font-medium">
            Computador da pista ({computadores.length} ligado
            {computadores.length === 1 ? "" : "s"})
          </summary>
          <div className="mt-2">
            <ComputadorDaPistaSecao
              computadores={computadores}
              podeAdministrar={podeAdministrar}
              urlDoSistema={url}
            />
          </div>
        </details>
      </Passo>

      <Passo
        numero={2}
        titulo="Sensores e karts"
        resumo={
          <p className="text-ink-2 text-sm">
            <span className="font-display text-ink text-lg font-semibold">
              {comSensor.length}
            </span>{" "}
            kart(s) com sensor
          </p>
        }
      >
        {podeAdministrar ? (
          <VincularSensores
            sensores={livres.map((s) => ({
              codigo: s.codigo,
              ultimaLeituraMs: s.ultimaLeituraMs,
              lidoEm:
                s.ultimaLeituraMs !== null
                  ? formatarHoraComMs(s.ultimaLeituraMs).slice(0, 8)
                  : "—",
              leituras: s.leituras,
            }))}
            karts={karts.map((k) => ({
              id: k.id,
              numero: k.numero,
              sensor: k.transponderFixo,
            }))}
            agoraMs={agora}
          />
        ) : (
          <p className="text-ink-2 text-sm">
            Só quem administra os equipamentos liga sensores aos karts.
          </p>
        )}
        {comSensor.length > 0 ? (
          <ul
            aria-label="Karts com sensor"
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
          >
            {comSensor.map((k) => (
              <li
                key={k.id}
                className="border-border bg-success-bg text-success flex min-h-14 flex-col items-center justify-center rounded-md border px-2 py-1"
              >
                <span className="font-display text-xl font-semibold">
                  {k.numero}
                </span>
                <span className="max-w-full truncate text-xs">
                  {k.transponderFixo}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {podeAdministrar && comSensor.length > 0 ? (
          <details>
            <summary className="text-orange-ink min-h-11 cursor-pointer py-2 text-sm font-medium">
              Tirar o sensor de um kart (sensor com defeito ou trocado)
            </summary>
            <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {comSensor.map((k) => (
                <li key={k.id} className="border-border rounded-lg border p-3">
                  <p className="text-ink mb-2 text-sm font-medium">
                    Kart {k.numero} · sensor{" "}
                    <span className="font-display">{k.transponderFixo}</span>
                  </p>
                  <FormAcao
                    action={removerSensorDoKartAction}
                    rotulo="Tirar sensor"
                    variante="secondary"
                    confirmar={`Tirar o sensor ${k.transponderFixo} do kart ${k.numero}? Ele volta para a lista de sensores sem kart.`}
                  >
                    <input type="hidden" name="kartId" value={k.id} />
                    <input
                      type="hidden"
                      name="sensor"
                      value={k.transponderFixo}
                    />
                    <label
                      htmlFor={`motivo-${k.id}`}
                      className="text-ink text-sm font-medium"
                    >
                      Motivo
                    </label>
                    <input
                      id={`motivo-${k.id}`}
                      name="motivo"
                      required
                      minLength={3}
                      maxLength={120}
                      className="campo w-full"
                    />
                  </FormAcao>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Passo>

      <Passo numero={3} titulo="Bateria">
        {ativa ? (
          <Alerta nivel="info" titulo={`Em andamento: ${ativa.nome}`}>
            Há uma bateria rodando agora.
          </Alerta>
        ) : (
          <p className="text-ink-2 text-sm">
            Ao abrir, os karts que passarem pela antena aparecem na bateria;
            você define o piloto de cada um e inicia a tomada de tempo.
          </p>
        )}
        <div className="flex flex-wrap items-start gap-3">
          {ativa ? (
            <ButtonLink href={`/admin/cronometragem/corridas/${ativa.id}`}>
              Abrir a bateria em andamento
            </ButtonLink>
          ) : podeOperar ? (
            <FormAcao
              action={novaBateriaAction}
              rotulo="Abrir bateria"
              className="w-full max-w-xs"
            >
              <input type="hidden" name="duasFases" value="1" />
            </FormAcao>
          ) : null}
        </div>
        {recentes.length > 0 ? (
          <div>
            <h3 className="text-ink-2 mb-2 text-xs font-semibold tracking-wide uppercase">
              Baterias recentes
            </h3>
            <ul className="divide-border divide-y">
              {recentes.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <Link
                    href={`/admin/cronometragem/corridas/${c.id}`}
                    className="text-ink text-sm font-medium hover:underline"
                  >
                    {c.nome}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="text-ink-3 text-xs">
                      {c.pilotos} piloto(s)
                    </span>
                    <StatusPill tone={ESTADO_CORRIDA[c.estado].tom}>
                      {ESTADO_CORRIDA[c.estado].rotulo}
                    </StatusPill>
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/admin/cronometragem/corridas"
              className="text-orange-ink mt-2 inline-block text-sm font-medium hover:underline"
            >
              Todas as baterias e relatórios
            </Link>
          </div>
        ) : null}
      </Passo>

      <Card>
        <CardHeader>
          <h2 className="text-ink text-base font-semibold">
            Passagens dos sensores
          </h2>
          <p className="text-ink-3 text-xs">
            As últimas leituras do decoder, da mais nova para a mais antiga.
          </p>
        </CardHeader>
        <CardBody>
          {passagens.length === 0 ? (
            <p className="text-ink-2 text-sm">Nenhuma passagem ainda.</p>
          ) : (
            <ul
              aria-label="Últimas passagens"
              className="divide-border divide-y"
            >
              {passagens.map((ps) => {
                const kart = kartDoSensor.get(ps.transponder);
                return (
                  <li
                    key={ps.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
                  >
                    <span className="font-display text-ink w-28 text-base font-semibold">
                      {formatarHoraComMs(ps.instanteMs)}
                    </span>
                    <span className="text-ink w-24 text-sm font-medium">
                      {kart ? `Kart ${kart}` : "Sem kart"}
                    </span>
                    <span className="font-display text-ink-2 text-sm">
                      {ps.transponder}
                    </span>
                    {ps.simulado ? (
                      <StatusPill tone="orange">SIMULADO</StatusPill>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <AtualizacaoPeriodica intervaloMs={3000} />
    </div>
  );
}
