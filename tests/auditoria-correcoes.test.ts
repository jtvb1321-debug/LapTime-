import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  corValida,
  erroDoCadastro,
  limparTexto,
  type DadosDoCadastro,
} from "@/lib/cadastro-validacao";
import { listarTransponders } from "@/lib/cronometragem/cadastros-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { destinoSeguro } from "@/lib/destino-seguro";
import { validarPatrocinadores } from "@/lib/patrocinadores-store";
import { agendarBateria } from "@/lib/operacao/agenda-store";
import {
  buscarClientes,
  criarCliente,
  listarClientesComResumo,
  obterOuCriarCliente,
} from "@/lib/operacao/clientes-store";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

describe("destino depois do login (redirecionamento aberto)", () => {
  it("aceita só caminhos internos", () => {
    for (const ok of [
      "/",
      "/admin/balcao",
      "/admin/x?a=1&b=2",
      "/area-do-piloto",
    ]) {
      expect(destinoSeguro(ok)).toBe(ok);
    }
  });

  it("recusa o que o navegador levaria para outro site", () => {
    const ruins = [
      "//exemplo.com",
      "/\\exemplo.com",
      "/\\\\exemplo.com",
      "https://exemplo.com",
      "http://exemplo.com/x",
      "javascript:alert(1)",
      "exemplo.com",
      "",
      "/ok\nLocation: https://exemplo.com",
      "/ok\u0000",
      "/" + "a".repeat(600),
    ];
    for (const ruim of ruins) expect(destinoSeguro(ruim)).toBe("/");
    expect(destinoSeguro("//x", "/admin")).toBe("/admin");
  });
});

describe("lista de patrocinadores (entrada da API)", () => {
  const ok = { id: "p1", nome: "Loja", ativo: true };

  it("aceita lista válida, com e sem logo", () => {
    const logo = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    expect(
      validarPatrocinadores([ok, { ...ok, id: "p2", logoUrl: logo }]),
    ).toEqual([ok, { ...ok, id: "p2", logoUrl: logo }]);
    expect(validarPatrocinadores([])).toEqual([]);
  });

  it("recusa em vez de quebrar (antes: erro 500)", () => {
    const erros: [unknown, RegExp][] = [
      [{ a: 1 }, /Lista inválida/],
      [[{}], /id inválido/],
      [[{ ...ok, ativo: "sim" }], /verdadeiro ou falso/],
      [[{ ...ok, nome: {} }], /nome/],
      [[{ ...ok, nome: "x".repeat(121) }], /nome/],
      [[ok, ok], /repetido/],
      [[{ ...ok, logoUrl: "javascript:alert(1)" }], /logo/],
      [[{ ...ok, logoUrl: 5 }], /logo/],
      [[{ ...ok, logoUrl: "data:text/html;base64,PGgxPg==" }], /logo/],
      [
        Array.from({ length: 101 }, (_, i) => ({ ...ok, id: `p${i}` })),
        /No máximo 100/,
      ],
      [[null], /formato/],
    ];
    for (const [entrada, regex] of erros) {
      expect(() => validarPatrocinadores(entrada)).toThrow(regex);
    }
  });
});

describe("cadastro público de piloto", () => {
  const base: DadosDoCadastro = {
    nome: "Ana Souza",
    apelido: "Aninha",
    email: "ana@exemplo.com",
    senha: "senha-ok-123",
    idade: 25,
    pesoKg: 70,
    fotoUrl: "",
  };

  it("aceita dados normais, com ou sem foto embutida", () => {
    expect(erroDoCadastro(base)).toBeNull();
    expect(
      erroDoCadastro({ ...base, fotoUrl: "data:image/jpeg;base64,/9j/4AAQ" }),
    ).toBeNull();
  });

  it("recusa o que antes passava", () => {
    const casos: [Partial<DadosDoCadastro>, RegExp][] = [
      [{ email: "abc" }, /e-mail/],
      [{ email: "a@b" }, /e-mail/],
      [{ email: "a b@c.com" }, /e-mail/],
      [{ idade: 9999 }, /idade/],
      [{ idade: 4 }, /idade/],
      [{ idade: 25.5 }, /idade/],
      [{ pesoKg: 1_000_000_000 }, /peso/],
      [{ pesoKg: 5 }, /peso/],
      [{ nome: "N".repeat(20000) }, /nome/],
      [{ apelido: "A".repeat(31) }, /apelido/],
      [{ senha: "12345" }, /senha/],
      [{ senha: "x".repeat(129) }, /senha/],
      [{ fotoUrl: "javascript:alert(1)" }, /Foto/],
      [{ fotoUrl: "https://exemplo.com/foto.png" }, /Foto/],
      [{ fotoUrl: "data:text/html;base64,PGgxPg==" }, /Foto/],
      [{ fotoUrl: "data:image/jpeg;base64," + "A".repeat(800_000) }, /Foto/],
    ];
    for (const [alteracao, regex] of casos) {
      expect(erroDoCadastro({ ...base, ...alteracao })).toMatch(regex);
    }
  });

  it("tira caracteres de controle e valida cores", () => {
    expect(limparTexto("  Ana\u0000 \u0007Souza\n ")).toBe("Ana Souza");
    expect(limparTexto(null)).toBe("");
    expect(corValida("#a1B2c3", "#000000")).toBe("#a1B2c3");
    expect(corValida("red;position:fixed", "#000000")).toBe("#000000");
    expect(corValida("url(javascript:alert(1))", "#111111")).toBe("#111111");
  });
});

