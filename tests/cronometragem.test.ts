import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hostsDaFaixa, lerTabelaArp, varrer } from "../coletor/descoberta.mjs";
import {
  driver as linhasTcp,
  criarAnalisador,
} from "../coletor/drivers/linhas-tcp.mjs";
import { converterTempo } from "../coletor/drivers/tempo.mjs";
import { criarEnvio } from "../coletor/envio.mjs";
import { POST } from "@/app/api/cronometragem/passagens/route";
import { migrar } from "@/lib/db/migrar";
import { consultar } from "@/lib/db/conexao";
import {
  alternarDecoder,
  autenticarDecoder,
  criarDecoder,
  eventosDeConexao,
  listarDecoders,
  purgarDiagnosticos,
  registrarPassagens,
  ultimasPassagens,
  validarDiagnostico,
  validarPassagens,
} from "@/lib/cronometragem/decoders-store";
import { horaDoDiaParaMs } from "@/lib/cronometragem/horario";
import {
  formatarDuracao,
  formatarTempoVolta,
} from "@/lib/cronometragem/voltas";
import { pode } from "@/lib/permissoes";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

const AGORA = Date.now();

describe("formatação de tempos", () => {
  it("formata tempo de volta e duração", () => {
    expect(formatarTempoVolta(65_038)).toBe("1:05.038");
    expect(formatarTempoVolta(9_005)).toBe("0:09.005");
    expect(formatarDuracao(754_000)).toBe("12:34");
    expect(formatarDuracao(3_754_000)).toBe("1:02:34");
  });

  it("converte horário de Brasília digitado para milissegundos", () => {
    // 10:00:00.000 em Brasília = 13:00:00.000 UTC
    expect(horaDoDiaParaMs("2026-10-24", "10:00:00")).toBe(
      Date.UTC(2026, 9, 24, 13, 0, 0),
    );
    expect(horaDoDiaParaMs("2026-10-24", "10:00:52.38")).toBe(
      Date.UTC(2026, 9, 24, 13, 0, 52, 380),
    );
    expect(horaDoDiaParaMs("2026-10-24", "25:00:00")).toBeNull();
    expect(horaDoDiaParaMs("2026-10-24", "10:00")).toBeNull();
  });
});

describe("validação das passagens recebidas", () => {
  it("aceita passagens boas e devolve (com motivo) as ruins", () => {
    const { validas, rejeitadas } = validarPassagens([
      { transponder: "1312815", instanteMs: AGORA - 1000 },
      { transponder: "bad id!", instanteMs: AGORA },
      { transponder: "X1", instanteMs: "ontem" },
      { transponder: "X2", instanteMs: AGORA + 3_600_000 },
      { transponder: "X3", instanteMs: 5 },
      {
        transponder: "OK",
        instanteMs: AGORA,
        forca: 90,
        relogio: "coletor",
        eventoExterno: "abc-1",
      },
      null,
    ]);
    expect(validas.map((p) => p.transponder)).toEqual(["1312815", "OK"]);
    expect(validas[1]).toMatchObject({
      forca: 90,
      relogio: "coletor",
      eventoExterno: "abc-1",
    });
    expect(rejeitadas).toHaveLength(5);
    expect(rejeitadas.every((r) => r.motivo.length > 0)).toBe(true);
    expect(rejeitadas[1]).toMatchObject({
      transponder: "X1",
      motivo: "instante inválido",
    });
  });

  it("preserva zeros à esquerda e o formato exato do identificador", () => {
    const { validas } = validarPassagens([
      { transponder: "000123", instanteMs: AGORA },
      { transponder: "AB-0042_x", instanteMs: AGORA },
    ]);
    expect(validas.map((p) => p.transponder)).toEqual(["000123", "AB-0042_x"]);
  });

  it("recusa lote que não é lista ou é grande demais", () => {
    expect(() => validarPassagens("x")).toThrow();
    expect(() =>
      validarPassagens(
        Array.from({ length: 501 }, () => ({
          transponder: "A",
          instanteMs: AGORA,
        })),
      ),
    ).toThrow(/500/);
  });

  it("valida estado e eventos de conexão", () => {
    const { estado, eventos } = validarDiagnostico({
      estado: { conectado: true, erro: "x".repeat(500) },
      eventos: [
        { tipo: "desconectado", detalhe: "queda", instanteMs: AGORA - 5000 },
        { tipo: "inventado" },
        { tipo: "conectado", instanteMs: 5 },
      ],
    });
    expect(estado?.conectado).toBe(true);
    expect(estado?.erro).toHaveLength(300);
    expect(eventos.map((e) => e.tipo)).toEqual(["desconectado", "conectado"]);
    expect(eventos[1].ocorridoEmMs).toBeGreaterThan(AGORA - 1000);
  });
});

