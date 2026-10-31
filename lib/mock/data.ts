// Dados fictícios para desenvolvimento local, sem depender do Supabase ainda.
// O shape de cada array segue lib/types.ts, que por sua vez espelha as tabelas
// planejadas em supabase/migrations — trocar por queries reais deve ser um
// find/replace da fonte dos dados, não da forma dos dados.

import type {
  Bateria,
  Campeonato,
  Categoria,
  Etapa,
  Inscricao,
  Kart,
  LogSistema,
  Pagamento,
  Patrocinador,
  Perfil,
  Piloto,
  Punicao,
  Resultado,
  Tracado,
} from "@/lib/types";
import { ROTA_EXEMPLO } from "@/lib/tracado3d/rota-exemplo";

// Pilotos, baterias e resultados são os dados "de corrida": começam vazios e
// só ganham conteúdo quando a simulação é ligada no painel admin
// (lib/simulacao.ts). Os arrays ficam em globalThis e são alterados no lugar
// (splice) — assim todas as páginas, rotas de API e o instrumentation, que o
// Next compila em pacotes separados, enxergam os mesmos dados.
interface EstadoDados {
  pilotos: Piloto[];
  baterias: Bateria[];
  resultados: Resultado[];
  simulacaoAtiva: boolean;
}
const estado = ((
  globalThis as typeof globalThis & { __gridlapDados?: EstadoDados }
).__gridlapDados ??= {
  pilotos: [],
  baterias: [],
  resultados: [],
  simulacaoAtiva: false,
});

export function simulacaoEstaAtiva() {
  return estado.simulacaoAtiva;
}

// Troca o conteúdo dos arrays de corrida (usado pela simulação no servidor e
// pelo componente de traçados no navegador, que precisa do mesmo snapshot).
export function substituirDadosDeCorrida(dados: {
  pilotos: Piloto[];
  baterias: Bateria[];
  resultados: Resultado[];
  simulacaoAtiva: boolean;
}) {
  estado.pilotos.splice(0, estado.pilotos.length, ...dados.pilotos);
  estado.baterias.splice(0, estado.baterias.length, ...dados.baterias);
  estado.resultados.splice(0, estado.resultados.length, ...dados.resultados);
  estado.simulacaoAtiva = dados.simulacaoAtiva;
}

// Simulação de uma etapa completa (Copa VeloKart) — balizamento, sorteio de
// kart (sem repetir o mesmo kart pro mesmo piloto entre classificatória e
// final), classificatória, final e classificação geral. Serve de exemplo
// pra ver o site/overlay funcionando de ponta a ponta com dados realistas.
export const campeonatos: Campeonato[] = [
  {
    id: "camp-copa-velokart",
    nome: "Copa VeloKart",
    temporada: "2026",
    slug: "copa-velokart",
    descricao: "Campeonato oficial de kart amador do VeloKart.",
    ativo: true,
  },
];
export const campeonato: Campeonato | undefined = campeonatos.find(
  (c) => c.ativo,
);

export const categorias: Categoria[] = [
  {
    id: "cat-master",
    nome: "Master",
    nivel: "master",
    slug: "master",
    descricao: "Categoria para pilotos experientes, +18 anos.",
    pesoMinimoKg: 70,
  },
];

export const etapas: Etapa[] = [
  {
    id: "etapa-1-copa-velokart",
    campeonatoId: "camp-copa-velokart",
    numero: 1,
    nome: "Etapa 1",
    kartodromo: "VeloKart",
    cidade: "Cotia",
    data: "2026-09-14",
    status: "agendada",
    tracadoId: "tracado-copa-velokart",
  },
  {
    id: "etapa-2-copa-velokart",
    campeonatoId: "camp-copa-velokart",
    numero: 2,
    nome: "Etapa 2",
    kartodromo: "VeloKart",
    cidade: "Cotia",
    data: "2026-09-21",
    status: "agendada",
  },
];

