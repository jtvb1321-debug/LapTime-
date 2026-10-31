import type { Metadata } from "next";
import Link from "next/link";
import { SubAbasEquipamentos } from "@/components/cronometragem/abas";
import { Campo, FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  salvarModeloVinculoAction,
  salvarTransponderAction,
} from "@/lib/cadastros-cronometragem-actions";
import {
  historicoDoTransponder,
  lerModeloDeVinculo,
  lerTransponder,
  listarTransponders,
  type Transponder,
} from "@/lib/cronometragem/cadastros-store";
import { ESTADO_CORRIDA } from "@/lib/cronometragem/rotulos";
import { formatarHoraComMs } from "@/lib/cronometragem/voltas";
import { formatarDataHora } from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";
import type { EstadoCorrida } from "@/lib/cronometragem/corridas-store";

export const metadata: Metadata = { title: "Transponders" };
export const dynamic = "force-dynamic";

const CLASSE_CAMPO =
  "border-border-strong bg-surface text-ink focus:border-orange w-full rounded-md border px-3 py-2 text-sm outline-none";

const STATUS = {
  ativo: { rotulo: "Ativo", tom: "ink" as const },
  inativo: { rotulo: "Inativo", tom: "neutral" as const },
  manutencao: { rotulo: "Em manutenção", tom: "orange" as const },
};

