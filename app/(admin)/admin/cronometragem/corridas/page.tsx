import type { Metadata } from "next";
import Link from "next/link";
import { AtualizacaoPeriodica } from "@/components/cronometragem/atualizacao-periodica";
import { Campo, FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import { criarCorridaAction, novaBateriaAction } from "@/lib/corrida-actions";
import {
  bateriasSemCorrida,
  DURACAO_CLASSIFICACAO_PADRAO_MIN,
  DURACAO_PADRAO_MIN,
  ESPERA_FINAL_PADRAO_S,
  listarCorridas,
  TEMPO_MINIMO_PADRAO_MS,
  type CorridaResumo,
} from "@/lib/cronometragem/corridas-store";
import {
  ESTADO_CORRIDA,
  MODO_ENCERRAMENTO,
  REGRA_LARGADA,
} from "@/lib/cronometragem/rotulos";
import {
  formatarDataHora,
  hojeEmSaoPaulo,
  limitesDoDia,
  somarDias,
} from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";
import { CLASSE_CAMPO } from "@/components/ui/campo";

export const metadata: Metadata = { title: "Baterias" };
export const dynamic = "force-dynamic";

export default async function CorridasPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeOperar = pode(sessao.papel, "sessao.operar");
  const { slot } = await searchParams;

  const hoje = hojeEmSaoPaulo();
  const [corridas, baterias] = await Promise.all([
    listarCorridas(40),
    bateriasSemCorrida(
      limitesDoDia(hoje).inicio,
      limitesDoDia(somarDias(hoje, 2)).inicio,
    ),
  ]);
  const aoVivo = corridas.some(
    (c) => c.estado === "em_andamento" || c.estado === "encerrando",
  );

  const colunas: Coluna<CorridaResumo>[] = [
    {
      header: "Bateria",
      cell: (c) => (
        <Link
          href={`/admin/cronometragem/corridas/${c.id}`}
          className="text-ink font-medium hover:underline"
        >
          {c.nome}
        </Link>
      ),
    },
    {
      header: "Situação",
      cell: (c) => (
        <StatusPill tone={ESTADO_CORRIDA[c.estado].tom}>
          {ESTADO_CORRIDA[c.estado].rotulo}
        </StatusPill>
      ),
    },
    {
      header: "Início",
      cell: (c) => (c.iniciadaEm ? formatarDataHora(c.iniciadaEm) : "—"),
    },
    {
      header: "Pilotos",
      cell: (c) => `${c.comSensor} de ${c.pilotos} com sensor`,
      numerica: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {aoVivo ? <AtualizacaoPeriodica intervaloMs={5000} /> : null}
      <PageHeader
        title="Baterias"
        description="Abra uma bateria, inicie e acompanhe: os karts entram sozinhos ao passar pelo decoder."
      />

      {podeOperar ? (
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-ink text-base font-semibold">
                  Começar uma nova bateria
                </p>
                <p className="text-ink-2 mt-1 text-sm">
                  Abre uma bateria com as mesmas regras da última. Depois é só
                  iniciar.
                </p>
              </div>
              <FormAcao action={novaBateriaAction} rotulo="Nova bateria">
                <input type="hidden" name="duasFases" value="1" />
              </FormAcao>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {podeOperar ? (
        <details className="border-border bg-surface rounded-lg border">
          <summary className="text-ink-2 cursor-pointer px-5 py-4 text-sm font-medium">
            Opções avançadas: bateria da agenda ou com regras próprias
          </summary>
          <div className="border-border border-t px-5 py-4">
            <FormAcao action={criarCorridaAction} rotulo="Criar bateria">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="slotId"
                    className="text-ink text-sm font-medium"
                  >
                    Bateria da agenda
                  </label>
                  <select
                    id="slotId"
                    name="slotId"
                    defaultValue={slot ?? ""}
                    className={CLASSE_CAMPO}
                  >
                    <option value="">Nenhuma (bateria avulsa)</option>
                    {baterias.map((b) => (
                      <option key={b.id} value={b.id}>
                        {formatarDataHora(b.inicio)} · {b.pilotos} piloto(s)
                      </option>
                    ))}
                  </select>
                  <p className="text-ink-3 text-xs">
                    Os pilotos reservados já entram no grid.
                  </p>
                </div>
                <Campo
                  id="nome"
                  rotulo="Nome da bateria"
                  placeholder="Ex.: Treino das 14h"
                  dica="Opcional quando escolher uma bateria."
                />
                <Campo
                  id="duracao"
                  rotulo="Duração (minutos)"
                  type="number"
                  min={1}
                  max={240}
                  placeholder={`${DURACAO_CLASSIFICACAO_PADRAO_MIN} (classificação) ou ${DURACAO_PADRAO_MIN} (corrida única)`}
                  dica="Com classificação e corrida, vale para a classificação; a duração da corrida é escolhida ao criá-la."
                />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="fase"
                    className="text-ink text-sm font-medium"
                  >
                    Fases da bateria
                  </label>
                  <select
                    id="fase"
                    name="fase"
                    defaultValue="classificacao"
                    className={CLASSE_CAMPO}
                  >
                    <option value="classificacao">
                      Classificação e depois corrida
                    </option>
                    <option value="unica">Corrida única</option>
                  </select>
                  <p className="text-ink-3 text-xs">
                    A corrida larga na ordem da melhor volta da classificação.
                  </p>
                </div>
              </div>

              <details className="mt-1">
                <summary className="text-ink-2 cursor-pointer text-sm">
                  Regras da bateria (avançado)
                </summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Campo
                    id="tempoMinimo"
                    rotulo="Tempo mínimo entre leituras (s)"
                    type="number"
                    min={1}
                    max={600}
                    defaultValue={TEMPO_MINIMO_PADRAO_MS / 1000}
                    dica="Leituras do mesmo sensor mais próximas que isto contam como a mesma passagem. Ajuste ao tamanho da pista."
                  />
                  <Campo
                    id="esperaFinal"
                    rotulo="Espera pelas últimas passagens (s)"
                    type="number"
                    min={0}
                    max={3600}
                    defaultValue={ESPERA_FINAL_PADRAO_S}
                    dica="Só vale para “cada piloto termina na próxima passagem”."
                  />
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="regraLargada"
                      className="text-ink text-sm font-medium"
                    >
                      Largada
                    </label>
                    <select
                      id="regraLargada"
                      name="regraLargada"
                      defaultValue="primeira_passagem"
                      className={CLASSE_CAMPO}
                    >
                      {Object.entries(REGRA_LARGADA).map(([valor, texto]) => (
                        <option key={valor} value={valor}>
                          {texto}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="modoEncerramento"
                      className="text-ink text-sm font-medium"
                    >
                      Encerramento
                    </label>
                    <select
                      id="modoEncerramento"
                      name="modoEncerramento"
                      defaultValue="manual"
                      className={CLASSE_CAMPO}
                    >
                      {Object.entries(MODO_ENCERRAMENTO).map(
                        ([valor, texto]) => (
                          <option key={valor} value={valor}>
                            {texto}
                          </option>
                        ),
                      )}
                    </select>
                    <p className="text-ink-3 text-xs">
                      Defina conforme a regra da pista; o sistema não presume
                      nenhuma.
                    </p>
                  </div>
                </div>
              </details>
            </FormAcao>
          </div>
        </details>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-ink text-sm font-semibold">Baterias recentes</h2>
        <DataTable
          colunas={colunas}
          linhas={corridas}
          chave={(c) => c.id}
          vazio="Nenhuma bateria ainda. Abra a primeira acima."
        />
      </div>
    </div>
  );
}
