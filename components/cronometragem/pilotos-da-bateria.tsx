import { Campo, FormAcao } from "@/components/operacao/form-acao";
import {
  ChipPagamento,
  ReceberDoPiloto,
} from "@/components/operacao/pagamento-do-piloto";
import { StatusPill } from "@/components/ui/status-pill";
import {
  cadastrarPilotoAction,
  definirResponsavelAction,
  registrarPresencaAction,
  removerPilotoAction,
  sortearKartsAction,
} from "@/lib/corrida-actions";
import type {
  PilotoDaCorrida,
  ResponsavelDaBateria,
} from "@/lib/cronometragem/corridas-store";
import type { Cliente } from "@/lib/operacao/clientes-store";
import { CLASSE_CAMPO } from "@/components/ui/campo";

function SituacaoDoTermo({ piloto }: { piloto: PilotoDaCorrida }) {
  if (piloto.vaga) return <StatusPill tone="orange">Vaga aberta</StatusPill>;
  if (piloto.apto) {
    return <StatusPill tone="ink">Apto · termo assinado</StatusPill>;
  }
  if (piloto.termo === "valido") {
    return <StatusPill tone="ink">Termo assinado</StatusPill>;
  }
  if (piloto.termo === "pendente") {
    return <StatusPill tone="orange">Termo pendente</StatusPill>;
  }
  return <StatusPill tone="neutral">Sem cadastro</StatusPill>;
}

function CamposDoCadastro({ sufixo }: { sufixo: string }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          id={`nome-${sufixo}`}
          name="nome"
          rotulo="Nome completo"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
        />
        <Campo
          id={`telefone-${sufixo}`}
          name="telefone"
          rotulo="Telefone (WhatsApp)"
          required
          inputMode="tel"
          placeholder="(11) 99999-0000"
        />
      </div>
      <details>
        <summary className="text-ink-3 cursor-pointer text-xs">
          Mais dados (data de nascimento)
        </summary>
        <Campo
          id={`nascimento-${sufixo}`}
          name="nascimento"
          rotulo="Data de nascimento"
          type="date"
          className="mt-2"
          dica="Menor de 18 anos: o termo é assinado pelo responsável legal."
        />
      </details>
    </>
  );
}