// Configurações de traçado do kartódromo (o mesmo kartódromo pode ser
// percorrido de formas diferentes). Cada etapa referencia um tracadoId
// opcional.
export const tracados: Tracado[] = [
  {
    id: "tracado-copa-velokart",
    nome: "Reta dos boxes (exemplo)",
    descricao:
      "Rota de exemplo no modelo 3D, provisória. Redesenhe o traçado oficial em Admin > Traçados.",
    extensaoMetros: 129,
    fechado: false,
    pontos: ROTA_EXEMPLO,
  },
];

// Pilotos cadastrados em /cadastro persistem em lib/pilotos-store.ts (um
// arquivo no servidor). Este array guarda só os pilotos SIMULADOS (vazio com a
// simulação desligada), pra os helpers síncronos (getPilotoById etc.)
// enxergarem os mesmos pilotos que os resultados simulados referenciam.
export const pilotos: Piloto[] = estado.pilotos;

// Frota física de karts do kartódromo — independe de qual campeonato/etapa
// está rodando, por isso continua populada mesmo com o restante zerado.
export const karts: Kart[] = Array.from({ length: 24 }, (_, i) => {
  const numero = i + 1;
  return {
    id: `kart-${String(numero).padStart(2, "0")}`,
    numero,
    placa: String(numero).padStart(2, "0"),
    status: "disponivel",
  } satisfies Kart;
});

export const baterias: Bateria[] = estado.baterias;

export const resultados: Resultado[] = estado.resultados;

export const inscricoes: Inscricao[] = [];

export const pagamentos: Pagamento[] = [];

export const punicoes: Punicao[] = [];

export const perfis: Perfil[] = [
  {
    id: "perfil-admin",
    userId: "user-admin",
    nome: "Equipe Grid Lap",
    email: "admin@gridlap.com.br",
    papel: "admin",
  },
  {
    id: "perfil-fiscal",
    userId: "user-fiscal",
    nome: "Fiscal de Prova",
    email: "fiscal@gridlap.com.br",
    papel: "fiscal",
  },
  {
    id: "perfil-piloto",
    userId: "user-piloto",
    nome: "Jhonattan Santos",
    email: "jhonattan@gridlap.com.br",
    papel: "piloto",
    pilotoId: "pil-jhonattan",
  },
];

export const logSistema: LogSistema[] = [];

// Patrocinadores reais, sem logo cadastrada ainda (o cadastro já suporta
// logoUrl; sem ela, o site/overlay mostram o nome como selo).
export const patrocinadores: Patrocinador[] = [
  { id: "patro-01", nome: "Meu Depósito", ativo: true },
  { id: "patro-02", nome: "LogFácil", ativo: true },
  { id: "patro-03", nome: "Nobre Temperos", ativo: true },
  { id: "patro-04", nome: "VeloKart", ativo: true },
];

// --- Helpers de leitura (o equivalente a "queries" enquanto os dados são locais) ---

export function getCampeonato() {
  return campeonato;
}

export function getEtapaAtual(): Etapa | undefined {
  return etapas.find((e) => e.status === "em_andamento") ?? etapas[0];
}

export function getCategoriaById(id: string) {
  return categorias.find((c) => c.id === id);
}

export function getTracadoById(id: string) {
  return tracados.find((t) => t.id === id);
}

export function getPilotoBySlug(slug: string) {
  return pilotos.find((p) => p.slug === slug);
}

export function getPilotosPorCategoria(categoriaId: string) {
  return pilotos
    .filter((p) => p.categoriaId === categoriaId)
    .sort((a, b) => a.posicaoCampeonato - b.posicaoCampeonato);
}

export function getBateriasPorEtapa(etapaId: string) {
  return baterias.filter((b) => b.etapaId === etapaId);
}

// Melhor volta já cravada nesta etapa por uma categoria, olhando classificatória
// e final juntas — o que existir. Alimenta o painel de destaque da home.
export function getMelhorVoltaDaEtapaPorCategoria(
  etapaId: string,
  categoriaId: string,
) {
  const linhas = baterias
    .filter((b) => b.etapaId === etapaId && b.categoriaId === categoriaId)
    .flatMap((b) => getResultadosPorBateria(b.id));
  if (linhas.length === 0) return undefined;
  return linhas.reduce((maisRapida, atual) =>
    atual.melhorVoltaMs < maisRapida.melhorVoltaMs ? atual : maisRapida,
  );
}

