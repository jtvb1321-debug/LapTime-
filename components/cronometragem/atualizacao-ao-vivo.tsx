"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

// Atualização automática da tela ao vivo, com aviso quando a FONTE falha ou atrasa.
//
// A cada ciclo, a tela pergunta a uma sonda leve (/api/cronometragem/saude) se o servidor
// e o banco estão atendendo; só então recarrega os dados (router.refresh). Assim, numa
// falha temporária a classificação já exibida FICA na tela (se o recarregamento falhasse
// no meio, o Next reabriria a página inteira e a tabela sumiria).
//
// O aviso representa SÓ falha ou atraso da atualização: sonda sem resposta, atualização
// que não chega, ou rede do computador caída. NÃO usa a falta de novas passagens como sinal
// de desconexão (kart parado no box não passa pelo sensor); a comunicação com o decoder
// é confirmada à parte, pelo estado que o coletor reporta.
type Falha = "servidor" | "sessao" | "atrasada" | "rede" | null;

export function AtualizacaoAoVivo({
  agoraServidorMs,
  intervaloMs = 2000,
}: {
  // Relógio do SERVIDOR no momento em que estes dados foram gerados.
  agoraServidorMs: number;
  intervaloMs?: number;
}) {
  const router = useRouter();
  const limiteAtrasoMs = Math.max(8000, intervaloMs * 4);
  const chegada = useRef(0);
  const falhasSeguidas = useRef(0);
  const sessaoExpirada = useRef(false);
  const emVoo = useRef(false);
  // A atualização dos dados também não se sobrepõe: com o servidor mais lento que o intervalo,
  // pedidos novos substituiriam os anteriores e nenhum chegaria a ser aplicado.
  const [atualizando, iniciarAtualizacao] = useTransition();
  const atualizandoRef = useRef(false);
  const atualizacaoIniciadaEm = useRef(0);
  useEffect(() => {
    atualizandoRef.current = atualizando;
  }, [atualizando]);
  const [falha, setFalha] = useState<Falha>(null);
  const [atrasoMs, setAtrasoMs] = useState(0);
  const [recuperouEm, setRecuperouEm] = useState<number | null>(null);
  const tinhaFalha = useRef(false);
  const chegouDadoDepoisDaFalha = useRef(true);

  // Dados novos chegaram: zera o relógio de atraso. A recuperação só é anunciada quando uma
  // atualização REALMENTE chegou depois da falha (a sonda responder não basta).
  useEffect(() => {
    chegada.current = performance.now();
    chegouDadoDepoisDaFalha.current = true;
  }, [agoraServidorMs]);

  useEffect(() => {
    let vivo = true;

    const avaliar = () => {
      if (!vivo) return;
      const atraso =
        document.visibilityState === "visible"
          ? performance.now() - chegada.current
          : 0;
      setAtrasoMs(atraso);
      let nova: Falha = null;
      if (!navigator.onLine) nova = "rede";
      else if (sessaoExpirada.current) nova = "sessao";
      else if (falhasSeguidas.current >= 2) nova = "servidor";
      else if (atraso > limiteAtrasoMs) nova = "atrasada";
      // Houve falha e ainda não chegou dado novo: a fonte voltou a responder, mas a tela
      // continua com a classificação antiga, e isso é dito como atraso.
      else if (tinhaFalha.current && !chegouDadoDepoisDaFalha.current) {
        nova = "atrasada";
      }
      if (nova) {
        if (!tinhaFalha.current) chegouDadoDepoisDaFalha.current = false;
        tinhaFalha.current = true;
      } else if (tinhaFalha.current) {
        tinhaFalha.current = false;
        setRecuperouEm(Date.now());
      }
      setFalha(nova);
    };

    const ciclo = async () => {
      const atualizacaoEmAndamento =
        atualizandoRef.current &&
        performance.now() - atualizacaoIniciadaEm.current < 20_000;
      if (
        !vivo ||
        document.visibilityState !== "visible" ||
        emVoo.current ||
        atualizacaoEmAndamento
      ) {
        return;
      }
      if (!navigator.onLine) {
        avaliar();
        return;
      }
      emVoo.current = true;
      try {
        const ctl = new AbortController();
        const prazo = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch("/api/cronometragem/saude", {
          cache: "no-store",
          signal: ctl.signal,
        });
        clearTimeout(prazo);
        if (r.status === 403) {
          sessaoExpirada.current = true;
          falhasSeguidas.current = 0;
        } else if (r.ok) {
          sessaoExpirada.current = false;
          falhasSeguidas.current = 0;
          atualizacaoIniciadaEm.current = performance.now();
          atualizandoRef.current = true;
          iniciarAtualizacao(() => router.refresh());
        } else {
          falhasSeguidas.current += 1;
        }
      } catch {
        falhasSeguidas.current += 1;
      } finally {
        emVoo.current = false;
        avaliar();
      }
    };

    const aoVoltar = () => {
      // Aba escondida não atualiza: dá um novo prazo antes de avisar.
      if (document.visibilityState === "visible") {
        chegada.current = performance.now();
        void ciclo();
      }
    };

    const id = setInterval(() => void ciclo(), intervaloMs);
    const relogio = setInterval(avaliar, 1000);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", avaliar);
    window.addEventListener("offline", avaliar);
    return () => {
      vivo = false;
      clearInterval(id);
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", avaliar);
      window.removeEventListener("offline", avaliar);
    };
  }, [router, intervaloMs, limiteAtrasoMs, iniciarAtualizacao]);

  // O aviso de recuperação some sozinho.
  useEffect(() => {
    if (recuperouEm === null) return;
    const id = setTimeout(() => setRecuperouEm(null), 6000);
    return () => clearTimeout(id);
  }, [recuperouEm]);

  const hora = new Date(agoraServidorMs).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const segundos = Math.round(atrasoMs / 1000);
  const mensagem: Record<Exclude<Falha, null>, string> = {
    rede: "Sem conexão com a rede.",
    sessao: "Sua sessão expirou. Entre novamente para continuar atualizando.",
    servidor: "O servidor não está respondendo.",
    atrasada: `A atualização está atrasada (${segundos} s sem dados novos).`,
  };

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs" style={{ color: "var(--pw-dim)" }}>
        Tela atualizada às <span className="font-display">{hora}</span>
      </p>
      {falha ? (
        <p
          role="alert"
          data-frescor="atrasado"
          data-frescor-motivo={falha}
          className="rounded-sm px-2 py-1 text-xs font-semibold"
          style={{ background: "var(--pw-vermelho)", color: "#14171d" }}
        >
          {mensagem[falha]} Exibindo a última classificação conhecida (de {hora}
          ).
        </p>
      ) : recuperouEm !== null ? (
        <p
          role="status"
          data-frescor="recuperado"
          className="rounded-sm px-2 py-1 text-xs font-semibold"
          style={{ background: "var(--pw-verde)", color: "#14171d" }}
        >
          Atualização restabelecida.
        </p>
      ) : null}
    </div>
  );
}