describe("permissões da cronometragem", () => {
  it("admin, fiscal e operador veem; recepção e piloto não", () => {
    expect(pode("admin", "cronometragem.ver")).toBe(true);
    expect(pode("fiscal", "cronometragem.ver")).toBe(true);
    expect(pode("operador", "cronometragem.ver")).toBe(true);
    expect(pode("recepcao", "cronometragem.ver")).toBe(false);
    expect(pode("piloto", "cronometragem.ver")).toBe(false);
  });

  it("só o administrador mexe em decoders, transponders e karts", () => {
    expect(pode("admin", "equipamento.administrar")).toBe(true);
    expect(pode("fiscal", "equipamento.administrar")).toBe(false);
    expect(pode("operador", "equipamento.administrar")).toBe(false);
  });

  it("corrigir resultado é do admin e do fiscal, não do operador", () => {
    expect(pode("fiscal", "resultado.corrigir")).toBe(true);
    expect(pode("operador", "resultado.corrigir")).toBe(false);
  });
});

describe("coletor: conversão de tempo e formato de linha", () => {
  it("converte as unidades de tempo", () => {
    expect(converterTempo("1761500000123", "ms")).toBe(1761500000123);
    expect(converterTempo("1761500000.123", "s")).toBeCloseTo(1761500000123, 0);
    expect(converterTempo("1761500000123456", "us")).toBeCloseTo(
      1761500000123.456,
      3,
    );
    expect(converterTempo("2026-10-24T15:55:01.123-03:00", "iso")).toBe(
      Date.parse("2026-10-24T18:55:01.123Z"),
    );
    expect(converterTempo("lixo", "ms")).toBeNull();
    expect(converterTempo("x", "desconhecida")).toBeNull();
  });

  it("hhmmss usa o dia de hoje (ou o de ontem logo após a meia-noite)", () => {
    const agora = new Date(2026, 9, 24, 0, 0, 30).getTime();
    expect(converterTempo("23:59:59.500", "hhmmss", agora)).toBe(
      new Date(2026, 9, 23, 23, 59, 59, 500).getTime(),
    );
    expect(converterTempo("00:00:10", "hhmmss", agora)).toBe(
      new Date(2026, 9, 24, 0, 0, 10).getTime(),
    );
  });

  it("interpreta linhas pelo formato configurado", () => {
    const analisar = criarAnalisador({
      formato: "(?<transponder>\\d+);(?<tempo>[\\d.]+);(?<forca>\\d+)",
      unidadeTempo: "s",
    });
    expect(analisar("1312815;1761500000.250;97")).toMatchObject({
      transponder: "1312815",
      forca: 97,
    });
    expect(analisar("1312815;1761500000.250;97")?.instanteMs).toBeCloseTo(
      1761500000250,
      0,
    );
    expect(analisar("ruído qualquer")).toBeNull();
  });

  it("preserva o identificador como texto (zeros à esquerda)", () => {
    const analisar = criarAnalisador({ formato: "(?<transponder>\\d+)" });
    expect(analisar("0001234")?.transponder).toBe("0001234");
  });

  it("exige o grupo transponder no formato", () => {
    expect(() => criarAnalisador({})).toThrow(/formato/);
    expect(() => criarAnalisador({ formato: "(\\d+)" })).toThrow(/transponder/);
  });
});

