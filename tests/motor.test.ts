import { describe, expect, it } from "vitest";
import {
  avaliarCorrida,
  type ConfigMotor,
  type ParticipanteMotor,
  type PassagemMotor,
} from "@/lib/cronometragem/motor";

// Dados fictícios. T0 = 10:00:00.000 de um dia qualquer.
const T0 = Date.UTC(2026, 9, 24, 13, 0, 0);
const INICIO = T0 - 5_000;

const base: ConfigMotor = {
  tempoMinimoMs: 10_000,
  regraLargada: "primeira_passagem",
  modoEncerramento: "manual",
  iniciadaEmMs: INICIO,
  encerrandoEmMs: null,
  finalizadaEmMs: null,
};

const bia: ParticipanteMotor = {
  id: "p1",
  nome: "Bia",
  transponder: "S1",
  kartNumero: "7",
};
const caio: ParticipanteMotor = { id: "p2", nome: "Caio", transponder: "S2" };

let contador = 0;
function p(transponder: string, deslocamentoMs: number): PassagemMotor {
  contador += 1;
  return {
    id: String(contador),
    transponder,
    instanteMs: T0 + deslocamentoMs,
    origem: "decoder",
  };
}

function rodar(
  passagens: PassagemMotor[],
  config: Partial<ConfigMotor> = {},
  participantes: ParticipanteMotor[] = [bia, caio],
  invalidacoes: { passagemId: string; motivo: string }[] = [],
) {
  return avaliarCorrida({
    config: { ...base, ...config },
    participantes,
    passagens,
    invalidacoes,
  });
}

describe("motor: tempos das voltas", () => {
  it("calcula os intervalos entre passagens em milissegundos inteiros", () => {
    // 10:00:00.000, 10:00:52.380, 10:01:44.920 (exemplo fictício)
    const r = rodar([p("S1", 0), p("S1", 52_380), p("S1", 104_920)]);
    const bia1 = r.classificacao.find((l) => l.nome === "Bia");
    expect(bia1?.voltasLista.map((v) => v.tempoMs)).toEqual([52_380, 52_540]);
    expect(bia1?.melhorVoltaMs).toBe(52_380);
    expect(bia1?.ultimaVoltaMs).toBe(52_540);
    expect(Number.isInteger(bia1?.tempoTotalMs)).toBe(true);
    expect(bia1?.tempoTotalMs).toBe(104_920);
  });

  it("a primeira passagem é a largada e não é uma volta completa", () => {
    const r = rodar([p("S1", 0)]);
    expect(r.passagens[0]).toMatchObject({ status: "largada", contada: true });
    expect(r.passagens[0].numeroVolta).toBeUndefined();
    expect(r.classificacao.find((l) => l.nome === "Bia")).toMatchObject({
      voltas: 0,
      situacao: "em_pista",
      posicao: null,
    });
  });

  it("com a regra 'largada da corrida' a volta 1 conta desde o início", () => {
    const r = rodar([p("S1", 52_000)], { regraLargada: "largada_da_corrida" });
    const linha = r.classificacao.find((l) => l.nome === "Bia");
    expect(linha?.voltasLista[0]).toMatchObject({ numero: 1, tempoMs: 57_000 });
    // tempo total vai da largada da corrida ao fim da volta
    expect(linha?.tempoTotalMs).toBe(57_000);
  });

  it("leitura logo após a largada da corrida (menor que o mínimo) é rejeitada", () => {
    const r = rodar([p("S1", -2_000)], { regraLargada: "largada_da_corrida" });
    expect(r.passagens[0]).toMatchObject({
      status: "duplicada",
      contada: false,
    });
    expect(r.passagens[0].motivo).toMatch(/largada da corrida/);
  });

  it("arredonda cada instante a milissegundo antes de subtrair", () => {
    const r = rodar([
      { id: "a", transponder: "S1", instanteMs: T0 + 0.4, origem: "decoder" },
      {
        id: "b",
        transponder: "S1",
        instanteMs: T0 + 65_000.6,
        origem: "decoder",
      },
    ]);
    expect(r.classificacao[0].voltasLista[0].tempoMs).toBe(65_001);
  });
});

