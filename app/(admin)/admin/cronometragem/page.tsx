import type { Metadata } from "next";
import Link from "next/link";
import { AutoAtualizar } from "@/components/cronometragem/auto-atualizar";
import { TabelaClassificacao } from "@/components/cronometragem/classificacao";
import { Contador } from "@/components/cronometragem/contador";
import { FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import { novaBateriaAction } from "@/lib/corrida-actions";
import { contarDesconhecidos } from "@/lib/cronometragem/cadastros-store";
import {
  corridaAtiva,
  listarCorridas,
  lerPainel,
} from "@/lib/cronometragem/corridas-store";
import {
  listarDecoders,
  type Decoder,
} from "@/lib/cronometragem/decoders-store";
import { ESTADO_CONEXAO, ESTADO_CORRIDA } from "@/lib/cronometragem/rotulos";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Cronometragem" };
export const dynamic = "force-dynamic";

// Resumo do decoder para quem está operando: um só texto, sem tabela.
function resumoDoDecoder(decoders: Decoder[]) {
  const ativos = decoders.filter((d) => d.ativo);
  if (ativos.length === 0) {
    return {
      tom: "orange" as const,
      titulo: "Nenhum decoder cadastrado",
      detalhe: "Cadastre em Equipamentos para receber passagens.",
    };
  }
  const real = ativos.filter((d) => !d.simulado);
  const alvo =
    real.find((d) => d.estadoConexao === "conectado") ??
    ativos.find((d) => d.estadoConexao === "conectado") ??
    real[0] ??
    ativos[0];
  const estado = ESTADO_CONEXAO[alvo.estadoConexao];
  return {
    tom: estado.tom,
    titulo: estado.rotulo,
    detalhe: `${alvo.nome}${alvo.simulado ? " (SIMULADO — não é o decoder real)" : ""}`,
  };
}

export default async function CronometragemAoVivoPage() {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeOperar = pode(sessao.papel, "sessao.operar");

  const [decoders, ativa, recentes, desconhecidos] = await Promise.all([
    listarDecoders(),
    corridaAtiva(),
    listarCorridas(10),
    contarDesconhecidos(),
  ]);
  const painel = ativa ? await lerPainel(ativa.id) : null;
  const emPreparo = recentes.find(
    (c) => c.estado === "preparada" || c.estado === "pronta",
  );
  const ultimaFinalizada = recentes.find((c) => c.estado === "finalizada");
  const decoder = resumoDoDecoder(decoders);
  const rotulos = new Map(
    painel?.grid.map((p) => [p.transponder ?? "", p.rotulo]),
  );

  // Só o que exige atenção agora (máx. 4); o resto está dentro da corrida.
  const atencao: string[] = [];
  for (const d of decoders) {
    if (!d.ativo || d.simulado) continue;
    if (d.estadoConexao === "coletor_offline") {
      atencao.push(`${d.nome}: o coletor está offline.`);
    } else if (d.estadoConexao === "decoder_desconectado") {
      atencao.push(
        `${d.nome}: o decoder está desconectado${d.ultimoErro ? ` (${d.ultimoErro})` : ""}.`,
      );
    }
  }
  if (painel) {
    for (const a of painel.alertas) {
      if (a.nivel === "erro") atencao.push(a.texto);
    }
  }
  const mostrarAtencao = atencao.slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      {ativa ? (
        <AutoAtualizar intervaloMs={2000} />
      ) : (
        <AutoAtualizar intervaloMs={5000} />
      )}
      <PageHeader
        title="Cronometragem"
        description="Tudo o que está acontecendo na pista agora."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-ink-3 text-xs tracking-wide uppercase">
              Decoder
            </p>
            <p className="mt-2">
              <StatusPill tone={decoder.tom}>{decoder.titulo}</StatusPill>
            </p>
            <p className="text-ink-2 mt-2 text-xs">{decoder.detalhe}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-ink-3 text-xs tracking-wide uppercase">
              Bateria
            </p>
            <p className="mt-2">
              <StatusPill
                tone={ativa ? ESTADO_CORRIDA[ativa.estado].tom : "neutral"}
              >
                {ativa
                  ? ESTADO_CORRIDA[ativa.estado].rotulo
                  : "Nenhuma em andamento"}
              </StatusPill>
            </p>
            <p className="text-ink-2 mt-2 text-xs">{ativa?.nome ?? "—"}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-ink-3 text-xs tracking-wide uppercase">
              Tempo restante
            </p>
            <p className="text-ink mt-1 font-mono text-3xl font-semibold">
              {painel && ativa?.estado === "em_andamento" ? (
                painel.prazoMs !== null ? (
                  <Contador
                    modo="regressivo"
                    referenciaMs={painel.prazoMs}
                    agoraServidorMs={painel.agoraMs}
                  />
                ) : (
                  "—"
                )
              ) : ativa?.estado === "encerrando" ? (
                "00:00"
              ) : (
                "—"
              )}
            </p>
            {painel ? (
              <p className="text-ink-2 mt-1 text-xs">
                {painel.grid.length} piloto(s) no grid
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {mostrarAtencao.length > 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-red-700">Atenção</p>
            <ul className="text-ink mt-1 space-y-0.5 text-sm">
              {mostrarAtencao.map((texto, i) => (
                <li key={i}>• {texto}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {ativa && painel ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-ink text-base font-semibold">
              Classificação — {ativa.nome}
            </h2>
            <ButtonLink href={`/admin/cronometragem/corridas/${ativa.id}`}>
              Abrir bateria
            </ButtonLink>
          </div>
          <TabelaClassificacao
            linhas={painel.classificacao}
            rotulosDosSensores={rotulos}
            mostrarSensor={podeOperar}
          />
        </div>
      ) : (
        <Card>
          <CardBody>
            {emPreparo ? (
              <>
                <p className="text-ink text-base font-semibold">
                  Bateria em preparação: {emPreparo.nome}
                </p>
                <p className="text-ink-2 mt-1 text-sm">
                  Abra a bateria para continuar a preparação e iniciar.
                </p>
                <div className="mt-4">
                  <ButtonLink
                    href={`/admin/cronometragem/corridas/${emPreparo.id}`}
                  >
                    Continuar preparação
                  </ButtonLink>
                </div>
              </>
            ) : (
              <>
                <p className="text-ink text-base font-semibold">
                  Nenhuma bateria em andamento.
                </p>
                <p className="text-ink-2 mt-1 text-sm">
                  Abra uma nova bateria e inicie: cada kart entra na
                  classificação sozinho ao passar pelo decoder.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {podeOperar ? (
                    <FormAcao action={novaBateriaAction} rotulo="Nova bateria">
                      {null}
                    </FormAcao>
                  ) : null}
                  {ultimaFinalizada ? (
                    <ButtonLink
                      href={`/admin/cronometragem/corridas/${ultimaFinalizada.id}`}
                      variant="secondary"
                    >
                      Ver último resultado
                    </ButtonLink>
                  ) : null}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {desconhecidos > 0 ? (
        <p className="text-ink text-sm">
          {desconhecidos} sensor(es) foram lidos pelo decoder e ainda não têm
          cadastro.{" "}
          <Link
            href="/admin/cronometragem/transponders"
            className="text-orange-ink font-medium hover:underline"
          >
            Cadastrar
          </Link>
        </p>
      ) : null}
    </div>
  );
}
