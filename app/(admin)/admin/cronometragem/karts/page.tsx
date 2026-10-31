import type { Metadata } from "next";
import { SubAbasEquipamentos } from "@/components/cronometragem/abas";
import { Campo, FormAcao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  adicionarSensorAoKartAction,
  removerSensorDoKartAction,
  salvarKartAction,
} from "@/lib/cadastros-cronometragem-actions";
import {
  listarKarts,
  sensoresSemKart,
  type Kart,
  type SensorSemKart,
} from "@/lib/cronometragem/cadastros-store";
import { formatarHoraComMs } from "@/lib/cronometragem/voltas";
import { formatarDataHora } from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Karts" };
export const dynamic = "force-dynamic";

const CLASSE_CAMPO =
  "border-border-strong bg-surface text-ink focus:border-orange w-full rounded-md border px-3 py-2 text-sm outline-none";

const STATUS = {
  ativo: { rotulo: "Ativo", tom: "ink" as const },
  manutencao: { rotulo: "Em manutenção", tom: "orange" as const },
  inativo: { rotulo: "Inativo", tom: "neutral" as const },
};

function FormularioKart({
  kart,
  rotuloBotao,
}: {
  kart?: Kart;
  rotuloBotao: string;
}) {
  const sufixo = kart?.id ?? "novo";
  return (
    <FormAcao action={salvarKartAction} rotulo={rotuloBotao} limpar={!kart}>
      {kart ? <input type="hidden" name="kartId" value={kart.id} /> : null}
      <Campo
        id={`numero-${sufixo}`}
        name="numero"
        rotulo="Número do kart"
        defaultValue={kart?.numero ?? ""}
        required
        maxLength={12}
      />
      <Campo
        id={`apelido-${sufixo}`}
        name="apelido"
        rotulo="Apelido (opcional)"
        defaultValue={kart?.apelido ?? ""}
        maxLength={40}
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
          defaultValue={kart?.status ?? "ativo"}
          className={CLASSE_CAMPO}
        >
          {Object.entries(STATUS).map(([valor, s]) => (
            <option key={valor} value={valor}>
              {s.rotulo}
            </option>
          ))}
        </select>
      </div>
      {kart ? null : (
        <Campo
          id={`fixo-${sufixo}`}
          name="transponderFixo"
          rotulo="Sensor do kart"
          maxLength={32}
          dica="Identificador do sensor já lido pelo decoder (veja a lista acima). Pode ficar em branco e ser adicionado depois."
        />
      )}
      <Campo
        id={`obs-${sufixo}`}
        name="observacoes"
        rotulo="Observações"
        defaultValue={kart?.observacoes ?? ""}
        maxLength={500}
      />
    </FormAcao>
  );
}

