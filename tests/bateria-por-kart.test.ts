import { PDFDocument } from "pdf-lib";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  lerModeloDeVinculo,
  salvarKart,
  salvarModeloDeVinculo,
  sensoresSemKart,
  lerTransponder,
} from "@/lib/cronometragem/cadastros-store";
import {
  adicionarPiloto,
  cancelarCorrida,
  criarCorrida,
  finalizarCorrida,
  iniciarCorrida,
  lerCorrida,
  lerPainel,
  nomearParticipante,
  novaBateriaRapida,
} from "@/lib/cronometragem/corridas-store";
import {
  criarDecoder,
  registrarPassagens,
} from "@/lib/cronometragem/decoders-store";
import { gerarPdf, type TipoRelatorio } from "@/lib/cronometragem/pdf";
import { montarQualy, montarVoltaAVolta } from "@/lib/cronometragem/relatorios";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

// A rota de PDF lê a sessão pelo cookie; nos testes a sessão é simulada.
const sessaoSimulada = vi.hoisted(() => ({ atual: null as unknown }));
vi.mock("@/lib/auth", () => ({
  exigirPermissao: async () => sessaoSimulada.atual,
  ipDaRequisicao: async () => null,
}));

const SEG = 1000;
const MIN = 60 * SEG;

describe.skipIf(!temBancoDeTeste)(
  "bateria no estilo LapTime (por kart)",
  () => {
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

    async function recuarInicio(id: string, ms: number) {
      await consultar(
        "update corrida set iniciada_em = iniciada_em - make_interval(secs => $2::float8 / 1000.0) where id = $1",
        [id, ms],
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

    async function kartDoSensor(numero: string, sensor: string) {
      await salvarKart(
        null,
        { numero, status: "ativo", transponderFixo: sensor },
        ator,
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

    it("o padrão da instalação é o transponder fixo no kart", async () => {
      expect(await lerModeloDeVinculo()).toBe("kart");
      await expect(
        salvarModeloDeVinculo("kart", ator),
      ).resolves.toBeUndefined();
    });

    it("cada kart recebe um sensor: o sensor lido vira kart cadastrado", async () => {
      const t = await agora();
      for (const s of ["KA", "KB", "KC", "KD"]) await passar(s, t - 3600 * SEG);
      expect((await sensoresSemKart()).map((s) => s.codigo).sort()).toEqual([
        "KA",
        "KB",
        "KC",
        "KD",
      ]);

      await kartDoSensor("7", "KA");
      await kartDoSensor("8", "KB");
      await kartDoSensor("9", "KC");
      expect((await sensoresSemKart()).map((s) => s.codigo)).toEqual(["KD"]);
      expect(await lerTransponder("KA")).toMatchObject({
        cadastrado: true,
        rotulo: "Kart 7",
        kartFixo: "7",
      });
      expect(await erroDe(kartDoSensor("10", "KA"))).toMatch(/já está no kart/);
      // kart em manutenção não entra sozinho na bateria
      await consultar(
        "update kart set status = 'manutencao' where numero = '9'",
      );
    });

    it("a bateria começa sem grid e o kart entra sozinho na 1ª passagem, sem nome", async () => {
      const id = await criarCorrida({ nome: "Bateria LapTime" }, ator);
      // sem pilotos e sem "confirmar grid": inicia direto
      await iniciarCorrida(id, ator);
      expect((await lerCorrida(id))?.estado).toBe("em_andamento");
      await recuarInicio(id, 5 * MIN);
      const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();

      // antes da largada ninguém entra
      await passar("KA", inicio - 10 * SEG);
      expect((await lerPainel(id))!.grid).toHaveLength(0);

      await passar("KA", inicio + 20 * SEG); // kart 7, 1ª passagem
      await passar("KB", inicio + 22 * SEG); // kart 8
      await passar("KC", inicio + 24 * SEG); // kart 9 (manutenção): não entra
      await passar("KD", inicio + 26 * SEG); // sem kart: não entra
      let p = (await lerPainel(id))!;
      expect(
        p.grid.map((g) => [g.nome, g.kartNumero, g.nomeado]).sort(),
      ).toEqual([
        ["Kart 7", "7", false],
        ["Kart 8", "8", false],
      ]);
      // sensor sem kart / kart em manutenção aparecem como "sem piloto"
      expect(p.detectados.map((d) => d.transponder).sort()).toEqual([
        "KC",
        "KD",
      ]);

      // mais passagens do mesmo kart não criam outro participante
      await passar("KA", inicio + 80 * SEG);
      await passar("KA", inicio + 140 * SEG);
      await passar("KB", inicio + 90 * SEG);
      await passar("KB", inicio + 150 * SEG);
      p = (await lerPainel(id))!;
      expect(p.grid).toHaveLength(2);
      expect(p.classificacao.map((l) => [l.nome, l.voltas])).toEqual([
        ["Kart 7", 2],
        ["Kart 8", 2],
      ]);
      await finalizarCorrida(id, ator);
    });

    it("o nome do piloto é dado depois da 1ª passagem (digitado ou escolhido na lista)", async () => {
      const t = await agora();
      const id = await criarCorrida({ nome: "Nomes" }, ator);
      await adicionarPiloto(id, "Beto da Lista", ator); // piloto sem kart (lista)
      await iniciarCorrida(id, ator);
      await recuarInicio(id, 4 * MIN);
      const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
      await passar("KA", inicio + 10 * SEG);
      await passar("KB", inicio + 12 * SEG);
      let p = (await lerPainel(id))!;
      const k7 = p.grid.find((g) => g.kartNumero === "7")!;
      const k8 = p.grid.find((g) => g.kartNumero === "8")!;
      const beto = p.grid.find((g) => g.nome === "Beto da Lista")!;
      expect(beto.transponder).toBeUndefined();

      await nomearParticipante(k7.id, { nome: "  Ana Souza " }, ator);
      expect(
        await erroDe(nomearParticipante(k8.id, { nome: "x" }, ator)),
      ).toMatch(/Informe o nome/);
      // escolhe o piloto da lista: o nome vem dele e a linha da lista some
      await nomearParticipante(k8.id, { pendenteId: beto.id }, ator);
      expect(
        await erroDe(nomearParticipante(k8.id, { pendenteId: beto.id }, ator)),
      ).toMatch(/não está mais disponível/);

      p = (await lerPainel(id))!;
      expect(
        p.grid.map((g) => [g.nome, g.kartNumero, g.nomeado]).sort(),
      ).toEqual([
        ["Ana Souza", "7", true],
        ["Beto da Lista", "8", true],
      ]);
      expect(p.classificacao.map((l) => l.nome).sort()).toEqual([
        "Ana Souza",
        "Beto da Lista",
      ]);

      // dá para corrigir o nome mesmo depois da bateria terminar...
      await finalizarCorrida(id, ator);
      await nomearParticipante(k7.id, { nome: "Ana S. Souza" }, ator);
      expect(
        (await lerPainel(id))!.grid.find((g) => g.kartNumero === "7")?.nome,
      ).toBe("Ana S. Souza");
      // ...mas não numa bateria cancelada
      const outra = await criarCorrida({ nome: "Cancelada" }, ator);
      await adicionarPiloto(outra, "Zé", ator);
      const ze = (await lerPainel(outra))!.grid[0];
      await cancelarCorrida(outra, "teste", ator);
      expect(
        await erroDe(nomearParticipante(ze.id, { nome: "Zé 2" }, ator)),
      ).toMatch(/cancelada/);
      expect(t).toBeGreaterThan(0);
    });

    it("qualy (melhor volta), volta a volta e resultado final saem da mesma bateria", async () => {
      // Karts só deste teste (as passagens de outros testes não se misturam).
      const t0 = await agora();
      await passar("KE", t0 - 3600 * SEG);
      await passar("KF", t0 - 3600 * SEG);
      await kartDoSensor("11", "KE");
      await kartDoSensor("12", "KF");
      const id = await criarCorrida({ nome: "Relatórios" }, ator);
      await iniciarCorrida(id, ator);
      await recuarInicio(id, 6 * MIN);
      const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
      // Kart 7: 3 voltas de 70 s. Kart 8: 2 voltas de 60 s (melhor volta, menos voltas).
      for (const t of [10, 80, 150, 220]) await passar("KE", inicio + t * SEG);
      for (const t of [12, 72, 132]) await passar("KF", inicio + t * SEG);
      const p = (await lerPainel(id))!;
      const k7 = p.grid.find((g) => g.kartNumero === "11")!;
      const k8 = p.grid.find((g) => g.kartNumero === "12")!;
      await nomearParticipante(k7.id, { nome: "Ana" }, ator);
      await nomearParticipante(k8.id, { nome: "Beto" }, ator);
      await finalizarCorrida(id, ator);
      const fim = (await lerPainel(id))!;

      // resultado final: mais voltas primeiro
      expect(fim.classificacao.map((l) => [l.nome, l.voltas])).toEqual([
        ["Ana", 3],
        ["Beto", 2],
      ]);
      // qualy: melhor volta primeiro (não o número de voltas)
      const qualy = montarQualy(fim.classificacao);
      expect(qualy.map((q) => [q.posicao, q.nome, q.melhorVoltaMs])).toEqual([
        [1, "Beto", 60 * SEG],
        [2, "Ana", 70 * SEG],
      ]);
      expect(qualy[1].diferencaMs).toBe(10 * SEG);
      expect(qualy[1].mediaMs).toBe(70 * SEG);
      // volta a volta: uma linha por volta, uma coluna por piloto
      const m = montarVoltaAVolta(fim.classificacao);
      expect(m.participantes.map((x) => x.nome)).toEqual(["Ana", "Beto"]);
      expect(m.linhas.map((l) => l.tempos)).toEqual([
        [70 * SEG, 60 * SEG],
        [70 * SEG, 60 * SEG],
        [70 * SEG, null],
      ]);
      expect(m.melhores).toEqual([70 * SEG, 60 * SEG]);
      expect(m.melhorGeral).toBe(60 * SEG);
    });

    it("gera o PDF (completo, qualy, volta a volta e resultado) com várias páginas quando precisa", async () => {
      const id = await criarCorrida({ nome: "Bateria dos PDFs" }, ator);
      await iniciarCorrida(id, ator);
      await recuarInicio(id, 10 * MIN);
      const inicio = (await lerCorrida(id))!.iniciadaEm!.getTime();
      await passar("KA", inicio + 10 * SEG);
      await passar("KA", inicio + 70 * SEG);
      await finalizarCorrida(id, ator);
      const p = (await lerPainel(id))!;
      const dados = {
        bateria: p.corrida.nome,
        situacao: "Finalizada",
        iniciadaEm: p.corrida.iniciadaEm,
        encerradaEm: p.corrida.encerradaEm,
        duracaoMin: p.corrida.duracaoMin,
        tempoMinimoMs: p.corrida.tempoMinimoMs,
        classificacao: p.classificacao,
        parcial: false,
        geradoEm: new Date(),
      };
      const paginas: Record<TipoRelatorio, number> = {
        resultado: 1,
        qualy: 1,
        voltas: 1,
        completo: 3,
      };
      for (const tipo of Object.keys(paginas) as TipoRelatorio[]) {
        const pdf = await gerarPdf(tipo, dados);
        expect(Buffer.from(pdf.slice(0, 5)).toString("latin1")).toBe("%PDF-");
        expect(pdf.length).toBeGreaterThan(1500);
        expect((await PDFDocument.load(pdf)).getPageCount()).toBe(
          paginas[tipo],
        );
      }

      // muitos pilotos: a tabela quebra de página e o volta a volta divide as colunas
      const muitos = Array.from({ length: 70 }, (_, i) => ({
        ...p.classificacao[0],
        participanteId: `p${i}`,
        nome: `Piloto com nome acentuado número ${i + 1} — çãõé`,
        posicao: i + 1,
      }));
      const grande = await gerarPdf("completo", {
        ...dados,
        classificacao: muitos,
      });
      expect((await PDFDocument.load(grande)).getPageCount()).toBeGreaterThan(
        4,
      );
    });

    it("a rota do PDF exige login, só imprime bateria iniciada e baixa quando pedido", async () => {
      const { GET } =
        await import("@/app/api/cronometragem/corridas/[id]/relatorio/route");
      const chamar = (id: string, consulta = "") =>
        GET(
          new Request(
            `http://localhost/api/cronometragem/corridas/${id}/relatorio${consulta}`,
          ),
          { params: Promise.resolve({ id }) },
        );

      const id = await criarCorrida({ nome: "Rota do PDF" }, ator);
      sessaoSimulada.atual = null;
      expect((await chamar(id)).status).toBe(401);

      sessaoSimulada.atual = { id: "u1", papel: "admin" };
      expect((await chamar("nao-existe")).status).toBe(404);
      expect((await chamar(id)).status).toBe(400); // ainda não começou
      expect((await chamar(id, "?tipo=inventado")).status).toBe(400);

      await iniciarCorrida(id, ator);
      await finalizarCorrida(id, ator);
      const aberto = await chamar(id, "?tipo=qualy");
      expect(aberto.status).toBe(200);
      expect(aberto.headers.get("content-type")).toBe("application/pdf");
      expect(aberto.headers.get("content-disposition")).toMatch(
        /^inline; filename=".*qualificacao\.pdf"$/,
      );
      const baixado = await chamar(id, "?baixar=1");
      expect(baixado.headers.get("content-disposition")).toMatch(
        /^attachment; filename=".*relatorio-completo\.pdf"$/,
      );
      const bytes = new Uint8Array(await baixado.arrayBuffer());
      expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    });

    it("nova bateria com um clique: repete as regras e recomeça o ciclo", async () => {
      const anterior = await criarCorrida(
        {
          nome: "Com regras próprias",
          duracaoMin: 15,
          tempoMinimoMs: 7_000,
          modoEncerramento: "proxima_passagem",
          esperaFinalS: 90,
        },
        ator,
      );
      await iniciarCorrida(anterior, ator);
      await finalizarCorrida(anterior, ator);

      const nova = await novaBateriaRapida(ator);
      const c = (await lerCorrida(nova))!;
      expect(c).toMatchObject({
        estado: "preparada",
        duracaoMin: 15,
        tempoMinimoMs: 7_000,
        modoEncerramento: "proxima_passagem",
        esperaFinalS: 90,
      });
      expect(c.nome).toMatch(/^Bateria \d{2}:\d{2}$/);
      // outro clique não empilha baterias vazias
      expect(await novaBateriaRapida(ator)).toBe(nova);

      // e o ciclo recomeça: inicia direto e os karts entram sozinhos de novo
      await iniciarCorrida(nova, ator);
      await recuarInicio(nova, 2 * MIN);
      const inicio = (await lerCorrida(nova))!.iniciadaEm!.getTime();
      await passar("KA", inicio + 30 * SEG);
      expect((await lerPainel(nova))!.grid.map((g) => g.kartNumero)).toEqual([
        "7",
      ]);
      await finalizarCorrida(nova, ator);
    });

    it("no modelo 'piloto' a bateria continua exigindo o grid confirmado", async () => {
      await salvarModeloDeVinculo("piloto", ator);
      try {
        const id = await criarCorrida({ nome: "Modelo piloto" }, ator);
        expect(await erroDe(iniciarCorrida(id, ator))).toMatch(
          /Marcar como pronta/,
        );
      } finally {
        await salvarModeloDeVinculo("kart", ator);
      }
    });
  },
);