describe.skipIf(!temBancoDeTeste)("correções que dependem do banco", () => {
  let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
  const ator = { usuarioId: "auditor-1" };

  async function erroDe(promessa: Promise<unknown>): Promise<string> {
    try {
      await promessa;
    } catch (erro) {
      return (erro as Error).message;
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

  it("agendar que falha não deixa horário vazio na agenda", async () => {
    const c = await obterOuCriarCliente(
      { nome: "Cliente Agenda", telefone: "11955550001" },
      ator,
    );
    const contar = async () =>
      (
        await consultar<{ n: number }>(
          "select count(*)::int n from bateria_slot",
        )
      )[0].n;

    // dia passado: recusa ANTES de criar o horário
    const ontem = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    expect(
      await erroDe(
        agendarBateria(
          {
            dia: ontem,
            hora: "10:00",
            clienteId: c.id,
            pilotos: 1,
            precoCentavos: 8000,
          },
          ator,
        ),
      ),
    ).toMatch(/já passou/);
    expect(await contar()).toBe(0);

    // lotação (13 > 12): o horário criado para a tentativa é desfeito
    const dia = new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(
      await erroDe(
        agendarBateria(
          {
            dia,
            hora: "11:00",
            clienteId: c.id,
            pilotos: 13,
            precoCentavos: 8000,
          },
          ator,
        ),
      ),
    ).toMatch(/restam|lotada/i);
    expect(await contar()).toBe(0);

    // sucesso mantém o horário; e um horário que já tinha reserva nunca é apagado
    await agendarBateria(
      { dia, hora: "11:00", clienteId: c.id, pilotos: 2, precoCentavos: 8000 },
      ator,
    );
    expect(await contar()).toBe(1);
    await erroDe(
      agendarBateria(
        { dia, hora: "11:00", clienteId: c.id, pilotos: 13 },
        ator,
      ),
    );
    expect(await contar()).toBe(1);
  });

  it("clientes: limites, texto limpo e busca sem derrubar o banco", async () => {
    expect(
      await erroDe(
        criarCliente({ nome: "X".repeat(121), telefone: "11955550002" }, ator),
      ),
    ).toMatch(/120 caracteres/);
    expect(
      await erroDe(
        criarCliente(
          {
            nome: "Cliente Doc",
            telefone: "11955550003",
            documento: "9".repeat(31),
          },
          ator,
        ),
      ),
    ).toMatch(/30 caracteres/);
    const limpo = await criarCliente(
      {
        nome: "Cliente\u0000 Limpo",
        telefone: "11955550004",
        documento: "12\u00003",
      },
      ator,
    );
    expect(limpo.nome).toBe("Cliente Limpo");
    expect(limpo.documento).toBe("123");

    // o byte nulo na busca causava erro 500 (antes: "invalid byte sequence")
    expect(await buscarClientes("\u0000")).toEqual([]);
    expect(
      (await buscarClientes("Cli\u0000ente")).map((x) => x.nome),
    ).toContain("Cliente Limpo");
    await expect(listarClientesComResumo("a\u0000b")).resolves.toBeDefined();
    await expect(listarTransponders("x\u0000y")).resolves.toEqual([]);
    // busca com aspas e curingas não quebra
    await expect(buscarClientes("' OR x=x; --")).resolves.toEqual([]);
    await expect(buscarClientes("%".repeat(500))).resolves.toBeDefined();
  });
});
