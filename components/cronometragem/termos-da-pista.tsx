import { FormAcao } from "@/components/operacao/form-acao";
import { StatusPill } from "@/components/ui/status-pill";
import { gerarLinkDoTermoAction } from "@/lib/corrida-actions";
import type { TermoDoCliente } from "@/lib/cronometragem/termos-da-pista";
import { formatarDataHora } from "@/lib/operacao/tempo";
import { linkWhatsApp } from "@/lib/operacao/whatsapp";

const SITUACAO = {
  valido: { rotulo: "Assinado", tom: "success" as const },
  pendente: { rotulo: "Falta assinar", tom: "orange" as const },
  vencido: { rotulo: "Vencido: assinar de novo", tom: "orange" as const },
  desatualizado: {
    rotulo: "Termo novo: assinar de novo",
    tom: "orange" as const,
  },
};

// Uma linha por piloto do cadastro: situação do termo e, para quem precisa assinar, o QR, o link
// e o envio por WhatsApp. Quem já assinou só mostra a data.
export function TermosDaPista({
  itens,
  vazio,
  podeOperar,
}: {
  itens: TermoDoCliente[];
  vazio: string;
  podeOperar: boolean;
}) {
  if (itens.length === 0) {
    return <p className="text-ink-2 text-sm">{vazio}</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {itens.map((i) => {
        const s = SITUACAO[i.situacao];
        const precisa = i.situacao !== "valido";
        return (
          <li
            key={i.clienteId}
            className="flex flex-wrap items-start gap-5 py-4 first:pt-0 last:pb-0"
          >
            {precisa && i.url && i.qr ? (
              <div
                role="img"
                aria-label={`QR do termo de ${i.nome}`}
                className="size-36 shrink-0 rounded-md bg-white"
                dangerouslySetInnerHTML={{ __html: i.qr }}
              />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink text-base font-semibold">
                  <span className="font-display text-ink-3 mr-2 text-sm">
                    nº {i.numero}
                  </span>
                  {i.nome}
                  {i.apelido ? (
                    <span className="text-ink-2 font-normal">
                      {" "}
                      · {i.apelido}
                    </span>
                  ) : null}
                </p>
                <StatusPill tone={s.tom}>{s.rotulo}</StatusPill>
              </div>
              <p className="text-ink-3 text-xs">
                {i.telefone}
                {i.assinadoEm
                  ? ` · último termo em ${formatarDataHora(i.assinadoEm)}`
                  : ""}
              </p>
              {precisa ? (
                i.url ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-ink text-bg inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium"
                      >
                        Assinar aqui (nesta tela)
                      </a>
                      <a
                        href={linkWhatsApp(
                          i.telefone,
                          `Olá, ${i.nome}! Para pilotar no Grid Lap, leia e assine o termo de responsabilidade: ${i.url}`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="border-border-strong text-ink hover:bg-ink/5 inline-flex min-h-11 items-center rounded-md border px-4 py-2 text-sm font-medium"
                      >
                        Enviar por WhatsApp
                      </a>
                    </div>
                    <p className="text-ink-3 text-xs break-all">
                      {i.url}
                      {i.expiraEm
                        ? ` · vale até ${formatarDataHora(i.expiraEm)}`
                        : ""}
                    </p>
                  </>
                ) : podeOperar ? (
                  <FormAcao
                    action={gerarLinkDoTermoAction}
                    rotulo="Gerar link do termo"
                    variante="secondary"
                    className="max-w-xs"
                    limpar={false}
                  >
                    <input type="hidden" name="clienteId" value={i.clienteId} />
                  </FormAcao>
                ) : (
                  <p className="text-ink-3 text-xs">
                    Peça a quem opera a bateria para gerar o link.
                  </p>
                )
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
