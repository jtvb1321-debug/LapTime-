import { Campo, FormAcao } from "@/components/operacao/form-acao";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  confirmarDecoderAction,
  criarPareamentoAction,
  esquecerDecoderAction,
  registrarBaseAction,
  revogarComputadorAction,
} from "@/lib/cadastros-cronometragem-actions";
import type {
  ComputadorDaPista,
  DispositivoVisto,
} from "@/lib/cronometragem/computadores-store";
import { agoraMs } from "@/lib/operacao/tempo";

function segundosAtras(data: Date | null): string {
  if (!data) return "nunca";
  const s = Math.max(0, Math.round((agoraMs() - data.getTime()) / 1000));
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  return `há ${Math.floor(s / 3600)} h`;
}

const ROTULO_TIPO = {
  usb: "USB",
  serial: "Porta serial",
  rede: "Rede",
  outro: "Outro",
};

function Linha({ d }: { d: DispositivoVisto }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
      <span className="text-ink">{d.nome}</span>
      <span className="text-ink-3 font-mono text-xs">{d.chave}</span>
    </li>
  );
}

function ComoPareia({
  url,
  podeAdministrar,
}: {
  url: string;
  podeAdministrar: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="text-ink-2 list-decimal space-y-2 pl-5 text-sm">
        <li>
          Copie o arquivo <code>GridLap-Agente.exe</code> para o computador
          ligado ao decoder (Windows). Não precisa instalar nada.
        </li>
        <li>
          Gere o código aqui embaixo, dê duplo clique no executável e responda o
          que ele perguntar: o endereço do sistema (
          <code className="break-all">{url}</code>) e o código.
        </li>
        <li>
          Deixe a janela aberta (ou aceite iniciar junto com o Windows) e
          conecte o decoder: ele aparece aqui sozinho.
        </li>
      </ol>
      <p className="text-ink-3 text-xs">
        O executável é gerado no projeto com <code>npm run agente:exe</code>{" "}
        (fica em <code>coletor/dist</code>). Sem o executável:{" "}
        <code className="break-all">
          node coletor/agente.mjs parear CODIGO --servidor {url}
        </code>
        .
      </p>
      {podeAdministrar ? (
        <FormAcao
          action={criarPareamentoAction}
          rotulo="Gerar código de pareamento"
          variante="secondary"
          limpar={false}
        >
          <span />
        </FormAcao>
      ) : null}
    </div>
  );
}