describe("coletor: busca na rede", () => {
  it("lê a tabela ARP do Windows e do Linux sem multicast/broadcast", () => {
    const windows = `
Interface: 169.254.38.2 --- 0x14
  Endereço IP           Endereço físico       Tipo
  169.254.255.255       ff-ff-ff-ff-ff-ff     estático
  224.0.0.22            01-00-5e-00-00-16     estático
  169.254.10.20         00-1a-2b-3c-4d-5e     dinâmico`;
    const linux = "? (192.168.1.1) at d8:9a:0d:0f:8a:17 [ether] on wlan0";
    expect(lerTabelaArp(windows)).toEqual([
      { ip: "169.254.10.20", mac: "00:1a:2b:3c:4d:5e" },
    ]);
    expect(lerTabelaArp(linux)).toEqual([
      { ip: "192.168.1.1", mac: "d8:9a:0d:0f:8a:17" },
    ]);
  });

  it("expande faixas e recusa faixas enormes", () => {
    const hosts = hostsDaFaixa("192.168.1.0/24");
    expect(hosts).toHaveLength(254);
    expect(hosts[0]).toBe("192.168.1.1");
    expect(hosts.at(-1)).toBe("192.168.1.254");
    expect(() => hostsDaFaixa("10.0.0.0/16")).toThrow();
    expect(() => hostsDaFaixa("lixo")).toThrow();
  });

  describe("com um decoder de mentira em TCP", () => {
    let servidor: net.Server;
    let porta = 0;
    let conexoes = 0;
    let derrubarNaPrimeira = false;
    const config = {
      formato: "(?<transponder>\\d+);(?<tempo>[\\d.]+)",
      unidadeTempo: "s",
    };

    beforeAll(async () => {
      servidor = net.createServer((socket) => {
        conexoes += 1;
        const numero = conexoes;
        // Decoder que "bipa" sozinho assim que alguém conecta.
        socket.write("1312815;1761500000.100\r\n1324824;1761500001.900\r\n");
        socket.on("error", () => undefined);
        // Queda de conexão simulada: encerra a primeira ligação.
        if (derrubarNaPrimeira && numero === 1) {
          setTimeout(() => socket.destroy(), 100);
        }
      });
      await new Promise<void>((resolve) =>
        servidor.listen(0, "127.0.0.1", resolve),
      );
      porta = (servidor.address() as net.AddressInfo).port;
    });
    afterAll(
      () => new Promise<void>((resolve) => servidor.close(() => resolve())),
    );

    it("encontra o aparelho e o driver o reconhece", async () => {
      const achados = await varrer({
        hosts: ["127.0.0.1"],
        portas: [porta, 1],
        escutaMs: 200,
        reconhecer: (bytes) =>
          linhasTcp.reconhece(bytes, config) ? linhasTcp : null,
      });
      expect(achados).toHaveLength(1);
      expect(achados[0]).toMatchObject({
        host: "127.0.0.1",
        porta,
        driver: "linhas-tcp",
      });
    });

    it("não reconhece sem o formato certo", async () => {
      const achados = await varrer({
        hosts: ["127.0.0.1"],
        portas: [porta],
        escutaMs: 200,
        reconhecer: (bytes) =>
          linhasTcp.reconhece(bytes, { formato: "(?<transponder>[a-z]+)@" })
            ? linhasTcp
            : null,
      });
      expect(achados[0].driver).toBeNull();
      expect(achados[0].bytes.length).toBeGreaterThan(0);
    });

    it("o driver lê as passagens enviadas pelo aparelho", async () => {
      conexoes = 0;
      derrubarNaPrimeira = false;
      const recebidas: Array<{ transponder: string; instanteMs?: number }> = [];
      const instancia = await linhasTcp.iniciar(
        { ...config, host: "127.0.0.1", porta },
        {
          emitir: (p: { transponder: string; instanteMs?: number }) =>
            recebidas.push(p),
          conectado: () => undefined,
          erro: () => undefined,
          log: () => undefined,
        },
      );
      await new Promise((r) => setTimeout(r, 300));
      instancia.parar();
      expect(recebidas.map((p) => p.transponder)).toEqual([
        "1312815",
        "1324824",
      ]);
      expect(recebidas[0].instanteMs).toBeCloseTo(1761500000100, 0);
    });

    it("reconecta depois de uma queda e avisa o estado da conexão", async () => {
      conexoes = 0;
      derrubarNaPrimeira = true;
      const estados: boolean[] = [];
      const recebidas: string[] = [];
      const instancia = await linhasTcp.iniciar(
        { ...config, host: "127.0.0.1", porta },
        {
          emitir: (p: { transponder: string }) => recebidas.push(p.transponder),
          conectado: (v: boolean) => estados.push(v),
          erro: () => undefined,
          log: () => undefined,
        },
      );
      // A reconexão espera 2 s (primeira tentativa do recuo).
      await new Promise((r) => setTimeout(r, 3_200));
      instancia.parar();
      derrubarNaPrimeira = false;
      expect(conexoes).toBeGreaterThanOrEqual(2);
      // conectou → caiu → conectou de novo
      expect(estados.slice(0, 3)).toEqual([true, false, true]);
      // as passagens da segunda ligação também chegaram
      expect(
        recebidas.filter((t) => t === "1312815").length,
      ).toBeGreaterThanOrEqual(2);
    }, 10_000);
  });
});

