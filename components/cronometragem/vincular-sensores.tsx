"use client";

import { useState } from "react";
import { FormAcao } from "@/components/operacao/form-acao";
import { vincularSensoresEmLoteAction } from "@/lib/cadastros-cronometragem-actions";
import {
  JANELA_DA_SUGESTAO_MS,
  sugerirNumeros,
  type KartDoLote,
} from "@/lib/cronometragem/vinculo-em-lote";

export interface SensorParaVincular {
  codigo: string;
  ultimaLeituraMs: number | null;
  lidoEm: string; // hora já formatada, ou "—"
  leituras: number;
}

// Karts de verdade mais os números já digitados na tela (para a sugestão não repetir número).
function kartsComDigitados(
  karts: KartDoLote[],
  valores: Record<string, string>,
): KartDoLote[] {
  const existentes = new Set(karts.map((k) => k.numero));
  const digitados = Object.entries(valores)
    .map(([codigo, numero]) => ({ codigo, numero: numero.trim() }))
    .filter((v) => v.numero);
  return [
    ...karts.map((k) => ({
      ...k,
      sensor: k.sensor ?? digitados.find((d) => d.numero === k.numero)?.codigo,
    })),
    ...digitados
      .filter((d) => !existentes.has(d.numero))
      .map((d) => ({
        id: `digitado-${d.codigo}`,
        numero: d.numero,
        sensor: d.codigo,
      })),
  ];
}

// Vínculo em lote: os sensores passam, cada leitura nova entra na lista já com o próximo número
// de kart (editável) e um botão grava todos. Campo vazio = sensor de reserva.
export function VincularSensores({
  sensores,
  karts,
  agoraMs,
}: {
  sensores: SensorParaVincular[];
  karts: KartDoLote[];
  agoraMs: number;
}) {
  // Os que já estavam na lista ao abrir a tela ficam em branco (reserva de antes); só o que for
  // lido com a tela aberta ganha número sozinho.
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(sensores.map((s) => [s.codigo, ""])),
  );
  const [conhecidos, setConhecidos] = useState(
    () => new Set(sensores.map((s) => s.codigo)),
  );
  // Os que já estavam sem kart quando a tela abriu (para separar a reserva antiga do que passa agora).
  const [iniciais] = useState(() => new Set(sensores.map((s) => s.codigo)));

  const novos = sensores.filter((s) => !conhecidos.has(s.codigo));
  if (novos.length > 0) {
    // Ajuste de estado durante a renderização (dado novo vindo do servidor), sem efeito.
    const sugestao = sugerirNumeros(
      novos,
      kartsComDigitados(karts, valores),
      agoraMs,
    );
    setConhecidos(new Set([...conhecidos, ...novos.map((s) => s.codigo)]));
    setValores({
      ...valores,
      ...Object.fromEntries(
        novos.map((s) => [s.codigo, sugestao.get(s.codigo) ?? ""]),
      ),
    });
  }

  function numerarEmSequencia() {
    const emBranco = sensores.filter((s) => !(valores[s.codigo] ?? "").trim());
    const sugestao = sugerirNumeros(
      emBranco,
      kartsComDigitados(karts, valores),
      agoraMs,
    );
    setValores({
      ...valores,
      ...Object.fromEntries(
        emBranco.map((s) => [s.codigo, sugestao.get(s.codigo) ?? ""]),
      ),
    });
  }

  if (sensores.length === 0) {
    return (
      <div className="bg-ink/5 flex items-center gap-3 rounded-lg p-4">
        <span
          aria-hidden="true"
          className="bg-orange size-3 shrink-0 animate-pulse rounded-full"
        />
        <p className="text-ink text-base font-semibold">
          Passe os sensores pela antena. Cada um aparece aqui assim que for
          lido.
        </p>
      </div>
    );
  }

  const comNumero = sensores.filter((s) => (valores[s.codigo] ?? "").trim());
  const ordenados = [...sensores].sort(
    (a, b) => (a.ultimaLeituraMs ?? 0) - (b.ultimaLeituraMs ?? 0),
  );
  // Em destaque: o que passou com a tela aberta ou há pouco. O resto é a reserva antiga, recolhida.
  const deAgora = (s: SensorParaVincular) =>
    !iniciais.has(s.codigo) ||
    (s.ultimaLeituraMs !== null &&
      agoraMs - s.ultimaLeituraMs <= JANELA_DA_SUGESTAO_MS);
  const recentes = ordenados.filter(deAgora);
  const antigos = ordenados.filter((s) => !deAgora(s));

  const item = (s: SensorParaVincular) => (
    <li
      key={s.codigo}
      className="border-border flex items-center justify-between gap-3 rounded-lg border p-3"
    >
      <div className="min-w-0">
        <p className="font-display text-ink text-xl font-semibold break-all">
          {s.codigo}
        </p>
        <p className="text-ink-3 text-xs">
          lido às {s.lidoEm} · {s.leituras} leitura(s)
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <label
          htmlFor={`kart-${s.codigo}`}
          className="text-ink-2 text-xs font-medium"
        >
          Kart
        </label>
        <input
          id={`kart-${s.codigo}`}
          name={`kart:${s.codigo}`}
          value={valores[s.codigo] ?? ""}
          onChange={(e) =>
            setValores({ ...valores, [s.codigo]: e.target.value })
          }
          inputMode="numeric"
          maxLength={12}
          placeholder="reserva"
          className="campo font-display w-24 text-center text-lg font-semibold"
        />
      </div>
    </li>
  );
  const grade = "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-2 text-sm">
        {recentes.length} sensor(es) lido(s) agora · {comNumero.length} com
        número · {sensores.length - comNumero.length} de reserva
      </p>
      <FormAcao
        action={vincularSensoresEmLoteAction}
        rotulo={`Vincular ${comNumero.length} sensor(es)`}
        limpar={false}
      >
        {recentes.length > 0 ? (
          <ul className={grade} aria-label="Sensores lidos agora">
            {recentes.map(item)}
          </ul>
        ) : (
          <p className="text-ink-2 text-sm">
            Nenhum sensor novo lido agora. Passe os sensores pela antena.
          </p>
        )}
        {antigos.length > 0 ? (
          <details>
            <summary className="text-orange-ink min-h-11 cursor-pointer py-2 text-sm font-medium">
              Sensores de reserva lidos antes ({antigos.length})
            </summary>
            <ul className={`${grade} mt-2`} aria-label="Sensores de reserva">
              {antigos.map(item)}
            </ul>
          </details>
        ) : null}
      </FormAcao>
      <button
        type="button"
        onClick={numerarEmSequencia}
        className="text-orange-ink min-h-11 self-start text-sm font-medium underline"
      >
        Numerar em sequência os que estão em branco
      </button>
    </div>
  );
}
