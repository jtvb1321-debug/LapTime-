"use client";

import { useCallback, useSyncExternalStore } from "react";

// Guarda os registros criados nas telas de admin (campeonatos, traçados etc.)
// no localStorage do navegador, já que ainda não existe Supabase — sem isso,
// tudo o que é criado some ao navegar pra outra página ou recarregar. Não é
// um banco de dados real (fica só nesse navegador), mas resolve o "sumiço".
//
// Usa useSyncExternalStore (em vez de useState+useEffect) porque é a forma
// segura de ler uma fonte externa síncrona sem gerar divergência entre o
// HTML do servidor e o do cliente, e sem disparar setState dentro de um
// efeito (o hook de lint deste projeto não deixa).
function nomeEvento(chave: string) {
  return `gridlap-mock-store:${chave}`;
}

export function useMockStore<T extends { id: string }>(
  chave: string,
  valoresIniciais: T[],
) {
  const inscrever = useCallback(
    (avisar: () => void) => {
      window.addEventListener(nomeEvento(chave), avisar);
      return () => window.removeEventListener(nomeEvento(chave), avisar);
    },
    [chave],
  );

  const obterSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(chave);
    } catch {
      return null;
    }
  }, [chave]);

  const obterSnapshotServidor = useCallback(() => null, []);

  const bruto = useSyncExternalStore(
    inscrever,
    obterSnapshot,
    obterSnapshotServidor,
  );

  let itens: T[] = valoresIniciais;
  if (bruto) {
    try {
      const analisados: T[] = JSON.parse(bruto);
      const porId = new Map(analisados.map((v) => [v.id, v]));
      // Item que já existia nos valores iniciais (ex.: um patrocinador
      // semeado em lib/mock/data.ts) usa a versão salva no localStorage se
      // houver uma — senão a edição feita nele (logo, status etc.) nunca
      // apareceria, porque a versão estática sempre "ganharia" do que foi
      // editado.
      itens = [
        ...valoresIniciais.map((v) => porId.get(v.id) ?? v),
        ...analisados.filter(
          (v) => !valoresIniciais.some((inicial) => inicial.id === v.id),
        ),
      ];
    } catch {
      itens = valoresIniciais;
    }
  }

  const definirItens = useCallback(
    (atualizador: T[] | ((anteriores: T[]) => T[])) => {
      const novo =
        typeof atualizador === "function"
          ? (atualizador as (anteriores: T[]) => T[])(itens)
          : atualizador;
      try {
        window.localStorage.setItem(chave, JSON.stringify(novo));
      } catch {
        // localStorage indisponível (modo privado etc.) — a mudança fica só
        // nesta renderização, sem persistir.
      }
      window.dispatchEvent(new Event(nomeEvento(chave)));
    },
    [chave, itens],
  );

  return [itens, definirItens] as const;
}