describe("coletor: envio com fila em disco", () => {
  let servidor: http.Server;
  let url = "";
  let pasta = "";
  const recebidos: Array<{
    auth: string | undefined;
    passagens: unknown[];
    estado: { conectado: boolean; erro?: string };
    eventos: Array<{ tipo: string }>;
  }> = [];
  let falhasRestantes = 0;

  beforeAll(async () => {
    pasta = mkdtempSync(path.join(os.tmpdir(), "coletor-"));
    servidor = http.createServer((req, res) => {
      let corpo = "";
      req.on("data", (d) => (corpo += d));
      req.on("end", () => {
        if (falhasRestantes > 0) {
          falhasRestantes -= 1;
          res.writeHead(503).end();
          return;
        }
        const { passagens, estado, eventos } = JSON.parse(corpo);
        recebidos.push({
          auth: req.headers.authorization,
          passagens,
          estado,
          eventos,
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ gravadas: passagens.length, repetidas: 0 }));
      });
    });
    await new Promise<void>((resolve) =>
      servidor.listen(0, "127.0.0.1", resolve),
    );
    url = `http://127.0.0.1:${(servidor.address() as net.AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
    rmSync(pasta, { recursive: true, force: true });
  });

  it("reenvia depois de uma falha e só limpa a fila quando o sistema confirma", async () => {
    const arquivoFila = path.join(pasta, "fila.jsonl");
    falhasRestantes = 1;
    const envio = criarEnvio({
      servidor: url,
      token: "gl_dec_teste",
      arquivoFila,
      log: () => undefined,
      intervaloMs: 10,
      esperaInicialMs: 5,
    });
    envio.emitir({ transponder: "A1", instanteMs: 1761500000000 });
    envio.emitir({ transponder: "A2" });
    expect(existsSync(arquivoFila)).toBe(true);

    await new Promise((r) => setTimeout(r, 400));
    await envio.parar();

    expect(envio.pendentes()).toBe(0);
    expect(existsSync(arquivoFila)).toBe(false);
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].auth).toBe("Bearer gl_dec_teste");
    expect(recebidos[0].passagens).toMatchObject([
      { transponder: "A1", relogio: "decoder", instanteMs: 1761500000000 },
      { transponder: "A2", relogio: "coletor" },
    ]);
  });

  it("recupera as pendentes de uma execução anterior", async () => {
    const arquivoFila = path.join(pasta, "fila2.jsonl");
    const anterior = criarEnvio({
      servidor: "http://127.0.0.1:1",
      token: "x",
      arquivoFila,
      log: () => undefined,
      intervaloMs: 1_000_000,
    });
    anterior.emitir({ transponder: "P1", instanteMs: 1761500000500 });
    expect(readFileSync(arquivoFila, "utf8")).toContain("P1");
    recebidos.length = 0;

    const novo = criarEnvio({
      servidor: url,
      token: "gl_dec_teste",
      arquivoFila,
      log: () => undefined,
      intervaloMs: 10,
    });
    expect(novo.pendentes()).toBe(1);
    await new Promise((r) => setTimeout(r, 200));
    await novo.parar();
    await anterior.parar();
    expect(recebidos[0].passagens).toMatchObject([{ transponder: "P1" }]);
  });

  it("informa o estado da conexão e os eventos (queda e retorno) ao sistema", async () => {
    recebidos.length = 0;
    const envio = criarEnvio({
      servidor: url,
      token: "gl_dec_teste",
      log: () => undefined,
      intervaloMs: 10,
      batimentoMs: 20,
    });
    envio.conectado(true);
    envio.erro("conexão recusada");
    envio.conectado(false);
    await new Promise((r) => setTimeout(r, 250));
    await envio.parar();

    const tipos = recebidos.flatMap((r) => r.eventos.map((e) => e.tipo));
    expect(tipos).toEqual(
      expect.arrayContaining([
        "coletor_iniciado",
        "conectado",
        "erro",
        "desconectado",
      ]),
    );
    // o batimento segue sendo enviado com o decoder desconectado
    const ultimo = recebidos.at(-1);
    expect(ultimo?.estado.conectado).toBe(false);
    expect(ultimo?.estado.erro).toBeUndefined();
    expect(recebidos.some((r) => r.estado.erro === "conexão recusada")).toBe(
      true,
    );
  });
});

describe.skipIf(!temBancoDeTeste)("decoders e passagens no banco", () => {
  let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
  const ator = { usuarioId: "admin-1" };

  function entrada(transponder: string, instanteMs: number, extra = {}) {
    return {
      transponder,
      instanteMs,
      relogio: "decoder" as const,
      forca: null,
      bruto: null,
      eventoExterno: null,
      ...extra,
    };
  }

  beforeAll(async () => {
    banco = await criarEsquemaDeTeste();
    await migrar();
  });
  afterAll(async () => {
    await banco.remover();
  });

  it("token só vale enquanto o decoder está ativo e o hash é o que fica guardado", async () => {
    const { id, token } = await criarDecoder(
      {
        nome: "Decoder da pista",
        driver: "linhas-tcp",
        endereco: "192.168.1.50:5100",
        modelo: "Modelo X (a confirmar)",
      },
      ator,
    );
    expect(token.startsWith("gl_dec_")).toBe(true);
    expect(await autenticarDecoder(token)).toEqual({
      id,
      nome: "Decoder da pista",
    });
    expect(await autenticarDecoder("gl_dec_errado")).toBeNull();
    expect(await autenticarDecoder("qualquer")).toBeNull();

    await alternarDecoder(id, false, ator);
    expect(await autenticarDecoder(token)).toBeNull();
    await alternarDecoder(id, true, ator);
    expect(await autenticarDecoder(token)).not.toBeNull();

    const guardado = await consultar<{ token_hash: string }>(
      "select token_hash from decoder where id = $1",
      [id],
    );
    expect(guardado[0].token_hash).not.toContain(token);
  });

  it("grava passagens, ignora reenvios e cadastra o transponder como desconhecido", async () => {
    const { id } = await criarDecoder(
      { nome: "Pista B", driver: "simulador" },
      ator,
    );
    const t0 = AGORA - 60_000;
    const lote = [
      entrada("1312815", t0, { forca: 95, bruto: "x" }),
      entrada("1324824", t0 + 2_000),
    ];
    expect(await registrarPassagens(id, lote)).toMatchObject({
      gravadas: 2,
      repetidas: 0,
    });
    // reenvio (reconexão do coletor): nada é gravado de novo
    expect(await registrarPassagens(id, lote)).toMatchObject({
      gravadas: 0,
      repetidas: 2,
    });
    const [{ n }] = await consultar<{ n: number }>(
      "select count(*)::int as n from passagem where decoder_id = $1",
      [id],
    );
    expect(n).toBe(2);

    const codigos = await consultar<{ codigo: string; cadastrado: boolean }>(
      "select codigo, cadastrado from transponder order by codigo",
    );
    expect(codigos).toEqual([
      { codigo: "1312815", cadastrado: false },
      { codigo: "1324824", cadastrado: false },
    ]);

    const recentes = await ultimasPassagens(10);
    expect(recentes.map((p) => p.transponder)).toEqual(["1324824", "1312815"]);
    expect(recentes[0]).toMatchObject({
      decoderNome: "Pista B",
      simulado: true,
    });
    expect(recentes[1].instanteMs).toBeCloseTo(t0, -1);
  });

  it("a mesma leitura reenviada com outro horário é barrada pelo identificador do evento", async () => {
    const { id } = await criarDecoder(
      { nome: "Com id", driver: "linhas-tcp" },
      ator,
    );
    const t = AGORA - 30_000;
    expect(
      await registrarPassagens(id, [
        entrada("EV1", t, { eventoExterno: "e-100" }),
      ]),
    ).toMatchObject({ gravadas: 1 });
    expect(
      await registrarPassagens(id, [
        entrada("EV1", t + 3, { eventoExterno: "e-100" }),
      ]),
    ).toMatchObject({ gravadas: 0, repetidas: 1 });
  });

  it("guarda o que foi rejeitado e o diagnóstico de conexão", async () => {
    const { id } = await criarDecoder(
      { nome: "Diagnóstico", driver: "linhas-tcp" },
      ator,
    );
    const { validas, rejeitadas } = validarPassagens([
      entrada("OK1", AGORA - 1000),
      { transponder: "ruim!", instanteMs: AGORA },
    ]);
    const r = await registrarPassagens(id, validas, {
      rejeitadas,
      estado: { conectado: false, erro: "conexão recusada" },
      eventos: [
        { tipo: "desconectado", detalhe: "queda", ocorridoEmMs: AGORA - 500 },
      ],
      ip: "10.0.0.9",
    });
    expect(r).toMatchObject({ gravadas: 1, rejeitadas: 1 });

    const rej = await consultar<{ motivo: string }>(
      "select motivo from evento_rejeitado where decoder_id = $1",
      [id],
    );
    expect(rej.map((x) => x.motivo)).toEqual([
      "código de transponder inválido",
    ]);

    const decoder = (await listarDecoders()).find((d) => d.id === id);
    expect(decoder).toMatchObject({
      estadoConexao: "decoder_desconectado",
      ultimoErro: "conexão recusada",
    });
    expect((await eventosDeConexao(5))[0]).toMatchObject({
      tipo: "desconectado",
      detalhe: "queda",
    });
    const [{ ultimo_ip }] = await consultar<{ ultimo_ip: string }>(
      "select ultimo_ip from decoder where id = $1",
      [id],
    );
    expect(ultimo_ip).toBe("10.0.0.9");
  });

  it("distingue coletor offline, decoder desconectado e conectado (e a reconexão)", async () => {
    const { id } = await criarDecoder(
      { nome: "Estados", driver: "linhas-tcp" },
      ator,
    );
    const estado = async () =>
      (await listarDecoders()).find((d) => d.id === id)?.estadoConexao;

    expect(await estado()).toBe("coletor_offline"); // nunca falou
    await registrarPassagens(id, [], { estado: { conectado: false } });
    expect(await estado()).toBe("decoder_desconectado");
    await registrarPassagens(id, [], { estado: { conectado: true } });
    expect(await estado()).toBe("conectado");
    const [{ desde }] = await consultar<{ desde: Date | null }>(
      "select conectado_desde as desde from decoder where id = $1",
      [id],
    );
    expect(desde).not.toBeNull();
    // queda
    await registrarPassagens(id, [], { estado: { conectado: false } });
    expect(await estado()).toBe("decoder_desconectado");
    // volta (reconexão)
    await registrarPassagens(id, [], { estado: { conectado: true } });
    expect(await estado()).toBe("conectado");

    // coletor parou de dar sinal há tempo
    await consultar(
      "update decoder set ultimo_sinal = now() - interval '2 minutes' where id = $1",
      [id],
    );
    expect(await estado()).toBe("coletor_offline");
    await alternarDecoder(id, false, ator);
    expect(await estado()).toBe("desativado");
  });

  it("apaga só diagnósticos antigos; as passagens ficam", async () => {
    const { id } = await criarDecoder(
      { nome: "Retenção", driver: "linhas-tcp" },
      ator,
    );
    await registrarPassagens(id, [entrada("RET1", AGORA - 5_000)], {
      rejeitadas: [{ motivo: "teste", transponder: null, bruto: null }],
      eventos: [{ tipo: "conectado", detalhe: null, ocorridoEmMs: AGORA }],
    });
    await consultar(
      "update evento_rejeitado set recebido_em = now() - interval '200 days' where decoder_id = $1",
      [id],
    );
    await consultar(
      "update decoder_evento set recebido_em = now() - interval '200 days' where decoder_id = $1",
      [id],
    );
    expect(await purgarDiagnosticos(90)).toBeGreaterThanOrEqual(2);
    const [{ n }] = await consultar<{ n: number }>(
      "select count(*)::int as n from passagem where decoder_id = $1",
      [id],
    );
    expect(n).toBe(1);
  });

  it("o registro de passagens não pode ser alterado nem apagado", async () => {
    await expect(
      consultar("update passagem set transponder = 'X'"),
    ).rejects.toThrow(/somente de inclusão/);
    await expect(consultar("delete from passagem")).rejects.toThrow(
      /somente de inclusão/,
    );
  });

  it("a API exige token, grava o lote e conta o que rejeitou", async () => {
    const { token } = await criarDecoder(
      { nome: "Via API", driver: "linhas-tcp" },
      ator,
    );
    const requisicao = (autorizacao: string | null, corpo: unknown) =>
      new Request("http://localhost/api/cronometragem/passagens", {
        method: "POST",
        headers: autorizacao ? { authorization: autorizacao } : {},
        body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
      });
    const lote = {
      passagens: [
        { transponder: "API1", instanteMs: AGORA - 5_000 },
        { transponder: "ruim!", instanteMs: AGORA },
      ],
      estado: { conectado: true },
      eventos: [{ tipo: "conectado", detalhe: "ok" }],
    };

    expect((await POST(requisicao(null, lote))).status).toBe(401);
    expect((await POST(requisicao("Bearer gl_dec_nada", lote))).status).toBe(
      401,
    );
    expect(
      (await POST(requisicao(`Bearer ${token}`, "{não é json"))).status,
    ).toBe(400);

    const resposta = await POST(requisicao(`Bearer ${token}`, lote));
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({
      gravadas: 1,
      repetidas: 0,
      rejeitadas: 1,
    });
  });
});
