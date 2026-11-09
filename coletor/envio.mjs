import {
  appendFileSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

// Entrega as passagens ao sistema. Toda passagem é anotada num arquivo de fila
// ANTES de ser enviada e só sai de lá quando o sistema confirma — se a rede
// ou o servidor cair no meio de uma corrida, nada se perde: o coletor reenvia
// quando voltar (o sistema ignora repetidas).
//
// Também informa ao sistema o ESTADO da ligação com o decoder (conectado ou
// não, último erro) e os eventos de conexão, num batimento periódico — assim
// o painel distingue "coletor offline" de "decoder desconectado".
/**
 * @param {{
 *   servidor: string,
 *   token: string,
 *   arquivoFila?: string | null,
 *   log: (mensagem: string) => void,
 *   tamanhoLote?: number,
 *   intervaloMs?: number,
 *   batimentoMs?: number,
 *   esperaInicialMs?: number,
 * }} opcoes
 */
export function criarEnvio({
  servidor,
  token,
  arquivoFila = null,
  log,
  tamanhoLote = 100,
  intervaloMs = 500,
  batimentoMs = 10_000,
  esperaInicialMs = 1000,
}) {
  const url = `${servidor.replace(/\/+$/, "")}/api/cronometragem/passagens`;
  let pendentes = [];
  let eventos = [
    { tipo: "coletor_iniciado", detalhe: null, instanteMs: Date.now() },
  ];
  let conectado = false;
  let ultimoErro = null;
  let infoDoDriver = null;
  let enviando = false;
  let ultimoEnvio = 0;
  let espera = 0;
  let proximaTentativa = 0;
  let avisouToken = false;

  if (arquivoFila && existsSync(arquivoFila)) {
    pendentes = readFileSync(arquivoFila, "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((linha) => {
        try {
          return [JSON.parse(linha)];
        } catch {
          return [];
        }
      });
    if (pendentes.length) {
      log(`${pendentes.length} passagem(ns) pendente(s) de antes.`);
    }
  }

  function regravarFila() {
    if (!arquivoFila) return;
    if (pendentes.length === 0) {
      if (existsSync(arquivoFila)) unlinkSync(arquivoFila);
      return;
    }
    const temporario = `${arquivoFila}.tmp`;
    writeFileSync(
      temporario,
      pendentes.map((p) => JSON.stringify(p)).join("\n") + "\n",
    );
    renameSync(temporario, arquivoFila);
  }

  function emitir(passagem) {
    const normal = {
      transponder: String(passagem.transponder),
      instanteMs: passagem.instanteMs ?? Date.now(),
      relogio: passagem.instanteMs === undefined ? "coletor" : "decoder",
      forca: passagem.forca ?? null,
      bruto: passagem.bruto ?? null,
      eventoExterno: passagem.eventoExterno ?? null,
    };
    pendentes.push(normal);
    if (arquivoFila) appendFileSync(arquivoFila, JSON.stringify(normal) + "\n");
  }

  function registrarEvento(tipo, detalhe = null) {
    eventos.push({ tipo, detalhe, instanteMs: Date.now() });
    if (eventos.length > 50) eventos = eventos.slice(-50);
  }

  async function enviar(lote, eventosDoLote) {
    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        passagens: lote,
        estado: {
          conectado,
          erro: ultimoErro ?? undefined,
          info: infoDoDriver ?? undefined,
        },
        eventos: eventosDoLote,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  }

  async function ciclo() {
    if (enviando || Date.now() < proximaTentativa) return;
    const precisaBatimento = Date.now() - ultimoEnvio >= batimentoMs;
    if (pendentes.length === 0 && eventos.length === 0 && !precisaBatimento) {
      return;
    }
    enviando = true;
    const lote = pendentes.slice(0, tamanhoLote);
    const eventosDoLote = eventos.slice();
    try {
      const resposta = await enviar(lote, eventosDoLote);
      if (resposta.ok) {
        const r = await resposta.json().catch(() => ({}));
        pendentes = pendentes.slice(lote.length);
        eventos = eventos.slice(eventosDoLote.length);
        ultimoErro = null;
        regravarFila();
        ultimoEnvio = Date.now();
        espera = 0;
        avisouToken = false;
        if (lote.length) {
          log(
            `enviadas ${lote.length} (novas ${r.gravadas ?? "?"}, repetidas ${r.repetidas ?? "?"}` +
              `${r.rejeitadas ? `, rejeitadas ${r.rejeitadas}: ${r.motivoRejeicao}` : ""}).`,
          );
        }
      } else if (resposta.status === 401) {
        if (!avisouToken) {
          log("token recusado pelo sistema — confira o token do decoder.");
        }
        avisouToken = true;
        espera = 30_000;
      } else if (resposta.status === 400 || resposta.status === 413) {
        // Lote que o sistema nunca vai aceitar: descarta pra não travar a fila.
        const r = await resposta.json().catch(() => ({}));
        log(
          `lote recusado (${resposta.status}): ${r.erro ?? "sem detalhe"}; descartado.`,
        );
        pendentes = pendentes.slice(lote.length);
        eventos = eventos.slice(eventosDoLote.length);
        regravarFila();
      } else {
        throw new Error(`HTTP ${resposta.status}`);
      }
    } catch (erro) {
      espera = Math.min((espera || esperaInicialMs) * 2, 30_000);
      log(
        `sem conexão com o sistema (${erro.message}); tentando de novo em ${espera / 1000}s.`,
      );
    } finally {
      proximaTentativa = Date.now() + espera;
      enviando = false;
    }
  }

  const timer = setInterval(ciclo, intervaloMs);

  return {
    emitir,
    // O driver avisa quando a ligação com o decoder sobe ou cai.
    conectado(valor) {
      const novo = Boolean(valor);
      if (novo !== conectado) {
        registrarEvento(novo ? "conectado" : "desconectado");
      }
      conectado = novo;
    },
    // ...e quando acontece um erro de comunicação.
    erro(mensagem) {
      ultimoErro = String(mensagem).slice(0, 300);
      registrarEvento("erro", ultimoErro);
    },
    // Informações extras do driver (ex.: ruído da antena), mostradas na tela.
    info(valor) {
      infoDoDriver = valor;
    },
    pendentes: () => pendentes.length,
    async parar() {
      clearInterval(timer);
      // Última tentativa de esvaziar a fila.
      for (let i = 0; i < 5 && pendentes.length; i++) {
        proximaTentativa = 0;
        await ciclo();
      }
      if (pendentes.length) {
        log(
          `${pendentes.length} passagem(ns) ficaram na fila para o próximo início.`,
        );
      }
    },
  };
}