function Computador({
  pc,
  podeAdministrar,
}: {
  pc: ComputadorDaPista;
  podeAdministrar: boolean;
}) {
  const reconhecidos = pc.dispositivos.filter((d) => d.decoder);
  const novos = pc.dispositivos.filter((d) => d.novo && !d.decoder);
  const fisicos = pc.dispositivos.filter(
    (d) => d.tipo !== "rede" && !d.novo && !d.decoder,
  );
  const rede = pc.dispositivos.filter(
    (d) => d.tipo === "rede" && !d.novo && !d.decoder,
  );

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-ink text-sm font-semibold">{pc.nome}</h3>
          <p className="text-ink-3 text-xs">
            {pc.sistema ? `${pc.sistema} · ` : ""}
            último contato {segundosAtras(pc.ultimoContato)}
            {pc.ultimoIp ? ` · ${pc.ultimoIp}` : ""}
          </p>
        </div>
        {pc.online ? (
          <StatusPill tone="ink">Agente conectado</StatusPill>
        ) : (
          <StatusPill tone="orange">Agente sem contato</StatusPill>
        )}
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        {reconhecidos.length > 0 ? (
          <div className="flex flex-col gap-2">
            {reconhecidos.map((d) => (
              <div
                key={d.chave}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
              >
                <div>
                  <p className="text-ink text-sm font-medium">
                    Decoder reconhecido: {d.decoder?.nome}
                  </p>
                  <p className="text-ink-3 text-xs">
                    {d.nome} · <span className="font-mono">{d.chave}</span>
                  </p>
                </div>
                <StatusPill tone="ink">Ligado neste computador</StatusPill>
                {podeAdministrar ? (
                  <FormAcao
                    action={esquecerDecoderAction}
                    rotulo="Esquecer"
                    variante="ghost"
                  >
                    <input type="hidden" name="chave" value={d.chave} />
                  </FormAcao>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {!pc.temBase ? (
          <div className="flex flex-col gap-2">
            <p className="text-ink-2 text-sm">
              Para o sistema achar o decoder sozinho:{" "}
              <b>desconecte o decoder</b> deste computador e clique abaixo.
              Depois conecte o decoder; ele aparece aqui em destaque.
            </p>
            {podeAdministrar ? (
              <FormAcao
                action={registrarBaseAction}
                rotulo="Registrar o que está ligado agora"
              >
                <input type="hidden" name="computadorId" value={pc.id} />
              </FormAcao>
            ) : null}
          </div>
        ) : novos.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-ink text-sm font-semibold">
              Apareceu depois do registro ({novos.length}):
            </p>
            {novos.map((d) => (
              <div
                key={d.chave}
                className="border-orange/40 bg-orange/5 flex flex-col gap-3 rounded-md border px-4 py-3"
              >
                <div>
                  <p className="text-ink text-sm font-medium">
                    {d.nome}{" "}
                    <span className="text-ink-3 text-xs">
                      ({ROTULO_TIPO[d.tipo]})
                    </span>
                  </p>
                  <p className="text-ink-3 font-mono text-xs">{d.chave}</p>
                </div>
                {podeAdministrar ? (
                  <FormAcao
                    action={confirmarDecoderAction}
                    rotulo="Este é o decoder"
                  >
                    <input type="hidden" name="computadorId" value={pc.id} />
                    <input type="hidden" name="chave" value={d.chave} />
                    <Campo
                      id={`nome-decoder-${pc.id}-${d.chave}`}
                      name="nome"
                      rotulo="Nome do decoder"
                      defaultValue="CalX Pro"
                      required
                      minLength={2}
                      maxLength={80}
                    />
                  </FormAcao>
                ) : null}
              </div>
            ))}
          </div>
        ) : reconhecidos.length === 0 ? (
          <p className="text-ink-2 text-sm">
            Aguardando: conecte o decoder a este computador. Se ele não aparecer
            em alguns segundos, confira o cabo, a energia do decoder e se o
            driver foi instalado.
          </p>
        ) : null}

        {fisicos.length > 0 ? (
          <details>
            <summary className="text-ink-2 cursor-pointer text-sm font-medium">
              USB e portas seriais já ligados ({fisicos.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {fisicos.map((d) => (
                <Linha key={d.chave} d={d} />
              ))}
            </ul>
          </details>
        ) : null}
        {rede.length > 0 ? (
          <details>
            <summary className="text-ink-2 cursor-pointer text-sm font-medium">
              Aparelhos vistos na rede ({rede.length})
            </summary>
            <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
              {rede.map((d) => (
                <Linha key={d.chave} d={d} />
              ))}
            </ul>
          </details>
        ) : null}

        {podeAdministrar ? (
          <div className="border-border flex flex-wrap gap-3 border-t pt-4">
            {pc.temBase ? (
              <FormAcao
                action={registrarBaseAction}
                rotulo="Refazer o registro do que está ligado"
                variante="secondary"
              >
                <input type="hidden" name="computadorId" value={pc.id} />
              </FormAcao>
            ) : null}
            <FormAcao
              action={revogarComputadorAction}
              rotulo="Desligar este computador do sistema"
              variante="ghost"
            >
              <input type="hidden" name="computadorId" value={pc.id} />
            </FormAcao>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

// "Computador da pista": o agente instalado nele avisa o que está ligado; o
// decoder aparece sozinho quando é conectado. Só observa; o protocolo do
// decoder continua sendo outro assunto (veja docs/cronometragem.md).
export function ComputadorDaPistaSecao({
  computadores,
  podeAdministrar,
  urlDoSistema,
}: {
  computadores: ComputadorDaPista[];
  podeAdministrar: boolean;
  urlDoSistema: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-ink text-sm font-semibold">Computador da pista</h2>
      {computadores.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <p className="text-ink-2 text-sm">
              Ligue o computador do decoder ao sistema uma única vez. Depois
              disso, tudo que for conectado nele aparece aqui sozinho, e o
              decoder é reconhecido assim que for plugado.
            </p>
            <ComoPareia url={urlDoSistema} podeAdministrar={podeAdministrar} />
          </CardBody>
        </Card>
      ) : (
        <>
          {computadores.map((pc) => (
            <Computador key={pc.id} pc={pc} podeAdministrar={podeAdministrar} />
          ))}
          {podeAdministrar ? (
            <details className="border-border bg-surface rounded-lg border px-5 py-4">
              <summary className="text-ink cursor-pointer text-sm font-semibold">
                Ligar outro computador
              </summary>
              <div className="mt-3">
                <ComoPareia url={urlDoSistema} podeAdministrar />
              </div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
