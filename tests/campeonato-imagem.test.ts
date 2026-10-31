import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  IMAGEM_MAX_BYTES,
  tipoDaImagem,
  validarImagem,
} from "@/lib/campeonato-imagem";
import {
  lerBytesDaImagem,
  lerImagemDoCampeonato,
  removerImagemDoCampeonato,
  salvarImagemDoCampeonato,
} from "@/lib/campeonato-imagem-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { campeonatos } from "@/lib/mock/data";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70]);
const WEBP = Uint8Array.from([
  ...Array.from("RIFF", (c) => c.charCodeAt(0)),
  0,
  0,
  0,
  0,
  ...Array.from("WEBP", (c) => c.charCodeAt(0)),
]);

describe("imagem do campeonato: validação", () => {
  it("reconhece o formato pelo conteúdo", () => {
    expect(tipoDaImagem(PNG)).toBe("image/png");
    expect(tipoDaImagem(JPG)).toBe("image/jpeg");
    expect(tipoDaImagem(WEBP)).toBe("image/webp");
    expect(tipoDaImagem(new TextEncoder().encode("<svg onload=x>"))).toBeNull();
    expect(tipoDaImagem(new TextEncoder().encode("GIF89a......"))).toBeNull();
  });

  it("recusa vazio, grande demais e formato errado; usa alt padrão", () => {
    expect(validarImagem(new Uint8Array(0), "", "Copa")).toMatchObject({
      ok: false,
    });
    const grande = new Uint8Array(IMAGEM_MAX_BYTES + 1);
    grande.set(PNG);
    expect(validarImagem(grande, "", "Copa")).toMatchObject({
      ok: false,
      erro: expect.stringMatching(/2 MB/),
    });
    expect(
      validarImagem(new TextEncoder().encode("texto qualquer"), "", "Copa"),
    ).toMatchObject({ ok: false, erro: expect.stringMatching(/JPG, PNG/) });
    expect(validarImagem(PNG, "  ", "Copa")).toEqual({
      ok: true,
      mime: "image/png",
      alt: "Imagem do campeonato Copa",
    });
    expect(validarImagem(PNG, "x".repeat(201), "Copa")).toMatchObject({
      ok: false,
    });
  });
});

describe.skipIf(!temBancoDeTeste)("imagem do campeonato: gravação", () => {
  let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
  const ator = { usuarioId: "admin-teste" };
  const id = campeonatos[0].id;

  async function erroDe(p: Promise<unknown>) {
    try {
      await p;
    } catch (e) {
      return (e as Error).message;
    }
    return "";
  }

  beforeAll(async () => {
    banco = await criarEsquemaDeTeste();
    await migrar();
  });
  afterAll(async () => {
    await banco.remover();
  });

  it("começa sem imagem; salva, substitui e remove com auditoria", async () => {
    expect(await lerImagemDoCampeonato(id)).toBeNull();
    await salvarImagemDoCampeonato(id, PNG, "Largada da Copa", ator);
    expect(await lerImagemDoCampeonato(id)).toMatchObject({
      mime: "image/png",
      alt: "Largada da Copa",
      tamanho: PNG.length,
    });
    await salvarImagemDoCampeonato(id, JPG, "", ator);
    const atual = await lerImagemDoCampeonato(id);
    expect(atual?.mime).toBe("image/jpeg");
    expect(atual?.alt).toMatch(/^Imagem do campeonato/);
    expect(Array.from((await lerBytesDaImagem(id))!.dados)).toEqual(
      Array.from(JPG),
    );
    await removerImagemDoCampeonato(id, ator);
    expect(await lerImagemDoCampeonato(id)).toBeNull();
    const acoes = await consultar<{ acao: string }>(
      "select acao from audit_log where entidade = 'campeonato' order by id",
    );
    expect(acoes.map((a) => a.acao)).toEqual([
      "campeonato.imagem_salvar",
      "campeonato.imagem_salvar",
      "campeonato.imagem_remover",
    ]);
  });

  it("não grava para campeonato inexistente nem arquivo inválido; uma imagem não vaza para outro id", async () => {
    expect(
      await erroDe(salvarImagemDoCampeonato("camp-outro", PNG, "", ator)),
    ).toMatch(/não encontrado/);
    expect(
      await erroDe(
        salvarImagemDoCampeonato(
          id,
          new TextEncoder().encode("<script>alert(1)</script>"),
          "",
          ator,
        ),
      ),
    ).toMatch(/JPG, PNG/);
    await salvarImagemDoCampeonato(id, WEBP, "Teste", ator);
    expect(await lerImagemDoCampeonato("camp-outro")).toBeNull();
    expect(await lerBytesDaImagem("camp-outro")).toBeNull();
  });
});
