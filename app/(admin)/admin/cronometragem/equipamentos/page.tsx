import type { Metadata } from "next";
import Link from "next/link";
import { AutoAtualizar } from "@/components/cronometragem/auto-atualizar";
import { SubAbasEquipamentos } from "@/components/cronometragem/abas";
import { ComputadorDaPistaSecao } from "@/components/cronometragem/computador-da-pista";
import { Campo, FormAcao, Selecao } from "@/components/operacao/form-acao";
import { SemPermissao } from "@/components/operacao/sem-permissao";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type Coluna } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { exigirPermissao } from "@/lib/auth";
import {
  alternarDecoderAction,
  criarDecoderAction,
  renovarTokenAction,
} from "@/lib/cronometragem-actions";
import {
  contarDesconhecidos,
  listarKarts,
  listarTransponders,
} from "@/lib/cronometragem/cadastros-store";
import {
  eventosDeConexao,
  listarDecoders,
  ultimasPassagens,
  type Decoder,
  type EventoDeConexao,
  type PassagemRecente,
} from "@/lib/cronometragem/decoders-store";
import { listarComputadores } from "@/lib/cronometragem/computadores-store";
import { ESTADO_CONEXAO } from "@/lib/cronometragem/rotulos";
import { formatarHoraComMs } from "@/lib/cronometragem/voltas";
import { agoraMs } from "@/lib/operacao/tempo";
import { pode } from "@/lib/permissoes";
import { urlPublica } from "@/lib/url-publica";

export const metadata: Metadata = { title: "Equipamentos — decoders" };
export const dynamic = "force-dynamic";

const DRIVERS = [
  { id: "linhas-tcp", nome: "Texto por TCP (genérico)" },
  { id: "gravador", nome: "Gravador (só para estudar um protocolo)" },
  { id: "simulador", nome: "Simulador (testes, sem equipamento)" },
];

const TIPO_EVENTO: Record<EventoDeConexao["tipo"], string> = {
  coletor_iniciado: "Coletor iniciado",
  conectado: "Decoder conectado",
  desconectado: "Decoder desconectado",
  erro: "Erro de comunicação",
};

