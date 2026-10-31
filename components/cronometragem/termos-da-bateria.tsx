import { StatusPill } from "@/components/ui/status-pill";
import type { TermoDoPiloto } from "@/lib/cronometragem/termos-da-bateria";
import { formatarDataHora } from "@/lib/operacao/tempo";
import { linkWhatsApp } from "@/lib/operacao/whatsapp";

// Os termos da bateria, na própria tela: cada piloto abre o link (ou lê o QR)
// no celular e assina. Fica à vista enquanto houver termo pendente.
export function TermosDaBateria({ itens }: { itens: TermoDoPiloto[] }) {
  if (itens.length === 0) return null;
  const pendentes = itens.filter((i) => !i.assinado);
  const assinados = itens.length - pendentes.length;

  return (
    <section
      id="termos"
      aria-label="Termos de responsabilidade"
      className="border-border bg-surface scroll-mt-6 rounded-lg border"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div>
          <h2 className="text-ink text-sm font-semibold">
            Termos para assinar
          </h2>
          <p className="text-ink-3 text-xs">
            {pendentes.length === 0
              ? "Todos os pilotos assinaram."
              : "Cada piloto lê o QR com o celular (ou abre o link) e assina com o dedo. A bateria só inicia com todos assinados."}
          </p>
        </div>
        <StatusPill tone={pendentes.length === 0 ? "ink" : "orange"}>
          {assinados} de {itens.length} assinados
        </StatusPill>
      </div>

      {pendentes.length > 0 ? (
        <ul className="divide-border border-border divide-y border-t">
          {pendentes.map((i) => (
            <li
              key={i.pilotoId}
              className="flex flex-wrap items-start gap-5 px-5 py-4"
            >
              {i.url && i.qr ? (
                <div
                  role="img"
                  aria-label={`QR do termo de ${i.nome}`}
                  className="size-36 shrink-0 rounded-md bg-white"
                  dangerouslySetInnerHTML={{ __html: i.qr }}
                />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <p className="text-ink text-sm font-medium">
                    {i.numero ? (
                      <span className="text-ink-3 font-mono">
                        nº {i.numero}
                      </span>
                    ) : null}{" "}
                    {i.nome}
                  </p>
                  <p className="text-ink-3 text-xs">{i.telefone}</p>
                </div>
                {i.url ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-ink text-bg inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
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
                        className="border-border-strong text-ink hover:bg-ink/5 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium"
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
                ) : (
                  <p className="text-ink-3 text-xs">
                    Preparando o link… atualize a página.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {assinados > 0 && pendentes.length > 0 ? (
        <p className="border-border text-ink-3 border-t px-5 py-3 text-xs">
          Já assinaram:{" "}
          {itens
            .filter((i) => i.assinado)
            .map((i) => i.nome)
            .join(", ")}
          .
        </p>
      ) : null}
    </section>
  );
}
