import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { destinoComEntrada } from "@/lib/entrada";
import { confirmarEntrada } from "@/lib/entrada-cliente";

const resposta = (status: number) =>
  Promise.resolve(new Response("{}", { status }));

describe("animação de entrada: destinos", () => {
  it("só admin e área do piloto mostram a animação", () => {
    for (const d of [
      "/admin",
      "/admin/balcao",
      "/admin?x=1",
      "/area-do-piloto",
    ])
      expect(destinoComEntrada(d)).toBe(true);
    for (const d of ["/", "/inscricao", "/administrador", "//admin", "/login"])
      expect(destinoComEntrada(d)).toBe(false);
  });
});

describe("animação de entrada: confirmação no servidor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resposta rápida: espera só o tempo mínimo (1,5 s)", async () => {
    const fetcher = vi.fn(() => resposta(200)) as unknown as typeof fetch;
    let fim = false;
    const p = confirmarEntrada({ fetcher }).then((r) => {
      fim = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(1400);
    expect(fim).toBe(false);
    await vi.advanceTimersByTimeAsync(150);
    expect(await p).toBe("ok");
  });

  it("conexão lenta: não libera antes da resposta, sem atraso extra depois", async () => {
    let responder: (r: Response) => void = () => {};
    const fetcher = (() =>
      new Promise<Response>((r) => (responder = r))) as unknown as typeof fetch;
    let fim = false;
    const p = confirmarEntrada({ fetcher }).then((r) => {
      fim = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(fim).toBe(false);
    responder(new Response("{}", { status: 200 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(await p).toBe("ok");
  });

  it("sem sessão (401/403) devolve negado; falha de rede ou 500 devolve erro", async () => {
    const com = (f: () => Promise<Response>) =>
      confirmarEntrada({ fetcher: f as unknown as typeof fetch });
    for (const [f, esperado] of [
      [() => resposta(401), "negado"],
      [() => resposta(403), "negado"],
      [() => resposta(500), "erro"],
      [() => Promise.reject(new TypeError("rede")), "erro"],
    ] as const) {
      const p = com(f);
      await vi.advanceTimersByTimeAsync(1600);
      expect(await p).toBe(esperado);
    }
  });

  it("servidor que não responde: aborta no limite e devolve erro (nunca trava)", async () => {
    const fetcher = ((_: unknown, init?: RequestInit) =>
      new Promise((_r, rej) =>
        init?.signal?.addEventListener("abort", () =>
          rej(new DOMException("abortado", "AbortError")),
        ),
      )) as unknown as typeof fetch;
    const p = confirmarEntrada({ fetcher, limiteMs: 12_000 });
    await vi.advanceTimersByTimeAsync(12_100);
    expect(await p).toBe("erro");
  });
});