// Histórico de sensores do kart e o formulário para pôr um sensor novo
// (por exemplo, quando o sensor antigo deu problema).
function SensoresDoKart({
  kart,
  livres,
}: {
  kart: Kart;
  livres: SensorSemKart[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-ink text-sm font-semibold">Sensores do kart</h3>
        {kart.sensores.length === 0 ? (
          <p className="text-ink-3 mt-1 text-sm">Nenhum sensor ainda.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {kart.sensores.map((s) => (
              <li
                key={`${s.codigo}-${s.adicionadoEm.getTime()}`}
                className="border-border flex flex-col gap-1 rounded-md border px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm">{s.codigo}</span>
                  {s.ativo ? (
                    <StatusPill tone="ink">
                      {s.codigo === kart.transponderFixo
                        ? "em uso (principal)"
                        : "em uso"}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="neutral">fora de uso</StatusPill>
                  )}
                </div>
                <p className="text-ink-3 text-xs">
                  Desde {formatarDataHora(s.adicionadoEm)}
                  {s.removidoEm
                    ? ` · saiu em ${formatarDataHora(s.removidoEm)}${s.motivoRemocao ? ` (${s.motivoRemocao})` : ""}`
                    : ""}
                </p>
                {s.ativo ? (
                  <details>
                    <summary className="text-ink-2 cursor-pointer text-xs">
                      Tirar de uso
                    </summary>
                    <FormAcao
                      action={removerSensorDoKartAction}
                      rotulo="Tirar este sensor de uso"
                      variante="secondary"
                      className="mt-2"
                    >
                      <input type="hidden" name="kartId" value={kart.id} />
                      <input type="hidden" name="sensor" value={s.codigo} />
                      <Campo
                        id={`motivo-rem-${kart.id}-${s.codigo}`}
                        name="motivo"
                        rotulo="Motivo"
                        required
                        minLength={3}
                      />
                    </FormAcao>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-border border-t pt-4">
        <h3 className="text-ink text-sm font-semibold">
          Adicionar novo sensor ao kart
        </h3>
        <p className="text-ink-3 mt-1 text-xs">
          Passe o kart (com o sensor novo instalado) pelo decoder e escolha o
          sensor na lista, ou digite o código.
        </p>
        <FormAcao
          action={adicionarSensorAoKartAction}
          rotulo="Adicionar sensor"
          className="mt-3"
        >
          <input type="hidden" name="kartId" value={kart.id} />
          <select
            name="sensor"
            id={`sensor-novo-${kart.id}`}
            aria-label={`Sensor novo do kart ${kart.numero}`}
            defaultValue=""
            className={CLASSE_CAMPO}
          >
            <option value="">Escolha um sensor lido…</option>
            {livres.map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.codigo}
                {s.ultimaLeituraMs !== null
                  ? ` · lido às ${formatarHoraComMs(s.ultimaLeituraMs).slice(0, 8)}`
                  : ""}
              </option>
            ))}
          </select>
          <Campo
            id={`sensor-digitado-${kart.id}`}
            name="sensorDigitado"
            rotulo="…ou digite o código"
            maxLength={32}
          />
          <label className="text-ink flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="substituir"
              value="1"
              defaultChecked={kart.sensores.some((s) => s.ativo)}
              className="mt-0.5"
            />
            <span>
              O sensor anterior deu problema: tirar de uso e deixar em
              manutenção
            </span>
          </label>
          <Campo
            id={`motivo-novo-${kart.id}`}
            name="motivo"
            rotulo="Motivo (opcional)"
            placeholder="Ex.: sensor quebrou"
            maxLength={120}
          />
        </FormAcao>
      </div>
    </div>
  );
}

// Um kart por cartão: o resumo fica sempre à vista e os sensores/dados abrem
// por baixo, com a largura toda (funciona igual no celular).
function CartaoDoKart({
  kart,
  livres,
  podeAdministrar,
}: {
  kart: Kart;
  livres: SensorSemKart[];
  podeAdministrar: boolean;
}) {
  const resumo = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-ink font-medium">Kart {kart.numero}</span>
      {kart.apelido ? (
        <span className="text-ink-3 text-xs">{kart.apelido}</span>
      ) : null}
      <StatusPill tone={STATUS[kart.status].tom}>
        {STATUS[kart.status].rotulo}
      </StatusPill>
      <span className="text-ink-2 text-sm">
        Sensor:{" "}
        {kart.transponderFixo ? (
          <span className="font-mono">{kart.transponderFixo}</span>
        ) : (
          "—"
        )}
        {kart.sensores.length > 1 ? (
          <span className="text-ink-3 text-xs">
            {" "}
            · {kart.sensores.length} no histórico
          </span>
        ) : null}
      </span>
    </div>
  );

  if (!podeAdministrar) {
    return (
      <div className="border-border bg-surface rounded-lg border px-4 py-3">
        {resumo}
      </div>
    );
  }
  return (
    <details className="border-border bg-surface group rounded-lg border">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        {resumo}
        <span className="text-orange-ink text-sm font-medium">
          Sensores e dados
        </span>
      </summary>
      <div className="border-border grid gap-6 border-t px-4 py-4 md:grid-cols-2">
        <SensoresDoKart kart={kart} livres={livres} />
        <div>
          <h3 className="text-ink mb-2 text-sm font-semibold">Dados do kart</h3>
          <FormularioKart kart={kart} rotuloBotao="Salvar kart" />
        </div>
      </div>
    </details>
  );
}

export default async function KartsPage() {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeAdministrar = pode(sessao.papel, "equipamento.administrar");
  const [karts, livres] = await Promise.all([
    listarKarts(),
    sensoresSemKart(20),
  ]);

  const colunasLivres: Coluna<SensorSemKart>[] = [
    {
      header: "Sensor lido",
      cell: (s) => <span className="font-mono">{s.codigo}</span>,
    },
    {
      header: "Última leitura",
      cell: (s) =>
        s.ultimaLeituraMs !== null ? formatarHoraComMs(s.ultimaLeituraMs) : "—",
      numerica: true,
    },
    ...(podeAdministrar
      ? [
          {
            header: "Cadastrar como kart novo",
            cell: (s: SensorSemKart) => (
              <FormAcao
                action={salvarKartAction}
                rotulo="Cadastrar"
                className="w-48"
              >
                <input type="hidden" name="status" value="ativo" />
                <input type="hidden" name="transponderFixo" value={s.codigo} />
                <input
                  name="numero"
                  id={`numero-${s.codigo}`}
                  aria-label={`Número do kart com o sensor ${s.codigo}`}
                  placeholder="Nº do kart"
                  required
                  maxLength={12}
                  className={CLASSE_CAMPO}
                />
              </FormAcao>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Karts"
        description="Cada kart tem um sensor fixo, o mesmo em todas as baterias. Se o sensor de um kart der problema, adicione um novo sensor a ele aqui."
      />
      <SubAbasEquipamentos />

      <Card>
        <CardHeader>
          <h2 className="text-ink text-sm font-semibold">
            Sensores lidos que ainda não são de nenhum kart
          </h2>
          <p className="text-ink-3 mt-1 text-xs">
            Passe o kart com o sensor pelo decoder: o sensor aparece aqui. Para
            kart novo, informe o número ao lado; para kart que já existe (sensor
            novo), use “Sensores e dados” do kart, abaixo.
          </p>
        </CardHeader>
        <CardBody>
          <DataTable
            colunas={colunasLivres}
            linhas={livres}
            chave={(s) => s.codigo}
            vazio="Nenhum sensor novo. Passe um kart (com o sensor instalado) pelo decoder para ele aparecer aqui."
          />
        </CardBody>
      </Card>

      <h2 className="text-ink text-sm font-semibold">Karts cadastrados</h2>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_20rem]">
        {karts.length === 0 ? (
          <p className="text-ink-3 text-sm">Nenhum kart cadastrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {karts.map((k) => (
              <li key={k.id}>
                <CartaoDoKart
                  kart={k}
                  livres={livres}
                  podeAdministrar={podeAdministrar}
                />
              </li>
            ))}
          </ul>
        )}
        {podeAdministrar ? (
          <Card>
            <CardHeader>
              <h2 className="text-ink text-sm font-semibold">Cadastrar kart</h2>
            </CardHeader>
            <CardBody>
              <FormularioKart rotuloBotao="Cadastrar kart" />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
