"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alerta } from "@/components/ui/alerta";
import {
  buscarPilotosAction,
  pilotoDoKartAction,
  type PilotoEncontrado,
} from "@/lib/corrida-actions";

export interface KartPresente {
  kartId: string;
  numero: string;
  passouAs: string; // hora já formatada
}

// Um kart que passou pela antena e ainda não tem piloto: busca no cadastro e um toque resolve.
function KartSemPiloto({
  corridaId,
  kart,
}: {
  corridaId: string;
  kart: KartPresente;
}) {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<PilotoEncontrado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const pedido = useRef(0);

  function buscar(texto: string) {
    setTermo(texto);
    setErro(null);
    const meu = ++pedido.current;
    if (texto.trim().length < 2) {
      setAchados(null);
      return;
    }
    // Espera a digitação assentar; só vale a resposta do pedido mais recente.
    setTimeout(async () => {
      if (meu !== pedido.current) return;
      const lista = await buscarPilotosAction(texto);
      if (meu === pedido.current) setAchados(lista);
    }, 250);
  }

  function escolher(piloto: PilotoEncontrado) {
    iniciar(async () => {
      const dados = new FormData();
      dados.set("corridaId", corridaId);
      dados.set("kartId", kart.kartId);
      dados.set("clienteId", piloto.id);
      const r = await pilotoDoKartAction({}, dados);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setTermo("");
      setAchados(null);
      router.refresh();
    });
  }

  const idCampo = `piloto-do-kart-${kart.kartId}`;
  return (
    <li className="border-border flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <span className="bg-graphite font-display flex size-12 shrink-0 items-center justify-center rounded-md text-2xl font-bold text-white">
          {kart.numero}
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={idCampo} className="text-ink text-sm font-medium">
            Piloto do kart {kart.numero}
          </label>
          <p className="text-ink-3 text-xs">passou às {kart.passouAs}</p>
        </div>
      </div>
      <input
        id={idCampo}
        value={termo}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Nome, apelido ou nº do cadastro"
        autoComplete="off"
        disabled={pendente}
        className="campo w-full"
      />
      {erro ? <Alerta nivel="erro">{erro}</Alerta> : null}
      {achados ? (
        achados.length > 0 ? (
          <ul className="flex flex-col gap-1" aria-label="Pilotos encontrados">
            {achados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => escolher(p)}
                  className="border-border hover:border-orange hover:bg-orange/5 flex min-h-11 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm"
                >
                  <span className="text-ink min-w-0 truncate font-medium">
                    {p.nome}
                    {p.apelido ? (
                      <span className="text-ink-2 font-normal">
                        {" "}
                        · {p.apelido}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-display text-ink-3 shrink-0 text-sm">
                    nº {p.numero}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-2 text-xs">
            Ninguém com esse nome ou apelido. Cadastre o piloto em Clientes (com
            o termo assinado) e busque de novo.
          </p>
        )
      ) : null}
    </li>
  );
}

// Karts na pista antes da tomada de tempo: a primeira passagem só marca presença; nenhuma volta
// conta até a bateria ser iniciada.
export function KartsNaPista({
  corridaId,
  presentes,
  comPiloto,
}: {
  corridaId: string;
  presentes: KartPresente[];
  comPiloto: number;
}) {
  return (
    <section
      aria-labelledby="karts-na-pista"
      className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <div>
        <h2 id="karts-na-pista" className="text-ink text-base font-semibold">
          Karts na pista
        </h2>
        <p className="text-ink-3 text-xs">
          {comPiloto} kart(s) com piloto · {presentes.length} aguardando o nome
          do piloto. A primeira passagem só marca o kart na pista: as voltas
          começam a contar ao iniciar a tomada de tempo.
        </p>
      </div>
      {presentes.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {presentes.map((k) => (
            <KartSemPiloto key={k.kartId} corridaId={corridaId} kart={k} />
          ))}
        </ul>
      ) : (
        <div className="bg-ink/5 flex items-center gap-3 rounded-lg p-4">
          <span
            aria-hidden="true"
            className="bg-orange size-3 shrink-0 animate-pulse rounded-full"
          />
          <p className="text-ink text-sm font-medium">
            {comPiloto > 0
              ? "Todos os karts que passaram já têm piloto. Os próximos aparecem aqui ao passar."
              : "Mande os karts para a pista: cada um aparece aqui ao passar pela antena."}
          </p>
        </div>
      )}
    </section>
  );
}