describe("motor: leituras duplicadas e inválidas", () => {
  it("não conta a leitura repetida e registra o motivo", () => {
    const r = rodar([
      p("S1", 0),
      p("S1", 300),
      p("S1", 60_000),
      p("S1", 60_200),
    ]);
    const status = r.passagens.map((x) => x.status);
    expect(status).toEqual(["largada", "duplicada", "volta", "duplicada"]);
    expect(r.passagens[1].motivo).toMatch(/Leitura repetida/);
    const linha = r.classificacao.find((l) => l.nome === "Bia");
    expect(linha?.voltas).toBe(1);
    expect(linha?.voltasLista[0].tempoMs).toBe(60_000);
    expect(linha?.naoContadas).toBe(2);
  });

  it("o intervalo mínimo é configurável (mesma leitura vale numa pista curta)", () => {
    const leituras = [p("S1", 0), p("S1", 6_000)];
    expect(rodar(leituras).passagens[1].status).toBe("duplicada");
    expect(rodar(leituras, { tempoMinimoMs: 3_000 }).passagens[1].status).toBe(
      "volta",
    );
  });

  it("o mesmo instante lido por dois equipamentos conta uma vez", () => {
    const r = rodar([p("S1", 0), p("S1", 60_000), p("S1", 60_000)]);
    expect(r.passagens.map((x) => x.status)).toEqual([
      "largada",
      "volta",
      "duplicada",
    ]);
  });

  it("sensor sem piloto na corrida fica registrado como tal", () => {
    const r = rodar([p("S9", 1_000)]);
    expect(r.passagens[0]).toMatchObject({
      status: "sem_participante",
      contada: false,
      participanteId: null,
    });
  });
});

describe("motor: ordem e janela da corrida", () => {
  it("passagens fora de ordem dão o mesmo resultado que em ordem", () => {
    const certas = [p("S1", 0), p("S1", 65_000), p("S1", 129_000)];
    const embaralhadas = [certas[2], certas[0], certas[1]];
    const a = rodar(certas).classificacao[0].voltasLista;
    const b = rodar(embaralhadas).classificacao[0].voltasLista;
    expect(b).toEqual(a);
    expect(a.map((v) => v.tempoMs)).toEqual([65_000, 64_000]);
  });

  it("passagem que chega atrasada (instante antigo) entra no lugar certo", () => {
    const sem = rodar([p("S1", 0), p("S1", 130_000)]).classificacao[0];
    expect(sem.voltasLista.map((v) => v.tempoMs)).toEqual([130_000]);
    const com = rodar([p("S1", 0), p("S1", 130_000), p("S1", 65_000)])
      .classificacao[0];
    expect(com.voltasLista.map((v) => v.tempoMs)).toEqual([65_000, 65_000]);
  });

  it("leitura antes da largada e depois do fim ficam fora da corrida", () => {
    const r = rodar(
      [p("S1", -60_000), p("S1", 0), p("S1", 70_000), p("S1", 200_000)],
      { finalizadaEmMs: T0 + 100_000 },
    );
    expect(r.passagens.map((x) => x.status)).toEqual([
      "antes_da_largada",
      "largada",
      "volta",
      "depois_do_fim",
    ]);
  });

  it("sem largada registrada nada conta", () => {
    const r = rodar([p("S1", 0)], { iniciadaEmMs: null });
    expect(r.passagens[0].status).toBe("antes_da_largada");
  });
});

