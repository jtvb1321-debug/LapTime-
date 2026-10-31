import { describe, expect, it } from "vitest";
import { ipDoCliente } from "@/lib/ip";

const de = (h: Record<string, string>) => (n: string) => h[n] ?? null;

describe("ipDoCliente", () => {
  it("prefere o CF-Connecting-IP da Cloudflare", () => {
    expect(
      ipDoCliente(
        de({ "cf-connecting-ip": "200.1.1.1", "x-forwarded-for": "9.9.9.9" }),
      ),
    ).toBe("200.1.1.1");
  });
  it("sem Cloudflare usa o primeiro do X-Forwarded-For, depois o X-Real-IP", () => {
    expect(ipDoCliente(de({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
    expect(ipDoCliente(de({ "x-real-ip": "7.7.7.7" }))).toBe("7.7.7.7");
  });
  it("sem nenhum cabeçalho (ou vazios) devolve null", () => {
    expect(ipDoCliente(de({}))).toBeNull();
    expect(ipDoCliente(de({ "cf-connecting-ip": "  " }))).toBeNull();
  });
});