function FormularioTransponder({
  transponder,
  rotuloBotao,
}: {
  transponder?: Transponder;
  rotuloBotao: string;
}) {
  const sufixo = transponder?.codigo ?? "novo";
  return (
    <FormAcao
      action={salvarTransponderAction}
      rotulo={rotuloBotao}
      limpar={!transponder}
    >
      {transponder ? (
        <input type="hidden" name="codigo" value={transponder.codigo} />
      ) : (
        <Campo
          id="codigo"
          rotulo="Identificador do equipamento"
          required
          maxLength={32}
          dica="Exatamente como o decoder envia (texto: zeros à esquerda são mantidos)."
        />
      )}
      <Campo
        id={`rotulo-${sufixo}`}
        name="rotulo"
        rotulo="Nome (ex.: Kart 7)"
        defaultValue={transponder?.rotulo ?? ""}
        maxLength={40}
      />
      <Campo
        id={`modelo-${sufixo}`}
        name="modelo"
        rotulo="Modelo do dispositivo (se souber)"
        defaultValue={transponder?.modelo ?? ""}
        maxLength={80}
      />
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`status-${sufixo}`}
          className="text-ink text-sm font-medium"
        >
          Situação
        </label>
        <select
          id={`status-${sufixo}`}
          name="status"
          defaultValue={transponder?.status ?? "ativo"}
          className={CLASSE_CAMPO}
        >
          {Object.entries(STATUS).map(([valor, s]) => (
            <option key={valor} value={valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
      </div>
      <Campo
        id={`obs-${sufixo}`}
        name="observacoes"
        rotulo="Observações"
        defaultValue={transponder?.observacoes ?? ""}
        maxLength={500}
      />
    </FormAcao>
  );
}

export default async function TranspondersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; codigo?: string }>;
}) {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeAdministrar = pode(sessao.papel, "equipamento.administrar");
  const { q = "", codigo } = await searchParams;

  const [transponders, modelo] = await Promise.all([
    listarTransponders(q),
    lerModeloDeVinculo(),
  ]);
  const detalhe = codigo ? await lerTransponder(codigo) : null;
  const historico = detalhe ? await historicoDoTransponder(detalhe.codigo) : [];

  const colunas: Coluna<Transponder>[] = [
    {
      header: "Identificador",
      cell: (t) => (
        <Link
          href={`/admin/cronometragem/transponders?codigo=${encodeURIComponent(t.codigo)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          className="font-mono font-medium hover:underline"
        >
          {t.codigo}
        </Link>
      ),
    },
    {
      header: "Nome / modelo",
      cell: (t) => (
        <div>
          <p className="text-ink">{t.rotulo ?? "—"}</p>
          {t.modelo ? <p className="text-ink-3 text-xs">{t.modelo}</p> : null}
        </div>
      ),
    },
    {
      header: "Situação",
      cell: (t) =>
        !t.cadastrado ? (
          <StatusPill tone="orange">Desconhecido (não cadastrado)</StatusPill>
        ) : (
          <StatusPill tone={STATUS[t.status].tom}>
            {STATUS[t.status].rotulo}
          </StatusPill>
        ),
    },
    { header: "Kart fixo", cell: (t) => t.kartFixo ?? "—" },
    {
      header: "Leituras",
      cell: (t) => t.leituras,
      numerica: true,
    },
    {
      header: "Última leitura",
      cell: (t) =>
        t.ultimaLeituraMs !== null
          ? formatarHoraComMs(t.ultimaLeituraMs)
          : "nunca lido",
      numerica: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transponders"
        description="Cadastro dos sensores. O identificador é o que o decoder envia, guardado como texto, sem conversão."
      />
      <SubAbasEquipamentos />

      <form
        className="flex max-w-md gap-2"
        action="/admin/cronometragem/transponders"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por identificador, nome ou modelo"
          aria-label="Buscar transponder"
          className={CLASSE_CAMPO}
        />
        <button
          type="submit"
          className="bg-ink rounded-md px-4 py-2 text-sm font-medium text-white"
        >
          Buscar
        </button>
      </form>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <DataTable
          colunas={colunas}
          linhas={transponders}
          chave={(t) => t.codigo}
          vazio="Nenhum transponder encontrado. Eles aparecem aqui assim que o decoder lê o primeiro."
        />
        <div className="flex flex-col gap-4">
          {detalhe ? (
            <Card>
              <CardHeader>
                <h2 className="text-ink font-mono text-sm font-semibold">
                  {detalhe.codigo}
                </h2>
                <p className="text-ink-3 text-xs">
                  {detalhe.cadastrado
                    ? `Cadastrado · atualizado ${formatarDataHora(detalhe.atualizadoEm)}`
                    : "Lido pelo decoder e ainda não cadastrado"}
                </p>
              </CardHeader>
              <CardBody>
                {podeAdministrar ? (
                  <FormularioTransponder
                    transponder={detalhe}
                    rotuloBotao={
                      detalhe.cadastrado
                        ? "Salvar"
                        : "Cadastrar este transponder"
                    }
                  />
                ) : (
                  <p className="text-ink-2 text-sm">
                    Somente o administrador edita transponders.
                  </p>
                )}
                <h3 className="text-ink mt-4 text-sm font-semibold">
                  Histórico de utilização
                </h3>
                {historico.length === 0 ? (
                  <p className="text-ink-3 mt-1 text-sm">
                    Ainda não foi usado em nenhuma bateria.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {historico.map((u) => (
                      <li key={`${u.corridaId}-${u.participante}`}>
                        <Link
                          href={`/admin/cronometragem/corridas/${u.corridaId}`}
                          className="text-orange-ink hover:underline"
                        >
                          {u.corridaNome}
                        </Link>{" "}
                        · {u.participante}
                        {u.kartNumero ? ` · kart ${u.kartNumero}` : ""} ·{" "}
                        {ESTADO_CORRIDA[u.estado as EstadoCorrida]?.rotulo ??
                          u.estado}
                        {u.iniciadaEm
                          ? ` · ${formatarDataHora(u.iniciadaEm)}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : null}

          {podeAdministrar ? (
            <Card>
              <CardHeader>
                <h2 className="text-ink text-sm font-semibold">
                  Cadastrar transponder
                </h2>
              </CardHeader>
              <CardBody>
                <FormularioTransponder rotuloBotao="Cadastrar" />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <h2 className="text-ink text-sm font-semibold">
                Como o transponder é associado
              </h2>
            </CardHeader>
            <CardBody>
              {podeAdministrar ? (
                <FormAcao
                  action={salvarModeloVinculoAction}
                  rotulo="Salvar modelo"
                  variante="secondary"
                  limpar={false}
                >
                  <select
                    name="modelo"
                    id="modelo-vinculo"
                    aria-label="Modelo de vínculo"
                    defaultValue={modelo}
                    className={CLASSE_CAMPO}
                  >
                    <option value="piloto">
                      Do piloto: o sensor é ligado ao piloto na bateria
                    </option>
                    <option value="kart">
                      Do kart (padrão): cada kart tem um sensor fixo; o nome do
                      piloto é dado depois da 1ª passagem
                    </option>
                  </select>
                </FormAcao>
              ) : (
                <p className="text-ink-2 text-sm">
                  Modelo atual: {modelo === "kart" ? "do kart" : "do piloto"}.
                </p>
              )}
              <p className="text-ink-3 mt-2 text-xs">
                Vale para as próximas baterias. O vínculo usado em cada bateria
                fica gravado nela e não muda se o cadastro mudar.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
