import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  adicionarSensorAoKart,
  lerTransponder,
  listarKarts,
  removerSensorDoKart,
  salvarKart,
  sensoresSemKart,
} from "@/lib/cronometragem/cadastros-store";
import {
  adicionarPiloto,
  adicionarPilotosEmLote,
  criarCorrida,
  finalizarCorrida,
  iniciarCorrida,
  lerCorrida,
  lerPainel,
} from "@/lib/cronometragem/corridas-store";
import {
  criarDecoder,
  registrarPassagens,
} from "@/lib/cronometragem/decoders-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

const SEG = 1000;
const MIN = 60 * SEG;

describe.skipIf(!temBancoDeTeste)("sensor do kart e pilotos da bateria", () => {
  let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
  const ator = { usuarioId: "operador-1" };
  let decoderId = "";

  async function agora(): Promise<number> {
    const [l] = await consultar<{ ms: number }>(
      "select (extract(epoch from clock_timestamp()) * 1000)::float8 as ms",
    );
    return l.ms;
  }

  async function passar(sensor: string, instanteMs: number) {
    return registrarPassagens(decoderId, [
      {
        transponder: sensor,
        instanteMs,
        relogio: "decoder",
        forca: null,
        bruto: null,
        eventoExterno: null,
      },
    ]);
  }

  async function erroDe(promessa: Promise<unknown>): Promise<string> {
    try {
      await promessa;
    } catch (erro) {
      return (erro as Error).message;
    }
    return "";
  }

  async function kartPorNumero(numero: string) {
    const k = (await listarKarts()).find((x) => x.numero === numero);
    if (!k) throw new Error(`kart ${numero} não existe`);
    return k;
  }

  async function recuarInicio(id: string, ms: number) {
    await consultar(
      "update corrida set iniciada_em = iniciada_em - make_interval(secs => $2::float8 / 1000.0) where id = $1",
      [id, ms],
    );
  }

  beforeAll(async () => {
    banco = await criarEsquemaDeTeste();
    await migrar();
    decoderId = (
      await criarDecoder({ nome: "Pista", driver: "linhas-tcp" }, ator)
    ).id;
  });
  afterEach(async () => {
    await consultar(
      "update corrida set estado = 'cancelada', cancelada_em = now() where estado in ('em_andamento', 'encerrando')",
    );
  });
  afterAll(async () => {
    await banco.remover();
  });

  it("sensor novo no kart: o antigo sai de uso, vai para manutenção e fica no histórico", async () => {
    const t = await agora();
    for (const s of ["SA1", "SA2", "SA3"]) await passar(s, t - 3600 * SEG);
    await salvarKart(
      null,
      { numero: "21", status: "ativo", transponderFixo: "SA1" },
      ator,
    );
    let kart = await kartPorNumero("21");
    expect(kart.transponderFixo).toBe("SA1");
    expect(kart.sensores.filter((s) => s.ativo).map((s) => s.codigo)).toEqual([
      "SA1",
    ]);
    expect((await sensoresSemKart()).map((s) => s.codigo).sort()).toEqual([
      "SA2",
      "SA3",
    ]);

    await adicionarSensorAoKart(
      kart.id,
      "SA2",
      { substituir: true, motivo: "sensor quebrou" },
      ator,
    );
    kart = await kartPorNumero("21");
    expect(kart.transponderFixo).toBe("SA2");
    expect(kart.sensores.map((s) => [s.codigo, s.ativo]).sort()).toEqual([
      ["SA1", false],
      ["SA2", true],
    ]);
    expect(kart.sensores.find((s) => s.codigo === "SA1")?.motivoRemocao).toBe(
      "sensor quebrou",
    );
    expect((await lerTransponder("SA1"))?.status).toBe("manutencao");
    expect(await lerTransponder("SA2")).toMatchObject({
      cadastrado: true,
      rotulo: "Kart 21",
      kartFixo: "21",
    });
    // o sensor tirado de uso não volta para a lista de "sem kart" como livre
    // para uso comum: está em manutenção, e só o SA3 segue livre e ativo
    expect((await sensoresSemKart()).map((s) => s.codigo)).toContain("SA3");
    expect((await sensoresSemKart()).map((s) => s.codigo)).not.toContain("SA2");

    const [auditoria] = await consultar<{ total: number }>(
      "select count(*)::int as total from audit_log where acao = 'kart.sensor_adicionar'",
    );
    expect(auditoria.total).toBeGreaterThanOrEqual(1);
  });

  it("recusa sensor de outro kart, sensor que ninguém leu e sensor em manutenção", async () => {
    const t = await agora();
    for (const s of ["SB1", "SB2"]) await passar(s, t - 3600 * SEG);
    await salvarKart(
      null,
      { numero: "22", status: "ativo", transponderFixo: "SB1" },
      ator,
    );
    await salvarKart(
      null,
      { numero: "23", status: "ativo", transponderFixo: "SB2" },
      ator,
    );
    const k22 = await kartPorNumero("22");
    expect(
      await erroDe(
        adicionarSensorAoKart(k22.id, "SB2", { substituir: false }, ator),
      ),
    ).toMatch(/já está no kart 23/);
    expect(
      await erroDe(
        adicionarSensorAoKart(k22.id, "SB1", { substituir: false }, ator),
      ),
    ).toMatch(/já é deste kart/);
    expect(
      await erroDe(
        adicionarSensorAoKart(
          k22.id,
          "NUNCA-LIDO",
          { substituir: false },
          ator,
        ),
      ),
    ).toMatch(/ainda não foi lido/);
    expect(
      await erroDe(
        adicionarSensorAoKart(k22.id, "  ", { substituir: false }, ator),
      ),
    ).toMatch(/Informe o sensor/);
    // sensor tirado de uso (SA1, em manutenção) não pode ser reaproveitado
    expect(
      await erroDe(
        adicionarSensorAoKart(k22.id, "SA1", { substituir: false }, ator),
      ),
    ).toMatch(/em manutenção/);
  });

  it("tirar um sensor de uso exige motivo e o principal passa para o que sobrar", async () => {
    const t = await agora();
    for (const s of ["SC1", "SC2"]) await passar(s, t - 3600 * SEG);
    await salvarKart(
      null,
      { numero: "24", status: "ativo", transponderFixo: "SC1" },
      ator,
    );
    const k = await kartPorNumero("24");
    await adicionarSensorAoKart(k.id, "SC2", { substituir: false }, ator);
    expect((await kartPorNumero("24")).transponderFixo).toBe("SC2");
    expect(
      (await kartPorNumero("24")).sensores.filter((s) => s.ativo),
    ).toHaveLength(2);

    expect(await erroDe(removerSensorDoKart(k.id, "SC2", "", ator))).toMatch(
      /motivo/i,
    );
    await removerSensorDoKart(k.id, "SC2", "caiu na pista", ator);
    const depois = await kartPorNumero("24");
    expect(depois.transponderFixo).toBe("SC1");
    expect(depois.sensores.find((s) => s.codigo === "SC2")?.ativo).toBe(false);
    expect(
      await erroDe(removerSensorDoKart(k.id, "SC2", "de novo", ator)),
    ).toMatch(/não está em uso/);
  });

  it("no meio da bateria, a leitura do sensor novo conta para o mesmo kart", async () => {
    const t = await agora();
    for (const s of ["SD1", "SD2"]) await passar(s, t - 3600 * SEG);
    await salvarKart(
      null,
      { numero: "25", status: "ativo", transponderFixo: "SD1" },
      ator,
    );
    const id = await criarCorrida({ nome: "Troca de sensor" }, ator);
    await iniciarCorrida(id, ator);
    await recuarInicio(id, 6 * MIN);
    const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();

    await passar("SD1", inicio + 20 * SEG); // kart 25 entra
    await passar("SD1", inicio + 80 * SEG); // 1 volta
    const k = await kartPorNumero("25");
    await adicionarSensorAoKart(
      k.id,
      "SD2",
      { substituir: true, motivo: "sensor solto" },
      ator,
    );
    await passar("SD2", inicio + 140 * SEG); // 2 voltas, pelo sensor novo
    await passar("SD2", inicio + 200 * SEG); // 3 voltas

    const painel = (await lerPainel(id))!;
    expect(painel.grid).toHaveLength(1);
    expect(painel.grid[0]).toMatchObject({
      kartNumero: "25",
      sensoresExtras: ["SD2"],
    });
    expect(painel.classificacao).toHaveLength(1);
    expect(painel.classificacao[0].voltas).toBe(3);
    await finalizarCorrida(id, ator);
  });

  it("um kart que só tem o sensor novo entra sozinho na bateria", async () => {
    const t = await agora();
    for (const s of ["SE1", "SE2"]) await passar(s, t - 3600 * SEG);
    await salvarKart(
      null,
      { numero: "26", status: "ativo", transponderFixo: "SE1" },
      ator,
    );
    const k = await kartPorNumero("26");
    await adicionarSensorAoKart(k.id, "SE2", { substituir: true }, ator);

    const id = await criarCorrida({ nome: "Sensor novo desde o início" }, ator);
    await iniciarCorrida(id, ator);
    await recuarInicio(id, 4 * MIN);
    const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
    await passar("SE2", inicio + 20 * SEG);
    const painel = (await lerPainel(id))!;
    expect(painel.grid.map((g) => [g.kartNumero, g.nomeado])).toEqual([
      ["26", false],
    ]);
    // o sensor antigo (em manutenção) não leva ao kart
    await passar("SE1", inicio + 40 * SEG);
    expect((await lerPainel(id))!.grid).toHaveLength(1);
    await finalizarCorrida(id, ator);
  });

  it("lista de pilotos da bateria: vários nomes de uma vez, tudo ou nada", async () => {
    const id = await criarCorrida({ nome: "Lista nova" }, ator);
    expect(
      await adicionarPilotosEmLote(
        id,
        "Ana Souza\r\n\n  Beto Lima \nCarla",
        ator,
      ),
    ).toBe(3);
    expect((await lerPainel(id))!.grid.map((p) => p.nome)).toEqual([
      "Ana Souza",
      "Beto Lima",
      "Carla",
    ]);

    expect(await erroDe(adicionarPilotosEmLote(id, " \n ", ator))).toMatch(
      /ao menos um nome/,
    );
    // um nome inválido derruba a lista inteira
    expect(
      await erroDe(adicionarPilotosEmLote(id, "Davi Costa\nX", ator)),
    ).toMatch(/muito curto/);
    const nomes = (await lerPainel(id))!.grid.map((p) => p.nome);
    expect(nomes).not.toContain("Davi Costa");
    expect(nomes).toHaveLength(3);
    expect(
      await erroDe(
        adicionarPilotosEmLote(
          id,
          Array.from({ length: 61 }, (_, i) => `Piloto ${i + 10}`).join("\n"),
          ator,
        ),
      ),
    ).toMatch(/No máximo 60/);
  });

  it("incluir pilotos numa bateria pronta volta a preparação; depois de encerrada, não", async () => {
    const id = await criarCorrida({ nome: "Pronta" }, ator);
    await adicionarPiloto(id, "Elisa", ator);
    await consultar("update corrida set estado = 'pronta' where id = $1", [id]);
    expect((await lerCorrida(id))?.estado).toBe("pronta");
    await adicionarPilotosEmLote(id, "Fabio\nGabi", ator);
    expect((await lerCorrida(id))?.estado).toBe("preparada");

    await iniciarCorrida(id, ator);
    await finalizarCorrida(id, ator);
    expect(await erroDe(adicionarPilotosEmLote(id, "Tarde", ator))).toMatch(
      /já foi encerrada/,
    );
  });
});
