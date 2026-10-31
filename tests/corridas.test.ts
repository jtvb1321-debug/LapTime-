import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  contarDesconhecidos,
  historicoDoTransponder,
  lerTransponder,
  listarTransponders,
  salvarKart,
  salvarModeloDeVinculo,
  salvarTransponder,
} from "@/lib/cronometragem/cadastros-store";
import {
  adicionarPiloto,
  anularCorrecao,
  armarCaptura,
  avancarCorridas,
  cancelarCorrida,
  criarCorrida,
  definirKart,
  desvincularSensor,
  encerrarAgora,
  excluirCorrida,
  finalizarCorrida,
  iniciarCorrida,
  inserirPassagemManual,
  invalidarPassagem,
  lerCorrida,
  lerPainel,
  marcarPronta,
  prazoDaCorrida,
  reabrirPreparacao,
  removerPiloto,
  vincularSensor,
} from "@/lib/cronometragem/corridas-store";
import {
  criarDecoder,
  registrarPassagens,
} from "@/lib/cronometragem/decoders-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import {
  criarReserva,
  gerarGrade,
  lerAgendaDoDia,
} from "@/lib/operacao/agenda-store";
import { criarCliente } from "@/lib/operacao/clientes-store";
import { hojeEmSaoPaulo, somarDias } from "@/lib/operacao/tempo";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

const SEG = 1000;
const MIN = 60 * SEG;