describe("motor: encerramento", () => {
  const bandeira = T0 + 100_000;

  it("'próxima passagem': a primeira passagem depois da bandeira é a volta final", () => {
    const r = rodar(
      [
        p("S1", 0),
        p("S1", 60_000),
        p("S1", 112_000), // depois da bandeira → volta final
        p("S1", 170_000), // depois de terminar → não conta
      ],
      { modoEncerramento: "proxima_passagem", encerrandoEmMs: bandeira },
    );
    expect(r.passagens.map((x) => x.status)).toEqual([
      "largada",
      "volta",
      "volta_final",
      "apos_bandeira",
    ]);
    const bia1 = r.classificacao.find((l) => l.nome === "Bia");
    expect(bia1).toMatchObject({ voltas: 2, situacao: "finalizou" });
    expect(bia1?.voltasLista.at(-1)?.final).toBe(true);
    // Caio não passou: continua na pista
    expect(r.classificacao.find((l) => l.nome === "Caio")?.situacao).toBe(
      "aguardando_largada",
    );
  });

  it("'corte imediato': passagem depois do fim do tempo não conta", () => {
    const r = rodar([p("S1", 0), p("S1", 60_000), p("S1", 104_000)], {
      modoEncerramento: "corte_imediato",
      encerrandoEmMs: bandeira,
    });
    expect(r.passagens.map((x) => x.status)).toEqual([
      "largada",
      "volta",
      "depois_do_fim",
    ]);
  });

  it("'manual': as passagens continuam valendo depois da bandeira até finalizar", () => {
    const r = rodar([p("S1", 0), p("S1", 60_000), p("S1", 112_000)], {
      modoEncerramento: "manual",
      encerrandoEmMs: bandeira,
    });
    expect(r.passagens.map((x) => x.status)).toEqual([
      "largada",
      "volta",
      "volta",
    ]);
  });

  it("corrida finalizada: quem fez volta finalizou; quem não largou, não", () => {
    const r = rodar([p("S1", 0), p("S1", 60_000)], {
      finalizadaEmMs: T0 + 130_000,
    });
    expect(r.classificacao.find((l) => l.nome === "Bia")?.situacao).toBe(
      "finalizou",
    );
    expect(r.classificacao.find((l) => l.nome === "Caio")?.situacao).toBe(
      "nao_largou",
    );
  });
});

describe("motor: correções administrativas", () => {
  it("passagem invalidada deixa de contar e a volta seguinte é recalculada", () => {
    const leituras = [p("S1", 0), p("S1", 60_000), p("S1", 120_000)];
    const antes = rodar(leituras).classificacao[0];
    expect(antes.voltasLista.map((v) => v.tempoMs)).toEqual([60_000, 60_000]);

    const depois = rodar(
      leituras,
      {},
      [bia, caio],
      [{ passagemId: leituras[1].id, motivo: "leitura falsa" }],
    );
    expect(depois.passagens[1]).toMatchObject({
      status: "invalidada",
      contada: false,
    });
    expect(depois.passagens[1].motivo).toMatch(/leitura falsa/);
    expect(depois.classificacao[0].voltasLista.map((v) => v.tempoMs)).toEqual([
      120_000,
    ]);
  });

  it("passagem inserida manualmente entra como qualquer outra", () => {
    const leituras = [
      p("S1", 0),
      p("S1", 130_000),
      {
        id: "manual-1",
        transponder: "S1",
        instanteMs: T0 + 65_000,
        origem: "manual" as const,
      },
    ];
    const r = rodar(leituras);
    expect(r.classificacao[0].voltasLista.map((v) => v.tempoMs)).toEqual([
      65_000, 65_000,
    ]);
  });
});