// Cadastro dos pilotos da bateria, no estilo do LapTime: o responsável e cada
// piloto têm cadastro (com número) e assinam o termo antes de largar.
export function PilotosDaBateria({
  corridaId,
  grid,
  responsavel,
  busca,
  resultados,
  podeEditar,
  avulsa,
  caixaEstaAberto,
  podeReceber,
  podeSortear,
}: {
  corridaId: string;
  grid: PilotoDaCorrida[];
  responsavel?: ResponsavelDaBateria;
  busca: string;
  resultados: Cliente[];
  podeEditar: boolean;
  // Bateria avulsa (sem reserva na agenda): os pilotos entram um por um.
  avulsa: boolean;
  caixaEstaAberto: boolean;
  // Quem recebe no caixa pode lançar o pagamento do piloto aqui.
  podeReceber: boolean;
  // O sorteio de karts só antes da largada.
  podeSortear: boolean;
}) {
  const semKart = grid.filter((p) => !p.kartNumero && !p.vaga).length;
  const comKart = grid.filter((p) => p.kartNumero).length;
  const assinados = grid.filter((p) => p.termo === "valido").length;
  const comCadastro = grid.filter((p) => p.clienteId).length;
  const noGrid = new Set(
    grid.flatMap((p) => (p.clienteId ? [p.clienteId] : [])),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-1 rounded-md border px-4 py-3">
        <p className="text-ink-3 text-xs font-semibold tracking-wide uppercase">
          Responsável pela bateria
        </p>
        {responsavel ? (
          <p className="text-ink text-sm">
            <span className="font-medium">{responsavel.nome}</span>{" "}
            <span className="text-ink-3">
              · cadastro nº {responsavel.numero} · {responsavel.telefone}
            </span>
          </p>
        ) : (
          <p className="text-ink-2 text-sm">
            Ainda não definido. Busque o cadastro abaixo (botão “É o
            responsável”) ou cadastre um piloto marcando que ele é o
            responsável.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink-2 text-sm">
          {comCadastro === 0
            ? "Nenhum piloto cadastrado ainda."
            : `${assinados} de ${grid.length} termos assinados.`}
        </p>
        {comCadastro > 0 ? (
          <a
            href="/admin/cronometragem/termos"
            className="text-orange-ink text-sm font-medium hover:underline"
          >
            Termos (QR e link)
          </a>
        ) : null}
      </div>

      {podeEditar ? (
        <div className="border-border flex flex-col gap-3 rounded-md border px-4 py-4">
          <h3 className="text-ink text-sm font-semibold">Adicionar piloto</h3>
          <FormAcao action={cadastrarPilotoAction} rotulo="Adicionar">
            <input type="hidden" name="corridaId" value={corridaId} />
            <CamposDoCadastro sufixo="novo" />
          </FormAcao>
          <p className="text-ink-3 text-xs">
            O primeiro piloto cadastrado vira o responsável da bateria
            {avulsa ? "" : " (a reserva já traz o dela)"}. Cada piloto recebe o
            termo para assinar depois.
          </p>
          <details open={Boolean(busca)}>
            <summary className="text-ink-2 cursor-pointer text-sm font-medium">
              Já tem cadastro? Buscar por número, nome ou telefone
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <form method="get" className="flex gap-2">
                <input
                  name="busca"
                  defaultValue={busca}
                  aria-label="Buscar cadastro"
                  placeholder="Ex.: 12, Ana ou 11 99999"
                  className={CLASSE_CAMPO}
                />
                <button
                  type="submit"
                  className="border-border-strong text-ink hover:bg-ink/5 rounded-md border px-4 py-2 text-sm font-medium"
                >
                  Buscar
                </button>
              </form>
              {busca ? (
                resultados.length === 0 ? (
                  <p className="text-ink-3 text-sm">
                    Nenhum cadastro encontrado. Use o cadastro abaixo.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {resultados.map((c) => (
                      <li
                        key={c.id}
                        className="border-border flex flex-col gap-2 rounded-md border px-3 py-2"
                      >
                        <p className="text-ink text-sm">
                          <span className="text-ink-3 font-mono">
                            nº {c.numero}
                          </span>{" "}
                          <span className="font-medium">{c.nome}</span>{" "}
                          <span className="text-ink-3 text-xs">
                            {c.telefone}
                          </span>
                        </p>
                        {noGrid.has(c.id) ? (
                          <p className="text-ink-3 text-xs">
                            Já está na bateria.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <FormAcao
                              action={cadastrarPilotoAction}
                              rotulo="Adicionar piloto"
                              variante="secondary"
                            >
                              <input
                                type="hidden"
                                name="corridaId"
                                value={corridaId}
                              />
                              <input
                                type="hidden"
                                name="clienteId"
                                value={c.id}
                              />
                            </FormAcao>
                            <FormAcao
                              action={definirResponsavelAction}
                              rotulo="É o responsável"
                              variante="ghost"
                            >
                              <input
                                type="hidden"
                                name="corridaId"
                                value={corridaId}
                              />
                              <input
                                type="hidden"
                                name="clienteId"
                                value={c.id}
                              />
                            </FormAcao>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          </details>
        </div>
      ) : null}

      {podeSortear && grid.some((p) => !p.vaga) ? (
        <div className="border-border flex flex-col gap-3 rounded-md border px-4 py-4">
          <div>
            <h3 className="text-ink text-sm font-semibold">
              Sorteio dos karts
            </h3>
            <p className="text-ink-3 text-xs">
              Cada piloto recebe um kart disponível (ativo e com sensor). O
              sensor já está no kart, então o piloto fica ligado a ele.{" "}
              {comKart > 0
                ? `${comKart} piloto(s) já com kart.`
                : "Ninguém tem kart ainda."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {semKart > 0 ? (
              <FormAcao
                action={sortearKartsAction}
                rotulo={`Sortear karts (${semKart})`}
              >
                <input type="hidden" name="corridaId" value={corridaId} />
              </FormAcao>
            ) : null}
            {comKart > 0 ? (
              <FormAcao
                action={sortearKartsAction}
                rotulo="Refazer o sorteio"
                variante="secondary"
              >
                <input type="hidden" name="corridaId" value={corridaId} />
                <input type="hidden" name="refazer" value="1" />
              </FormAcao>
            ) : null}
          </div>
        </div>
      ) : null}

      {grid.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {grid.map((p) => (
            <li
              key={p.id}
              className="border-border bg-surface flex flex-col gap-2 rounded-md border px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-ink text-sm font-medium">
                    {p.clienteNumero ? (
                      <span className="text-ink-3 font-mono">
                        nº {p.clienteNumero}
                      </span>
                    ) : null}{" "}
                    {p.nome}
                    {p.clienteId && p.clienteId === responsavel?.id ? (
                      <span className="text-ink-3 text-xs"> · responsável</span>
                    ) : null}
                  </p>
                  {p.kartNumero ? (
                    <p className="text-ink-2 text-xs font-medium">
                      Kart {p.kartNumero}
                      {p.transponder ? (
                        <span className="text-ink-3 font-mono font-normal">
                          {" "}
                          · sensor {p.transponder}
                        </span>
                      ) : null}
                    </p>
                  ) : !p.vaga ? (
                    <p className="text-ink-3 text-xs">Sem kart ainda</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {p.posicaoGrid ? (
                    <StatusPill tone="neutral">
                      Larga em {p.posicaoGrid}º
                    </StatusPill>
                  ) : null}
                  <SituacaoDoTermo piloto={p} />
                  {!p.vaga && p.presenteEm ? (
                    <StatusPill tone="ink">Presente</StatusPill>
                  ) : null}
                  <ChipPagamento pagamento={p.pagamento} />
                  {!p.vaga && podeEditar ? (
                    <FormAcao
                      action={registrarPresencaAction}
                      rotulo={p.presenteEm ? "Desfazer check-in" : "Check-in"}
                      variante={p.presenteEm ? "ghost" : "secondary"}
                    >
                      <input type="hidden" name="pilotoId" value={p.id} />
                      <input
                        type="hidden"
                        name="presente"
                        value={p.presenteEm ? "0" : "1"}
                      />
                    </FormAcao>
                  ) : null}
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
              </div>
              {podeReceber && p.reservaId && p.reservaPilotoId ? (
                <ReceberDoPiloto
                  reservaId={p.reservaId}
                  reservaPilotoId={p.reservaPilotoId}
                  pagamento={p.pagamento}
                  caixaEstaAberto={caixaEstaAberto}
                />
              ) : null}
              {p.vaga && podeEditar ? (
                <details>
                  <summary className="text-orange-ink cursor-pointer text-sm font-medium">
                    Cadastrar o piloto desta vaga
                  </summary>
                  <FormAcao
                    action={cadastrarPilotoAction}
                    rotulo="Cadastrar na vaga"
                    className="mt-3"
                  >
                    <input type="hidden" name="corridaId" value={corridaId} />
                    <input type="hidden" name="vagaId" value={p.id} />
                    <CamposDoCadastro sufixo={p.id} />
                  </FormAcao>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