describe.skipIf(!temBancoDeTeste)("corrida: do cadastro às voltas", () => {
  let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
  const ator = { usuarioId: "operador-1" };
  const DIA = somarDias(hojeEmSaoPaulo(), 1);
  let decoderId = "";
  let simuladorId = "";

  // Relógio do BANCO: as janelas das corridas usam o horário dele.
  async function agora(): Promise<number> {
    const [l] = await consultar<{ ms: number }>(
      "select (extract(epoch from clock_timestamp()) * 1000)::float8 as ms",
    );
    return l.ms;
  }

  async function passar(
    sensor: string,
    instanteMs: number,
    decoder = decoderId,
  ) {
    return registrarPassagens(decoder, [
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

  async function cadastrar(codigo: string, status = "ativo") {
    await salvarTransponder(
      codigo,
      { status: status as "ativo" | "inativo" | "manutencao" },
      ator,
    );
  }

  async function recuarInicio(corridaId: string, ms: number) {
    await consultar(
      "update corrida set iniciada_em = iniciada_em - make_interval(secs => $2::float8 / 1000.0) where id = $1",
      [corridaId, ms],
    );
  }

  async function erroDe(promessa: Promise<unknown>): Promise<string> {
    try {
      await promessa;
    } catch (erro) {
      return (erro as Error).message;
    }
    return "";
  }

  async function painel(id: string) {
    const p = await lerPainel(id);
    if (!p) throw new Error("painel inexistente");
    return p;
  }

  // Corrida avulsa com pilotos já vinculados (modelo "piloto") e pronta.
  async function corridaPronta(
    nome: string,
    pilotos: Array<[string, string]>,
    opcoes: Parameters<typeof criarCorrida>[0] = {},
  ) {
    const id = await criarCorrida({ nome, ...opcoes }, ator);
    for (const [nomePiloto] of pilotos)
      await adicionarPiloto(id, nomePiloto, ator);
    const grid = (await painel(id)).grid;
    for (const [i, [, sensor]] of pilotos.entries()) {
      await cadastrar(sensor).catch(() => undefined);
      // o sensor precisa já ter sido lido pelo decoder
      const existe = await consultar(
        "select 1 from transponder where codigo = $1",
        [sensor],
      );
      if (!existe.length) throw new Error("sensor não existe");
      await vincularSensor(grid[i].id, sensor, ator);
    }
    await marcarPronta(id, ator);
    return { id, grid };
  }

  beforeAll(async () => {
    banco = await criarEsquemaDeTeste();
    await migrar();
    // O padrão da instalação agora é o transponder fixo no kart; estes testes
    // cobrem o modelo em que o sensor é ligado ao piloto.
    await salvarModeloDeVinculo("piloto", ator);
    decoderId = (
      await criarDecoder({ nome: "Pista", driver: "linhas-tcp" }, ator)
    ).id;
    simuladorId = (
      await criarDecoder({ nome: "Simulado", driver: "simulador" }, ator)
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

  it("a bateria da agenda vira corrida de 12 min com os pilotos reservados no grid", async () => {
    await gerarGrade(
      {
        dia: DIA,
        primeiraHora: "10:00",
        ultimaHora: "10:00",
        intervaloMin: 15,
        duracaoMin: 10,
        capacidade: 8,
        precoCentavos: 5000,
      },
      ator,
    );
    const slot = (await lerAgendaDoDia(DIA))[0];
    const cliente = await criarCliente(
      { nome: "Ana Souza", telefone: "11999990000" },
      ator,
    );
    await criarReserva(
      {
        slotId: slot.id,
        clienteId: cliente.id,
        pilotos: 2,
        descontoCentavos: 0,
      },
      ator,
    );

    const id = await criarCorrida({ slotId: slot.id }, ator);
    const p = await painel(id);
    expect(p.corrida).toMatchObject({
      nome: "Bateria 10:00",
      estado: "preparada",
      duracaoMin: 12,
      regraLargada: "primeira_passagem",
      modoEncerramento: "manual",
    });
    // o cliente da reserva é o responsável e o 1º piloto; a outra vaga fica
    // aberta até cadastrar o piloto
    expect(p.grid.map((g) => [g.nome, g.vaga])).toEqual([
      ["Ana Souza", false],
      ["Vaga 2 de Ana Souza", true],
    ]);
    expect(p.responsavel).toMatchObject({
      id: cliente.id,
      nome: "Ana Souza",
    });
    expect(await erroDe(criarCorrida({ slotId: slot.id }, ator))).toMatch(
      /já está sendo cronometrada/,
    );
    await excluirCorrida(id, ator);
  });

  it("cadastro de transponders: texto exato, desconhecidos em destaque, busca e auditoria", async () => {
    const t = await agora();
    await passar("000123", t - 5 * SEG); // lido, mas ninguém cadastrou
    await passar("ABC-9", t - 4 * SEG);

    const antes = await lerTransponder("000123");
    expect(antes).toMatchObject({
      codigo: "000123",
      cadastrado: false,
      status: "ativo",
    });
    expect(await contarDesconhecidos()).toBeGreaterThanOrEqual(2);
    // desconhecidos vêm primeiro
    expect(
      (await listarTransponders()).slice(0, 2).every((x) => !x.cadastrado),
    ).toBe(true);

    await salvarTransponder(
      "000123",
      {
        rotulo: "Kart 3",
        modelo: "Modelo fictício",
        status: "manutencao",
        observacoes: "bateria fraca",
      },
      ator,
    );
    const depois = await lerTransponder("000123");
    expect(depois).toMatchObject({
      codigo: "000123", // zeros à esquerda preservados
      cadastrado: true,
      rotulo: "Kart 3",
      modelo: "Modelo fictício",
      status: "manutencao",
      observacoes: "bateria fraca",
    });
    expect(depois?.id).toMatch(/^tp-/);
    expect((await listarTransponders("fraca")).length).toBe(0); // busca não olha observações
    expect(
      (await listarTransponders("modelo fic")).map((x) => x.codigo),
    ).toEqual(["000123"]);
    expect((await listarTransponders("00012")).map((x) => x.codigo)).toEqual([
      "000123",
    ]);

    expect(
      await erroDe(salvarTransponder("com espaço", { status: "ativo" }, ator)),
    ).toMatch(/Identificador inválido/);
    expect(
      await erroDe(
        salvarTransponder("X1", { status: "quebrado" as never }, ator),
      ),
    ).toMatch(/situação/);

    const [a] = await consultar<{ acao: string; antes: unknown }>(
      "select acao, antes from audit_log where entidade = 'transponder' and entidade_id = '000123' order by id desc limit 1",
    );
    expect(a.acao).toBe("transponder.atualizar");
    expect(a.antes).toMatchObject({ cadastrado: false });
  });

  it("vínculo piloto ↔ sensor: ambiguidade, transponder inativo, captura e prontidão do grid", async () => {
    const t = await agora();
    for (const s of ["S1", "S2", "S3", "S4"]) await passar(s, t - 600 * SEG);
    await cadastrar("S1");
    await cadastrar("S2");
    await cadastrar("S3");
    await cadastrar("S4", "inativo");

    const id = await criarCorrida({ nome: "Treino de teste" }, ator);
    for (const nome of ["Bia", "Caio", "Duda"])
      await adicionarPiloto(id, nome, ator);
    let p = await painel(id);
    const [bia, caio, duda] = p.grid;
    expect(p.detectados.map((d) => d.transponder).sort()).toEqual(
      expect.arrayContaining(["S1", "S2", "S3"]),
    );

    expect(await erroDe(vincularSensor(bia.id, "ZZ9", ator))).toMatch(
      /ainda não foi lido/,
    );
    expect(await erroDe(vincularSensor(bia.id, "S4", ator))).toMatch(/inativo/);
    await vincularSensor(bia.id, "S1", ator);
    await vincularSensor(caio.id, "S2", ator);
    expect(await erroDe(vincularSensor(duda.id, "S1", ator))).toMatch(
      /já está com Bia/,
    );

    // Grid incompleto não fica pronto.
    expect(await erroDe(marcarPronta(id, ator))).toMatch(
      /Falta sensor para: Duda/,
    );

    // "Capturar o próximo sensor" (como bipar o código de barras).
    await armarCaptura(duda.id, true, ator);
    expect(await erroDe(armarCaptura(bia.id, true, ator))).toMatch(
      /já tem sensor/,
    );
    await passar("S3", t - 590 * SEG);
    p = await painel(id);
    expect(p.grid.find((g) => g.nome === "Duda")).toMatchObject({
      transponder: "S3",
      capturaArmada: false,
    });

    await marcarPronta(id, ator);
    expect((await lerCorrida(id))?.estado).toBe("pronta");
    // Mexer no grid depois de pronta exige confirmar de novo.
    await adicionarPiloto(id, "Edu", ator);
    expect((await lerCorrida(id))?.estado).toBe("preparada");
    const edu = (await painel(id)).grid.find((g) => g.nome === "Edu");
    await removerPiloto(edu!.id, ator);
    await desvincularSensor(duda.id, ator);
    await vincularSensor(duda.id, "S3", ator);
    await marcarPronta(id, ator);
    await reabrirPreparacao(id, ator);
    await cancelarCorrida(id, "teste encerrado", ator);
  });

  it("modelo 'kart': o transponder fixo do kart vira o do piloto, e o histórico não muda", async () => {
    const t = await agora();
    await passar("KT1", t - 100 * SEG);
    await passar("KT2", t - 99 * SEG);
    await passar("KT3", t - 98 * SEG);
    await cadastrar("KT1");
    await cadastrar("KT2");
    await cadastrar("KT3");
    await salvarKart(
      null,
      { numero: "7", status: "ativo", transponderFixo: "KT1" },
      ator,
    );
    await salvarKart(
      null,
      { numero: "8", status: "manutencao", transponderFixo: "KT2" },
      ator,
    );
    await salvarKart(null, { numero: "9", status: "ativo" }, ator);
    expect(
      await erroDe(salvarKart(null, { numero: "7", status: "ativo" }, ator)),
    ).toMatch(/Já existe um kart com esse número/);
    expect(
      await erroDe(
        salvarKart(
          null,
          { numero: "10", status: "ativo", transponderFixo: "KT1" },
          ator,
        ),
      ),
    ).toMatch(/já está no kart/);

    const karts = await consultar<{ id: string; numero: string }>(
      "select id, numero from kart",
    );
    const kart = (n: string) => karts.find((k) => k.numero === n)!.id;

    await salvarModeloDeVinculo("kart", ator);
    try {
      const c1 = await criarCorrida({ nome: "Corrida A (kart)" }, ator);
      await adicionarPiloto(c1, "Lia", ator);
      await adicionarPiloto(c1, "Gus", ator);
      const [lia, gus] = (await painel(c1)).grid;

      expect(await erroDe(vincularSensor(lia.id, "KT1", ator))).toMatch(
        /vem do kart/,
      );
      expect(await erroDe(definirKart(lia.id, kart("8"), ator))).toMatch(
        /em manutenção/,
      );
      expect(await erroDe(definirKart(lia.id, kart("9"), ator))).toMatch(
        /não tem transponder fixo/,
      );

      await definirKart(lia.id, kart("7"), ator);
      let p = await painel(c1);
      expect(p.grid.find((g) => g.nome === "Lia")).toMatchObject({
        transponder: "KT1",
        kartNumero: "7",
      });
      // Dois pilotos no mesmo kart / mesmo transponder da mesma corrida: ambíguo.
      expect(await erroDe(definirKart(gus.id, kart("7"), ator))).toMatch(
        /já está com Lia/,
      );

      // O kart passa a ter outro transponder: a corrida A continua com o que usou.
      await salvarKart(
        kart("7"),
        { numero: "7", status: "ativo", transponderFixo: "KT3" },
        ator,
      );
      p = await painel(c1);
      expect(p.grid.find((g) => g.nome === "Lia")).toMatchObject({
        transponder: "KT1",
        kartNumero: "7",
      });
      await salvarKart(
        kart("7"),
        { numero: "7", status: "ativo", transponderFixo: "KT1" },
        ator,
      );

      // Duas baterias só PLANEJADAS podem repetir o mesmo kart com pilotos
      // diferentes; o conflito só existe quando uma delas está correndo.
      const c2 = await criarCorrida({ nome: "Corrida B (kart)" }, ator);
      await adicionarPiloto(c2, "Rui", ator);
      const rui = (await painel(c2)).grid[0];
      await definirKart(rui.id, kart("7"), ator);
      expect((await painel(c2)).grid[0]).toMatchObject({
        transponder: "KT1",
        kartNumero: "7",
      });
      // Com a bateria A correndo, o mesmo transponder não vai a outra bateria.
      await iniciarCorrida(c1, ator);
      const cC = await criarCorrida({ nome: "Corrida C (kart)" }, ator);
      await adicionarPiloto(cC, "Tati", ator);
      const tati = (await painel(cC)).grid[0];
      expect(await erroDe(definirKart(tati.id, kart("7"), ator))).toMatch(
        /já está com Lia/,
      );
      await cancelarCorrida(c1, "libera o kart", ator);
      await definirKart(tati.id, kart("7"), ator);
      await cancelarCorrida(cC, "fim do teste", ator);

      // Histórico da corrida cancelada continua intacto.
      expect(
        (await painel(c1)).grid.find((g) => g.nome === "Lia"),
      ).toMatchObject({
        transponder: "KT1",
        kartNumero: "7",
      });
      // Histórico do transponder: quem usou, em qual corrida, com qual kart.
      const uso = await historicoDoTransponder("KT1");
      expect(
        uso
          .map((u) => `${u.corridaNome}:${u.participante}:${u.kartNumero}`)
          .sort(),
      ).toEqual([
        "Corrida A (kart):Lia:7",
        "Corrida B (kart):Rui:7",
        "Corrida C (kart):Tati:7",
      ]);

      // Tirar o kart no modelo "kart" solta o sensor.
      await definirKart(rui.id, null, ator);
      expect((await painel(c2)).grid[0]).toMatchObject({
        transponder: undefined,
      });
      await cancelarCorrida(c2, "fim do teste", ator);

      // Não se troca o modelo com corrida em andamento.
      const c3 = await criarCorrida({ nome: "Ativa (kart)" }, ator);
      await adicionarPiloto(c3, "Zé", ator);
      await definirKart((await painel(c3)).grid[0].id, kart("7"), ator);
      await marcarPronta(c3, ator);
      await iniciarCorrida(c3, ator);
      expect(await erroDe(salvarModeloDeVinculo("piloto", ator))).toMatch(
        /em andamento/,
      );
      await finalizarCorrida(c3, ator);
    } finally {
      await salvarModeloDeVinculo("piloto", ator);
    }
  });

  it("máquina de estados: transições válidas e recusadas", async () => {
    const t = await agora();
    await passar("E1", t - 300 * SEG);
    const { id } = await corridaPronta("Estados", [["Ana", "E1"]]);
    expect(await erroDe(excluirCorrida("nao-existe", ator))).toMatch(
      /não encontrada/,
    );
    expect(await erroDe(encerrarAgora(id, ator))).toMatch(
      /não está em andamento/,
    );
    expect(await erroDe(finalizarCorrida(id, ator))).toMatch(
      /não está em andamento/,
    );

    await reabrirPreparacao(id, ator);
    expect(await erroDe(iniciarCorrida(id, ator))).toMatch(
      /Marcar como pronta/,
    );
    await marcarPronta(id, ator);
    await iniciarCorrida(id, ator);
    expect((await lerCorrida(id))?.estado).toBe("em_andamento");
    expect(await erroDe(iniciarCorrida(id, ator))).toMatch(/já foi iniciada/);
    expect(await erroDe(excluirCorrida(id, ator))).toMatch(/não começou/);

    // Só uma corrida ativa por vez.
    const outra = await criarCorrida({ nome: "Outra" }, ator);
    await adicionarPiloto(outra, "Zé", ator);
    await cadastrar("E2");
    const zé = (await painel(outra)).grid[0];
    await passar("E2", t - 299 * SEG);
    await vincularSensor(zé.id, "E2", ator);
    await marcarPronta(outra, ator);
    expect(await erroDe(iniciarCorrida(outra, ator))).toMatch(
      /Já existe uma bateria em andamento/,
    );

    await encerrarAgora(id, ator);
    expect((await lerCorrida(id))?.estado).toBe("encerrando");
    await finalizarCorrida(id, ator);
    const fim = await lerCorrida(id);
    expect(fim?.estado).toBe("finalizada");
    expect(fim?.resultadoFinal?.classificacao).toHaveLength(1);
    expect(await erroDe(adicionarPiloto(id, "Tarde", ator))).toMatch(
      /encerrada/,
    );
    expect(await erroDe(cancelarCorrida(id, "tarde demais", ator))).toMatch(
      /já foi encerrada/,
    );

    await iniciarCorrida(outra, ator);
    expect(await erroDe(cancelarCorrida(outra, "x", ator))).toMatch(/motivo/);
    await cancelarCorrida(outra, "teste de cancelamento", ator);
    const c = await lerCorrida(outra);
    expect(c).toMatchObject({
      estado: "cancelada",
      motivoCancelamento: "teste de cancelamento",
    });
  });

  it("corrida de 12 minutos: o relógio é do servidor e vive no banco", async () => {
    const t = await agora();
    await passar("R1", t - 900 * SEG);
    const { id } = await corridaPronta("Doze minutos", [["Rita", "R1"]], {
      duracaoMin: 12,
    });
    await iniciarCorrida(id, ator);
    const c = (await lerCorrida(id))!;
    expect(c.duracaoMin).toBe(12);
    const prazo = prazoDaCorrida(c)!;
    expect(prazo.getTime() - c.iniciadaEm!.getTime()).toBe(12 * MIN);
    expect((await painel(id)).prazoMs).toBe(prazo.getTime());

    // 11 min depois ainda está andando.
    await recuarInicio(id, 11 * MIN);
    await avancarCorridas();
    expect((await lerCorrida(id))?.estado).toBe("em_andamento");

    // Passou dos 12 min: o servidor encerra no instante exato do prazo, sem
    // depender de ninguém ter a tela aberta (a função é idempotente e só
    // olha o banco — é o que roda de novo depois de uma reinicialização).
    await recuarInicio(id, 90 * SEG);
    await avancarCorridas();
    await avancarCorridas();
    const e = (await lerCorrida(id))!;
    expect(e.estado).toBe("encerrando");
    expect(e.encerrandoEm?.getTime()).toBe(prazoDaCorrida(e)!.getTime());
    expect((await painel(id)).alertas.map((a) => a.texto).join(" ")).toMatch(
      /Tempo esgotado/,
    );

    // Modo manual: continua valendo até o operador finalizar.
    await finalizarCorrida(id, ator);
    expect((await lerCorrida(id))?.estado).toBe("finalizada");
    expect(await lerPainel("nao-existe")).toBeNull();
  });

  it("encerramento 'corte imediato': finaliza no instante do prazo e ignora o que vem depois", async () => {
    const t = await agora();
    await passar("C1", t - 900 * SEG);
    const { id } = await corridaPronta("Corte", [["Cris", "C1"]], {
      duracaoMin: 12,
      modoEncerramento: "corte_imediato",
    });
    await iniciarCorrida(id, ator);
    await recuarInicio(id, 12 * MIN + 30 * SEG);
    const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
    // passagens: largada e 1 volta antes do prazo; 1 depois (não conta)
    await passar("C1", inicio + 10 * SEG);
    await passar("C1", inicio + 70 * SEG);
    await passar("C1", inicio + 12 * MIN + 10 * SEG);
    await avancarCorridas();
    const c = (await lerCorrida(id))!;
    expect(c.estado).toBe("finalizada");
    expect(c.encerradaEm?.getTime()).toBe(inicio + 12 * MIN);
    const p = await painel(id);
    expect(p.classificacao[0].voltas).toBe(1);
    expect(p.historico.find((h) => h.status === "depois_do_fim")).toBeTruthy();
  });

  it("última passagem ('próxima passagem'): cada piloto termina ao cruzar a linha depois da bandeira", async () => {
    const t = await agora();
    for (const s of ["U1", "U2", "U3"]) await passar(s, t - 900 * SEG);
    const { id } = await corridaPronta(
      "Última volta",
      [
        ["Ana", "U1"],
        ["Beto", "U2"],
        ["Cida", "U3"],
      ],
      {
        duracaoMin: 12,
        modoEncerramento: "proxima_passagem",
        esperaFinalS: 120,
      },
    );
    await iniciarCorrida(id, ator);
    await recuarInicio(id, 12 * MIN + 60 * SEG);
    const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
    const bandeira = inicio + 12 * MIN;

    // Ana e Beto largaram e deram volta antes da bandeira; Cida só largou.
    for (const s of ["U1", "U2"]) {
      await passar(s, inicio + 20 * SEG);
      await passar(s, inicio + 80 * SEG);
    }
    await passar("U3", inicio + 25 * SEG);
    await avancarCorridas();
    expect((await lerCorrida(id))?.estado).toBe("encerrando");

    // Ana cruza depois da bandeira: volta final. Ainda faltam Beto e Cida.
    await passar("U1", bandeira + 3 * SEG);
    expect((await lerCorrida(id))?.estado).toBe("encerrando");
    let p = await painel(id);
    expect(p.classificacao.find((l) => l.nome === "Ana")).toMatchObject({
      situacao: "finalizou",
      voltas: 2,
    });
    // Nova leitura da Ana depois de terminar não conta.
    await passar("U1", bandeira + 20 * SEG);
    p = await painel(id);
    expect(p.classificacao.find((l) => l.nome === "Ana")?.voltas).toBe(2);
    expect(p.historico.find((h) => h.status === "apos_bandeira")).toBeTruthy();

    // Beto e Cida terminam → a corrida se finaliza sozinha.
    await passar("U2", bandeira + 6 * SEG);
    await passar("U3", bandeira + 9 * SEG); // Cida: 1ª volta fecha e é a final
    const fim = (await lerCorrida(id))!;
    expect(fim.estado).toBe("finalizada");
    expect(fim.resultadoFinal?.classificacao.map((l) => l.nome)).toEqual([
      "Ana",
      "Beto",
      "Cida",
    ]);
  });

  it("última passagem: se alguém não cruzar, a espera máxima encerra a corrida", async () => {
    const t = await agora();
    for (const s of ["W1", "W2"]) await passar(s, t - 900 * SEG);
    const { id } = await corridaPronta(
      "Espera",
      [
        ["Ana", "W1"],
        ["Beto", "W2"],
      ],
      {
        duracaoMin: 12,
        modoEncerramento: "proxima_passagem",
        esperaFinalS: 120,
      },
    );
    await iniciarCorrida(id, ator);
    await recuarInicio(id, 12 * MIN + 5 * SEG);
    const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
    for (const s of ["W1", "W2"]) await passar(s, inicio + 20 * SEG);
    await avancarCorridas();
    await passar("W1", inicio + 12 * MIN + 2 * SEG);
    expect((await lerCorrida(id))?.estado).toBe("encerrando"); // Beto ainda na pista

    // Passam 3 minutos desde a bandeira: o prazo de espera (120 s) já acabou.
    await consultar(
      "update corrida set encerrando_em = now() - interval '3 minutes' where id = $1",
      [id],
    );
    await avancarCorridas();
    const c = (await lerCorrida(id))!;
    expect(c.estado).toBe("finalizada");
    expect(c.encerradaEm!.getTime() - c.encerrandoEm!.getTime()).toBe(
      120 * SEG,
    );
    expect(
      (await painel(id)).classificacao.find((l) => l.nome === "Beto")?.situacao,
    ).toBe("sem_volta");
  });

  it("isolamento: as passagens de uma corrida não entram na outra, mesmo com o sensor reaproveitado", async () => {
    const t = await agora();
    await passar("I1", t - 3600 * SEG);
    const a = await corridaPronta("Isolada A", [["Ana", "I1"]]);
    await iniciarCorrida(a.id, ator);
    await recuarInicio(a.id, 60 * MIN);
    const inicioA = (await lerCorrida(a.id))!.iniciadaEm!.getTime();
    await passar("I1", inicioA + 1 * MIN);
    await passar("I1", inicioA + 2 * MIN);
    await passar("I1", inicioA + 3 * MIN);
    await finalizarCorrida(a.id, ator);
    // A terminou há 50 minutos (as corridas não se sobrepõem no tempo).
    await consultar(
      "update corrida set encerrada_em = now() - interval '50 minutes', encerrando_em = now() - interval '50 minutes' where id = $1",
      [a.id],
    );
    const antes = (await painel(a.id)).classificacao[0];
    expect(antes.voltas).toBe(2);

    // Outro piloto usa o mesmo sensor numa corrida seguinte.
    const b = await corridaPronta("Isolada B", [["Bruno", "I1"]]);
    await iniciarCorrida(b.id, ator);
    await recuarInicio(b.id, 60 * SEG);
    const agoraB = await agora();
    await passar("I1", agoraB - 40 * SEG);
    await passar("I1", agoraB - 10 * SEG);
    const pb = await painel(b.id);
    expect(pb.classificacao[0]).toMatchObject({ nome: "Bruno", voltas: 1 });
    expect(pb.historico.every((h) => h.instanteMs > inicioA + 3 * MIN)).toBe(
      true,
    );
    // A corrida A continua exatamente como terminou.
    const depois = (await painel(a.id)).classificacao[0];
    expect(depois).toMatchObject({
      voltas: antes.voltas,
      melhorVoltaMs: antes.melhorVoltaMs,
    });
    await finalizarCorrida(b.id, ator);
  });

  it("passagens fora de ordem e leituras repetidas: o painel recalcula e explica", async () => {
    const t = await agora();
    await passar("O1", t - 3600 * SEG);
    const { id } = await corridaPronta("Fora de ordem", [["Olga", "O1"]]);
    await iniciarCorrida(id, ator);
    await recuarInicio(id, 5 * MIN);
    const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();

    await passar("O1", inicio + 10 * SEG);
    await passar("O1", inicio + 140 * SEG);
    let p = await painel(id);
    expect(p.classificacao[0].voltasLista.map((v) => v.tempoMs)).toEqual([
      130 * SEG,
    ]);

    // A leitura do meio chega atrasada (reconexão do coletor).
    await passar("O1", inicio + 75 * SEG);
    // e uma leitura repetida do mesmo cruzamento
    await passar("O1", inicio + 75 * SEG + 300);
    p = await painel(id);
    expect(p.classificacao[0].voltasLista.map((v) => v.tempoMs)).toEqual([
      65 * SEG,
      65 * SEG,
    ]);
    const repetida = p.historico.find((h) => h.status === "duplicada");
    expect(repetida).toBeTruthy();
    expect(repetida?.contada).toBe(false);
    expect(repetida?.motivo).toMatch(/Leitura repetida/);
    // Nada foi descartado em silêncio: todas as 4 leituras estão no histórico.
    expect(p.historico.filter((h) => h.transponder === "O1")).toHaveLength(4);
    expect(p.alertas.map((a) => a.texto).join(" ")).toMatch(
      /1 leitura\(s\) não contada\(s\)/,
    );
    await finalizarCorrida(id, ator);
  });

  it("correções administrativas preservam o original, o resultado publicado e a trilha", async () => {
    const t = await agora();
    await passar("X1", t - 3600 * SEG);
    const { id } = await corridaPronta("Corrigida", [["Xuxa", "X1"]]);
    await iniciarCorrida(id, ator);
    await recuarInicio(id, 6 * MIN);
    const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
    await passar("X1", inicio + 10 * SEG);
    await passar("X1", inicio + 70 * SEG);
    await passar("X1", inicio + 130 * SEG);
    await passar("X1", inicio + 190 * SEG);
    await finalizarCorrida(id, ator);

    let p = await painel(id);
    expect(p.classificacao[0].voltas).toBe(3);
    expect(p.corrigidaAposPublicar).toBe(false);
    const publicado = JSON.stringify((await lerCorrida(id))?.resultadoFinal);
    const [{ total }] = await consultar<{ total: number }>(
      "select count(*)::int as total from passagem where transponder = 'X1'",
    );

    // Invalida a 2ª passagem (leitura falsa): as voltas mudam, o original não.
    const falsa = p.historico.find((h) => h.instanteMs === inicio + 70 * SEG)!;
    expect(await erroDe(invalidarPassagem(id, falsa.id, "x", ator))).toMatch(
      /motivo/,
    );
    await invalidarPassagem(id, falsa.id, "leitura falsa do sensor", ator);
    expect(
      await erroDe(invalidarPassagem(id, falsa.id, "de novo", ator)),
    ).toMatch(/já está invalidada/);
    p = await painel(id);
    expect(p.classificacao[0].voltasLista.map((v) => v.tempoMs)).toEqual([
      120 * SEG,
      60 * SEG,
    ]);
    expect(p.historico.find((h) => h.id === falsa.id)).toMatchObject({
      status: "invalidada",
      contada: false,
    });
    expect(p.corrigidaAposPublicar).toBe(true);
    expect(JSON.stringify((await lerCorrida(id))?.resultadoFinal)).toBe(
      publicado,
    );
    const [{ total: depois }] = await consultar<{ total: number }>(
      "select count(*)::int as total from passagem where transponder = 'X1'",
    );
    expect(depois).toBe(total);

    // Anula a correção: volta ao que era.
    const correcao = p.correcoes[0];
    await anularCorrecao(correcao.id, "foi leitura boa", ator);
    expect(
      await erroDe(anularCorrecao(correcao.id, "outra vez", ator)),
    ).toMatch(/já foi anulada/);
    p = await painel(id);
    expect(p.classificacao[0].voltas).toBe(3);
    expect(p.corrigidaAposPublicar).toBe(false);
    expect(p.correcoes[0]).toMatchObject({
      anulada: true,
      motivoAnulacao: "foi leitura boa",
    });

    // Passagem inserida à mão (o decoder não leu): vale, marcada como manual.
    expect(
      await erroDe(
        inserirPassagemManual(id, p.grid[0].id, inicio - 5 * MIN, "fora", ator),
      ),
    ).toMatch(/dentro da bateria/);
    await inserirPassagemManual(
      id,
      p.grid[0].id,
      inicio + 250 * SEG,
      "decoder não leu",
      ator,
    );
    p = await painel(id);
    expect(p.classificacao[0].voltas).toBe(4);
    expect(p.historico.find((h) => h.origem === "manual")).toMatchObject({
      contada: true,
      transponder: "X1",
    });

    // O banco recusa apagar ou reescrever correções.
    await expect(consultar("delete from correcao_passagem")).rejects.toThrow(
      /não pode ser apagada/,
    );
    await expect(
      consultar("update correcao_passagem set motivo = 'outro'"),
    ).rejects.toThrow(/só pode ser anulada/);
    await expect(
      consultar(
        "update correcao_passagem set motivo_anulacao = 'x', anulada_em = now() where anulada_em is not null",
      ),
    ).rejects.toThrow(/só pode ser anulada/);

    // Auditoria: quem, o quê e por quê.
    const trilha = await consultar<{ acao: string; motivo: string | null }>(
      "select acao, motivo from audit_log where acao like 'corrida.passagem%' or acao like 'corrida.correcao%' order by id",
    );
    expect(trilha.map((x) => x.acao)).toEqual([
      "corrida.passagem_invalidar",
      "corrida.correcao_anular",
      "corrida.passagem_inserir",
    ]);
    expect(trilha[0].motivo).toBe("leitura falsa do sensor");
  });

  it("alertas: sensor desconhecido, transponder em manutenção e simulador", async () => {
    const t = await agora();
    await passar("AL1", t - 3600 * SEG);
    await passar("AL2", t - 3600 * SEG);
    await cadastrar("AL1");
    const { id } = await corridaPronta("Alertas", [["Ana", "AL1"]]);
    await iniciarCorrida(id, ator);
    await recuarInicio(id, 3 * MIN);
    const agoraC = await agora();

    await passar("AL2", agoraC - 30 * SEG); // desconhecido, sem piloto
    await passar("AL1", agoraC - 20 * SEG, simuladorId); // vem do simulador
    let p = await painel(id);
    const textos = p.alertas.map((a) => a.texto).join(" | ");
    expect(textos).toMatch(/desconhecido[(]s[)]/);
    expect(textos).toMatch(/SIMULADOR/);
    expect(p.detectados.find((d) => d.transponder === "AL2")).toMatchObject({
      cadastrado: false,
    });
    expect(p.historico.find((h) => h.simulado)).toBeTruthy();

    await consultar(
      "update transponder set status = 'manutencao' where codigo = 'AL1'",
    );
    p = await painel(id);
    expect(p.alertas.find((a) => a.nivel === "erro")?.texto).toMatch(
      /em manutenção/,
    );
    await cancelarCorrida(id, "fim do teste de alertas", ator);
  });

  it("valida a configuração da corrida", async () => {
    expect(
      await erroDe(criarCorrida({ nome: "Rápida", tempoMinimoMs: 100 }, ator)),
    ).toMatch(/Tempo mínimo/);
    expect(
      await erroDe(criarCorrida({ nome: "Longa", duracaoMin: 999 }, ator)),
    ).toMatch(/Duração/);
    expect(
      await erroDe(
        criarCorrida(
          { nome: "X", modoEncerramento: "inventado" as never },
          ator,
        ),
      ),
    ).toMatch(/encerramento/);
    expect(await erroDe(criarCorrida({ nome: "" }, ator))).toMatch(/nome/);
  });
});