describe("motor: classificação", () => {
  const grid: ParticipanteMotor[] = [
    { id: "p1", nome: "Bia", transponder: "S1" },
    { id: "p2", nome: "Caio", transponder: "S2" },
    { id: "p3", nome: "Duda", transponder: "S3" },
    { id: "p4", nome: "Edu", transponder: "S4" },
    { id: "p5", nome: "Fabi", transponder: null },
  ];

  it("ordena por voltas e, empatando, por quem cruzou a linha antes", () => {
    const r = rodar(
      [
        p("S1", 0),
        p("S1", 65_000),
        p("S1", 129_000),
        p("S2", 2_000),
        p("S2", 66_500),
        p("S2", 131_000),
        p("S3", 3_000),
        p("S3", 70_000),
      ],
      {},
      grid,
    );
    const c = r.classificacao;
    expect(c.map((l) => l.nome)).toEqual([
      "Bia",
      "Caio",
      "Duda",
      "Edu",
      "Fabi",
    ]);
    expect(c.map((l) => l.posicao)).toEqual([1, 2, 3, null, null]);
    expect(c[0]).toMatchObject({
      voltas: 2,
      melhorVoltaMs: 64_000,
      diferenca: { tipo: "lider" },
    });
    expect(c[1].diferenca).toEqual({ tipo: "tempo", ms: 2_000 });
    expect(c[2]).toMatchObject({
      voltas: 1,
      diferenca: { tipo: "voltas", voltas: 1 },
    });
    expect(c[4].situacao).toBe("sem_sensor");
  });

  it("não ordena só pela melhor volta", () => {
    // Caio tem a melhor volta, mas Bia deu mais voltas.
    const r = rodar(
      [
        p("S1", 0),
        p("S1", 70_000),
        p("S1", 140_000),
        p("S2", 0),
        p("S2", 40_000),
      ],
      {},
      grid,
    );
    expect(r.classificacao[0].nome).toBe("Bia");
    expect(r.classificacao[0].melhorVoltaMs).toBe(70_000);
    expect(r.classificacao[1].nome).toBe("Caio");
    expect(r.classificacao[1].melhorVoltaMs).toBe(40_000);
  });

  it("separa tempo de volta, tempo total e última passagem", () => {
    const r = rodar([p("S1", 3_000), p("S1", 63_000), p("S1", 120_000)]);
    const linha = r.classificacao[0];
    expect(linha.ultimaVoltaMs).toBe(57_000);
    expect(linha.tempoTotalMs).toBe(117_000);
    expect(linha.ultimaPassagemMs).toBe(T0 + 120_000);
  });

  it("sem passagens ninguém tem posição", () => {
    const r = rodar([], {}, grid);
    expect(
      r.classificacao.every((l) => l.posicao === null && l.voltas === 0),
    ).toBe(true);
  });
});

describe("motor: ocorrências (DNS, DNF, DSQ) e penalidades", () => {
  // Bia e Caio fecham 2 voltas; Caio chega 1 s antes da Bia.
  const duas = () => [
    p("S1", 0),
    p("S1", 50_000),
    p("S1", 100_000),
    p("S2", 0),
    p("S2", 49_000),
    p("S2", 99_000),
  ];

  it("a penalidade soma ao tempo total e pode inverter a ordem de chegada", () => {
    const sem = rodar(duas());
    expect(sem.classificacao.map((l) => l.nome)).toEqual(["Caio", "Bia"]);
    const com = rodar(duas(), {}, [bia, { ...caio, penalidadeMs: 5_000 }]);
    expect(com.classificacao.map((l) => [l.nome, l.posicao])).toEqual([
      ["Bia", 1],
      ["Caio", 2],
    ]);
    const c = com.classificacao.find((l) => l.nome === "Caio")!;
    expect(c.penalidadeMs).toBe(5_000);
    expect(c.tempoTotalMs).toBe(99_000 + 5_000);
    // as voltas continuam intactas
    expect(c.voltasLista.map((v) => v.tempoMs)).toEqual([49_000, 50_000]);
  });

  it("DSQ e DNS ficam sem posição e no fim; DNF fica atrás de quem terminou", () => {
    const r = rodar([...duas(), p("S3", 0), p("S3", 60_000)], {}, [
      { ...bia, situacaoManual: "dsq" },
      caio,
      { id: "p3", nome: "Dora", transponder: "S3", situacaoManual: "dnf" },
      { id: "p4", nome: "Edu", transponder: "S4", situacaoManual: "dns" },
    ]);
    expect(r.classificacao.map((l) => [l.nome, l.posicao, l.situacao])).toEqual(
      [
        ["Caio", 1, r.classificacao[0].situacao],
        ["Dora", 2, "dnf"],
        ["Edu", null, "dns"],
        ["Bia", null, "dsq"],
      ],
    );
  });

  it("desclassificar o líder passa a liderança ao seguinte", () => {
    const r = rodar(duas(), {}, [bia, { ...caio, situacaoManual: "dsq" }]);
    expect(r.classificacao[0]).toMatchObject({ nome: "Bia", posicao: 1 });
    expect(r.classificacao[0].diferenca).toEqual({ tipo: "lider" });
  });
});