// O recorde da etapa é a volta mais rápida entre todas as categorias — vira o
// número gigante da matéria em destaque na home.
export function getRecordeDaEtapa(etapaId: string) {
  let recorde: { resultado: Resultado; categoriaId: string } | undefined;
  for (const categoria of categorias) {
    const resultado = getMelhorVoltaDaEtapaPorCategoria(etapaId, categoria.id);
    if (
      resultado &&
      (!recorde || resultado.melhorVoltaMs < recorde.resultado.melhorVoltaMs)
    ) {
      recorde = { resultado, categoriaId: categoria.id };
    }
  }
  return recorde;
}

// Recorde do traçado = volta mais rápida entre todas as etapas/baterias já
// disputadas nesse traçado (não só na etapa atual). Alimenta o card de
// recorde na tela de Traçados do admin.
export function getRecordeDoTracado(tracadoId: string) {
  const etapasDoTracado = etapas.filter((e) => e.tracadoId === tracadoId);
  let recorde: Resultado | undefined;
  for (const etapa of etapasDoTracado) {
    const resultado = getRecordeDaEtapa(etapa.id)?.resultado;
    if (
      resultado &&
      (!recorde || resultado.melhorVoltaMs < recorde.melhorVoltaMs)
    ) {
      recorde = resultado;
    }
  }
  return recorde;
}

// Top N voltas mais rápidas já cravadas nesse traçado, uma por piloto (a
// melhor de cada um) — alimenta o quadro "Voltas mais rápidas" do detalhe do
// traçado. Sem isso o mesmo piloto poderia ocupar várias posições do ranking
// se tiver corrido o traçado em mais de uma etapa.
export function getMelhoresVoltasDoTracado(tracadoId: string, limite = 5) {
  const idsEtapas = etapas
    .filter((e) => e.tracadoId === tracadoId)
    .map((e) => e.id);
  const idsBaterias = baterias
    .filter((b) => idsEtapas.includes(b.etapaId))
    .map((b) => b.id);

  const melhorPorPiloto = new Map<string, Resultado>();
  for (const resultado of resultados) {
    if (!idsBaterias.includes(resultado.bateriaId)) continue;
    const atual = melhorPorPiloto.get(resultado.pilotoId);
    if (!atual || resultado.melhorVoltaMs < atual.melhorVoltaMs) {
      melhorPorPiloto.set(resultado.pilotoId, resultado);
    }
  }

  return Array.from(melhorPorPiloto.values())
    .sort((a, b) => a.melhorVoltaMs - b.melhorVoltaMs)
    .slice(0, limite);
}

// Vencedores das últimas baterias finais disputadas nesse traçado, da etapa
// mais recente pra mais antiga — alimenta o quadro "Últimas vitórias".
export function getUltimasVitoriasDoTracado(tracadoId: string, limite = 5) {
  const etapasDoTracado = [...etapas]
    .filter((e) => e.tracadoId === tracadoId)
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  const vitorias: { etapa: Etapa; resultado: Resultado }[] = [];
  for (const etapa of etapasDoTracado) {
    const final = baterias.find(
      (b) => b.etapaId === etapa.id && b.numero === 2,
    );
    const vencedor = final
      ? getResultadosPorBateria(final.id).find((r) => r.posicao === 1)
      : undefined;
    if (vencedor) vitorias.push({ etapa, resultado: vencedor });
  }
  return vitorias.slice(0, limite);
}

// Melhor volta de um piloto específico nesta etapa, juntando classificatória e
// final — alimenta o card de "Duelo da rodada" na home.
export function getMelhorVoltaDoPilotoNaEtapa(
  etapaId: string,
  pilotoId: string,
) {
  const idsBaterias = baterias
    .filter((b) => b.etapaId === etapaId)
    .map((b) => b.id);
  const linhas = resultados.filter(
    (r) => idsBaterias.includes(r.bateriaId) && r.pilotoId === pilotoId,
  );
  if (linhas.length === 0) return undefined;
  return linhas.reduce((maisRapida, atual) =>
    atual.melhorVoltaMs < maisRapida.melhorVoltaMs ? atual : maisRapida,
  );
}