function segundosAtras(data: Date | null): string {
  if (!data) return "nunca";
  const s = Math.max(0, Math.round((agoraMs() - data.getTime()) / 1000));
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

function Passo({
  feito,
  titulo,
  detalhe,
  href,
  acao,
}: {
  feito: boolean;
  titulo: string;
  detalhe: string;
  href?: string;
  acao?: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={
          feito
            ? "bg-ink mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs text-white"
            : "border-border-strong mt-0.5 size-5 shrink-0 rounded-full border"
        }
      >
        {feito ? "✓" : ""}
      </span>
      <div>
        <p className="text-ink text-sm font-medium">{titulo}</p>
        <p className="text-ink-2 text-xs">
          {detalhe}
          {href && acao ? (
            <>
              {" "}
              <Link
                href={href}
                className="text-orange-ink font-medium hover:underline"
              >
                {acao}
              </Link>
            </>
          ) : null}
        </p>
      </div>
    </li>
  );
}

function Acoes({ decoder }: { decoder: Decoder }) {
  return (
    <div className="flex flex-col gap-2">
      <FormAcao
        action={alternarDecoderAction}
        rotulo={decoder.ativo ? "Desativar" : "Ativar"}
        variante="secondary"
      >
        <input type="hidden" name="decoderId" value={decoder.id} />
        <input type="hidden" name="ativo" value={decoder.ativo ? "0" : "1"} />
      </FormAcao>
      <details>
        <summary className="text-ink-2 cursor-pointer text-sm">
          Gerar novo token
        </summary>
        <FormAcao
          action={renovarTokenAction}
          rotulo="Gerar e invalidar o anterior"
          variante="secondary"
          className="mt-2 w-56"
        >
          <input type="hidden" name="decoderId" value={decoder.id} />
        </FormAcao>
      </details>
    </div>
  );
}

export default async function EquipamentosPage() {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) return <SemPermissao />;
  const podeAdministrar = pode(sessao.papel, "equipamento.administrar");

  const [
    decoders,
    eventos,
    passagens,
    desconhecidos,
    transponders,
    karts,
    computadores,
    urlDoSistema,
  ] = await Promise.all([
    listarDecoders(),
    eventosDeConexao(10),
    ultimasPassagens(15),
    contarDesconhecidos(),
    listarTransponders(""),
    listarKarts(),
    listarComputadores(),
    urlPublica(),
  ]);
  const conectado = decoders.some(
    (d) => d.estadoConexao === "conectado" && !d.simulado,
  );

  const colunasDecoder: Coluna<Decoder>[] = [
    {
      header: "Decoder",
      cell: (d) => (
        <div>
          <p className="text-ink font-medium">
            {d.nome}
            {d.simulado ? (
              <StatusPill tone="orange" className="ml-2">
                SIMULADO
              </StatusPill>
            ) : null}
          </p>
          <p className="text-ink-3 text-xs">
            {d.driver}
            {d.modelo ? ` · ${d.modelo}` : ""}
            {d.endereco ? ` · ${d.endereco}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Conexão",
      cell: (d) => (
        <div>
          <StatusPill tone={ESTADO_CONEXAO[d.estadoConexao].tom}>
            {ESTADO_CONEXAO[d.estadoConexao].rotulo}
          </StatusPill>
          {d.ultimoErro ? (
            <p className="text-ink-3 mt-1 max-w-xs text-xs">
              Último erro {segundosAtras(d.ultimoErroEm)}: {d.ultimoErro}
            </p>
          ) : null}
        </div>
      ),
    },
    { header: "Último sinal", cell: (d) => segundosAtras(d.ultimoSinal) },
    {
      header: "Passagens (24 h)",
      cell: (d) => d.passagens24h,
      numerica: true,
    },
    ...(podeAdministrar
      ? [{ header: "", cell: (d: Decoder) => <Acoes decoder={d} /> }]
      : []),
  ];

  const colunasEvento: Coluna<EventoDeConexao>[] = [
    {
      header: "Quando",
      cell: (e) => formatarHoraComMs(e.ocorridoEm.getTime()),
    },
    { header: "Decoder", cell: (e) => e.decoderNome },
    { header: "Evento", cell: (e) => TIPO_EVENTO[e.tipo] },
    { header: "Detalhe", cell: (e) => e.detalhe ?? "—" },
  ];

  const colunasPassagem: Coluna<PassagemRecente>[] = [
    {
      header: "Hora",
      cell: (p) => (
        <span title={p.relogio === "coletor" ? "Hora do coletor" : undefined}>
          {formatarHoraComMs(p.instanteMs)}
          {p.relogio === "coletor" ? "*" : ""}
        </span>
      ),
      numerica: true,
    },
    {
      header: "Transponder",
      cell: (p) => <span className="font-mono">{p.transponder}</span>,
    },
    {
      header: "Decoder",
      cell: (p) => (
        <span>
          {p.decoderNome}
          {p.simulado ? (
            <StatusPill tone="orange" className="ml-2">
              SIMULADO
            </StatusPill>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AutoAtualizar intervaloMs={5000} />
      <PageHeader
        title="Equipamentos"
        description="Cadastre e acompanhe o decoder, os transponders e os karts."
      />
      <SubAbasEquipamentos />

      <ComputadorDaPistaSecao
        computadores={computadores}
        podeAdministrar={podeAdministrar}
        urlDoSistema={urlDoSistema}
      />

      <Card>
        <CardHeader>
          <h2 className="text-ink text-sm font-semibold">Primeiros passos</h2>
        </CardHeader>
        <CardBody>
          <ol className="flex flex-col gap-3">
            <Passo
              feito={conectado}
              titulo="1. Decoder conectado"
              detalhe={
                decoders.length === 0
                  ? "Nenhum decoder cadastrado. Use o formulário abaixo."
                  : conectado
                    ? "O decoder real está enviando sinal."
                    : "Cadastrado, mas o decoder real ainda não está conectado."
              }
            />
            <Passo
              feito={transponders.length > 0 && desconhecidos === 0}
              titulo="2. Transponders cadastrados"
              detalhe={
                transponders.length === 0
                  ? "Nenhum lido ainda: passe um kart pelo sensor."
                  : desconhecidos > 0
                    ? `${desconhecidos} lido(s) pelo decoder e ainda sem cadastro.`
                    : `${transponders.length} cadastrado(s).`
              }
              href="/admin/cronometragem/transponders"
              acao="Abrir transponders"
            />
            <Passo
              feito={karts.length > 0}
              titulo="3. Karts (opcional)"
              detalhe={
                karts.length > 0
                  ? `${karts.length} kart(s) cadastrado(s).`
                  : "Só necessário se o transponder for fixo no kart."
              }
              href="/admin/cronometragem/karts"
              acao="Abrir karts"
            />
          </ol>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <h2 className="text-ink text-sm font-semibold">Decoders</h2>
          <DataTable
            colunas={colunasDecoder}
            linhas={decoders}
            chave={(d) => d.id}
            vazio="Nenhum decoder cadastrado ainda."
          />
        </div>

        {podeAdministrar ? (
          <Card>
            <CardHeader>
              <h2 className="text-ink text-sm font-semibold">
                Cadastrar decoder
              </h2>
            </CardHeader>
            <CardBody>
              <FormAcao
                action={criarDecoderAction}
                rotulo="Cadastrar e gerar token"
              >
                <Campo id="nome" rotulo="Nome" required minLength={2} />
                <Selecao
                  id="driver"
                  rotulo="Como o coletor conversa com ele"
                  defaultValue="linhas-tcp"
                >
                  {DRIVERS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </Selecao>
                <details>
                  <summary className="text-ink-2 cursor-pointer text-sm">
                    Mais campos (opcional)
                  </summary>
                  <div className="mt-2 flex flex-col gap-3">
                    <Campo
                      id="modelo"
                      rotulo="Modelo do equipamento"
                      dica="Só informativo. Deixe em branco se não tiver certeza."
                    />
                    <Campo
                      id="endereco"
                      rotulo="Endereço"
                      dica="IP e porta, ex.: 192.168.1.50:5100. Só informativo."
                    />
                  </div>
                </details>
              </FormAcao>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <details className="border-border bg-surface rounded-lg border px-5 py-4">
        <summary className="text-ink cursor-pointer text-sm font-semibold">
          Conexão manual de um decoder por rede (avançado)
        </summary>
        <ol className="text-ink-2 mt-3 list-decimal space-y-1 pl-5 text-sm">
          <li>Cadastre o decoder acima e copie o token que aparece.</li>
          <li>
            No computador ligado à rede do decoder, copie a pasta{" "}
            <code>coletor</code>, crie o arquivo de configuração (modelo em{" "}
            <code>coletor/exemplo.config.json</code>) com o endereço deste
            sistema e o token.
          </li>
          <li>
            Rode <code>node coletor/coletor.mjs descobrir</code> para listar os
            aparelhos da rede e <code>node coletor/coletor.mjs rodar</code> para
            começar a enviar as passagens.
          </li>
        </ol>
        <p className="text-ink-3 mt-3 text-xs">
          Estado real da integração com o CalX Pro (protocolo ainda não
          confirmado) e procedimentos de teste:{" "}
          <code>docs/cronometragem.md</code>.
        </p>
      </details>

      <details className="border-border bg-surface rounded-lg border px-5 py-4">
        <summary className="text-ink cursor-pointer text-sm font-semibold">
          Diagnóstico: eventos de conexão e últimas passagens
        </summary>
        <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <DataTable
            colunas={colunasEvento}
            linhas={eventos}
            chave={(e) => e.id}
            vazio="Nenhum evento de conexão registrado."
          />
          <div className="flex flex-col gap-2">
            <DataTable
              colunas={colunasPassagem}
              linhas={passagens}
              chave={(p) => p.id}
              vazio="Nenhuma passagem recebida ainda."
            />
            <p className="text-ink-3 text-xs">
              * Hora marcada pelo coletor (o decoder não informa a hora da
              passagem).
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
