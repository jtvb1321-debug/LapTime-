import { Campo, FormAcao } from "@/components/operacao/form-acao";
import {
  ChipPagamento,
  ReceberDoPiloto,
} from "@/components/operacao/pagamento-do-piloto";
import { StatusPill } from "@/components/ui/status-pill";
import {
  cadastrarPilotoDaReservaAction,
  removerPilotoDaReservaAction,
} from "@/lib/operacao-actions";
import type { PilotoDaReserva } from "@/lib/operacao/reserva-pilotos-store";

// Pilotos de uma reserva: cada um com cadastro (número), termo e pagamento.
// O balcão cadastra quem ainda falta; na bateria eles já entram com o nome.
export function PilotosDaReserva({
  reservaId,
  total,
  pilotos,
  caixaEstaAberto,
}: {
  reservaId: string;
  total: number;
  pilotos: PilotoDaReserva[];
  caixaEstaAberto: boolean;
}) {
  const faltam = total - pilotos.length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-2 text-xs font-semibold tracking-wide uppercase">
        Pilotos ({pilotos.length} de {total})
      </p>
      {pilotos.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {pilotos.map((p) => (
            <li
              key={p.id}
              className="border-border flex flex-col gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink text-sm">
                  <span className="font-display text-ink-3 font-semibold">
                    nº {p.numero}
                  </span>{" "}
                  <span className="font-medium">{p.nome}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {p.termoValido ? (
                    <StatusPill tone="ink">Termo assinado</StatusPill>
                  ) : (
                    <StatusPill tone="orange">Termo pendente</StatusPill>
                  )}
                  <ChipPagamento pagamento={p.pagamento} />
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                <ReceberDoPiloto
                  reservaId={reservaId}
                  reservaPilotoId={p.id}
                  pagamento={p.pagamento}
                  caixaEstaAberto={caixaEstaAberto}
                />
                <details className="min-w-0">
                  <summary className="text-ink-3 cursor-pointer text-xs">
                    Tirar da reserva
                  </summary>
                  <FormAcao
                    action={removerPilotoDaReservaAction}
                    rotulo="Tirar piloto"
                    variante="ghost"
                    className="mt-2"
                  >
                    <input type="hidden" name="reservaPilotoId" value={p.id} />
                  </FormAcao>
                </details>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {faltam > 0 ? (
        <details className="min-w-0">
          <summary className="text-orange-ink cursor-pointer text-sm font-medium">
            Cadastrar piloto ({faltam} {faltam === 1 ? "falta" : "faltam"})
          </summary>
          <FormAcao
            action={cadastrarPilotoDaReservaAction}
            rotulo="Cadastrar piloto"
            className="mt-3 max-w-sm"
          >
            <input type="hidden" name="reservaId" value={reservaId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                id={`nome-${reservaId}`}
                name="nome"
                rotulo="Nome completo"
                maxLength={80}
              />
              <Campo
                id={`tel-${reservaId}`}
                name="telefone"
                rotulo="Telefone (WhatsApp)"
                inputMode="tel"
                placeholder="(11) 99999-0000"
              />
            </div>
            <details>
              <summary className="text-ink-3 cursor-pointer text-xs">
                Mais opções (já tem cadastro, nascimento)
              </summary>
              <div className="mt-2 flex flex-col gap-3">
                <Campo
                  id={`numero-${reservaId}`}
                  name="numeroCadastro"
                  rotulo="Já tem cadastro? Número do cadastro"
                  inputMode="numeric"
                  dica="Com o número, nome e telefone acima são ignorados."
                />
                <Campo
                  id={`nasc-${reservaId}`}
                  name="nascimento"
                  rotulo="Data de nascimento"
                  type="date"
                />
              </div>
            </details>
          </FormAcao>
        </details>
      ) : null}
    </div>
  );
}