export function getResultadosPorBateria(bateriaId: string) {
  return resultados
    .filter((r) => r.bateriaId === bateriaId)
    .sort((a, b) => a.posicao - b.posicao);
}

export function getPilotoById(id: string) {
  return pilotos.find((p) => p.id === id);
}

export function getKartById(id: string) {
  return karts.find((k) => k.id === id);
}

export function getInscricaoById(id: string) {
  return inscricoes.find((i) => i.id === id);
}

// Nem todo piloto real tem cidade/UF cadastrada ainda — evita mostrar "/SP"
// ou "São Paulo/" pela metade quando falta uma das duas partes.
export function formatCidadeUf(piloto: Piloto) {
  if (piloto.cidade && piloto.uf) return `${piloto.cidade}/${piloto.uf}`;
  return piloto.cidade || piloto.uf || null;
}

// Nome público do piloto: o apelido escolhido no cadastro, se houver, senão
// o nome completo. Usado em toda tela vista por fora (site, overlay) — o
// nome completo continua disponível em `piloto.nome` pra uso administrativo.
export function nomeExibicaoPiloto(piloto: Piloto) {
  return piloto.apelido?.trim() || piloto.nome;
}

// --- Pole, volta rápida e o bônus de pontos (regulamento, seção 2) ---
// A pole é sempre o 1º colocado da bateria classificatória: ela define o
// grid da bateria final, mas não dá pontos — só a posição de largada.
export function getBateriaClassificatoriaDaFinal(bateriaFinal: Bateria) {
  return baterias.find(
    (b) =>
      b.etapaId === bateriaFinal.etapaId &&
      b.categoriaId === bateriaFinal.categoriaId &&
      b.numero === 1,
  );
}

export function getPole(bateriaClassificatoriaId: string) {
  return getResultadosPorBateria(bateriaClassificatoriaId).find(
    (r) => r.posicao === 1,
  );
}

// A volta mais rápida é sempre da bateria final, independente da posição —
// por isso pode ser de um piloto diferente do vencedor.
export function getVoltaRapida(bateriaId: string) {
  const linhas = getResultadosPorBateria(bateriaId);
  if (linhas.length === 0) return undefined;
  return linhas.reduce((maisRapida, atual) =>
    atual.melhorVoltaMs < maisRapida.melhorVoltaMs ? atual : maisRapida,
  );
}

// O ponto extra só é confirmado quando a bateria final encerra e o autor da
// volta mais rápida termina entre os 10 primeiros (regra atual da F1).
export function bonusVoltaRapidaConfirmado(
  bateria: Bateria,
  resultado: Resultado,
) {
  // O bônus só existe na bateria final (numero 2) — na classificatória, a
  // volta mais rápida e a pole são sempre a mesma coisa, por definição.
  if (
    bateria.numero !== 2 ||
    bateria.status !== "encerrada" ||
    resultado.posicao > 10
  ) {
    return false;
  }
  return getVoltaRapida(bateria.id)?.id === resultado.id;
}

export function pontosComBonus(bateria: Bateria, resultado: Resultado) {
  return (
    resultado.pontos + (bonusVoltaRapidaConfirmado(bateria, resultado) ? 1 : 0)
  );
}

export function formatTempoVolta(ms: number) {
  const minutos = Math.floor(ms / 60_000);
  const segundos = Math.floor((ms % 60_000) / 1_000);
  const milesimos = ms % 1_000;
  return `${minutos}:${String(segundos).padStart(2, "0")}.${String(milesimos).padStart(3, "0")}`;
}

export function formatGap(ms: number) {
  if (ms <= 0) return "—";
  return `+${(ms / 1000).toFixed(3)}`;
}

export function formatMoeda(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatData(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
