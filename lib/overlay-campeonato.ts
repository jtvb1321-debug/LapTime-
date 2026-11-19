import { lerAoVivoDoCampeonato } from "@/lib/baterias-campeonato-store";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { consultar } from "@/lib/db/conexao";
import { aplicarAjustesDeCategoria } from "@/lib/categorias-store";
import type { ResultadoPublicado } from "@/lib/cronometragem/corridas-store";
import { textoDiferenca } from "@/lib/cronometragem/rotulos";
import { categorias, nomeExibicaoPiloto } from "@/lib/mock/data";
import { lerPatrocinadores } from "@/lib/patrocinadores-store";
import { lerPilotos } from "@/lib/pilotos-store";
import type { Piloto } from "@/lib/types";

// Dados reais do campeonato no formato que o overlay de transmissão (OBS), a TV e as rotas
// /api/overlay/* já esperam. O overlay só lê; quem alimenta é a cronometragem.

async function mapaDePilotos(): Promise<Map<string, Piloto>> {
  return new Map((await lerPilotos()).map((p) => [p.id, p]));
}

function nomeDaCategoria(id: string) {
  return categorias.find((c) => c.id === id)?.nome ?? null;
}

// Logos do campeonato ativo; sem logos nele, os patrocinadores ativos do cadastro geral.
export async function patrocinadoresDoOverlay() {
  const ativo = await lerCampeonatoAtivo();
  if (ativo && ativo.logos.length > 0) {
    return ativo.logos.map((l) => ({ nome: l.nome, logoUrl: l.logo }));
  }
  const gerais = await lerPatrocinadores().catch(() => []);
  return gerais
    .filter((p) => p.ativo)
    .map((p) => ({ nome: p.nome, logoUrl: p.logoUrl ?? null }));
}

function numeroDoKart(kart: string | null | undefined): number | null {
  if (!kart) return null;
  const n = Number.parseInt(kart, 10);
  return Number.isFinite(n) ? n : null;
}

function dadosDoPiloto(p: Piloto | undefined, nomeNaCorrida: string) {
  return {
    nome: p ? nomeExibicaoPiloto(p) : nomeNaCorrida,
    numero: p?.numero ?? null,
    avatarUrl: p?.avatarUrl ?? null,
    uf: p?.uf ?? null,
    corNumero: p?.corNumero ?? null,
    corAssinatura: p?.corAssinatura ?? null,
  };
}

// ---- Ao vivo ------------------------------------------------------------------------------

export async function overlayAoVivo() {
  await aplicarAjustesDeCategoria();
  const [vivo, pilotos, patrocinadores] = await Promise.all([
    lerAoVivoDoCampeonato(),
    mapaDePilotos(),
    patrocinadoresDoOverlay(),
  ]);
  if (!vivo) return { bateria: null, pilotos: [], patrocinadores };
  const etapa = (
    await consultar<{ numero: number }>(
      `select e.numero from bateria_campeonato b join etapa e on e.id = b.etapa_id where b.id = $1`,
      [vivo.bateriaId],
    ).catch(() => [])
  )[0];
  const melhor = Math.min(
    ...vivo.linhas
      .map((l) => l.melhorVoltaMs)
      .filter((m): m is number => m !== null && m > 0),
  );
  return {
    bateria: {
      nome: `${nomeDaCategoria(vivo.categoriaId) ?? ""} · ${vivo.etapaNome}`,
      status: "ao_vivo",
      numero: vivo.fase === "classificacao" ? 1 : 2,
      // Corrida por tempo: não há total de voltas.
      voltas: null,
      categoria: nomeDaCategoria(vivo.categoriaId),
      etapa: etapa ? `${etapa.numero}ª Etapa` : null,
    },
    pilotos: vivo.linhas.map((l, i) => {
      const p = l.pilotoId ? pilotos.get(l.pilotoId) : undefined;
      return {
        posicao: l.posicao ?? i + 1,
        ...dadosDoPiloto(p, l.nome),
        numero: l.numero ?? p?.numero ?? null,
        kartNumero: numeroDoKart(l.kartNumero),
        kartPlaca: l.kartNumero,
        voltaAtual: l.voltas + 1,
        melhorVoltaMs: l.melhorVoltaMs ?? 0,
        gapMs: l.gapMs ?? 0,
        gapTexto: l.diferenca,
        voltaRapida:
          l.melhorVoltaMs !== null &&
          Number.isFinite(melhor) &&
          l.melhorVoltaMs === melhor,
      };
    }),
    patrocinadores,
  };
}

// ---- Resultado da última corrida finalizada -----------------------------------------------

interface LinhaFinal {
  participanteId: string;
  nome: string;
  posicao: number | null;
  situacao: string;
  voltas: number;
  melhorVoltaMs: number | null;
  diferenca: { tipo: string; ms?: number; voltas?: number } | null;
}

export async function overlayResultado() {
  await aplicarAjustesDeCategoria();
  const patrocinadores = await patrocinadoresDoOverlay();
  const ativo = await lerCampeonatoAtivo();
  const vazio = { corrida: null, vencedor: null, pilotos: [], patrocinadores };
  if (!ativo) return vazio;
  const [corrida] = await consultar<{
    corrida_id: string;
    categoria_id: string;
    etapa_numero: number;
    kartodromo: string;
    resultado_final: ResultadoPublicado;
  }>(
    `select f.id as corrida_id, b.categoria_id, e.numero as etapa_numero, e.kartodromo,
            f.resultado_final
       from bateria_campeonato b
       join etapa e on e.id = b.etapa_id
       join corrida f on f.classificacao_id = b.corrida_id and f.estado = 'finalizada'
      where e.campeonato_id = $1 and f.resultado_final is not null
      order by f.encerrada_em desc nulls last limit 1`,
    [ativo.id],
  ).catch(() => []);
  if (!corrida) return vazio;
  const [pilotos, vinculos] = await Promise.all([
    mapaDePilotos(),
    consultar<{
      id: string;
      piloto_id: string | null;
      kart_numero: string | null;
    }>(
      "select id, piloto_id, kart_numero from corrida_piloto where corrida_id = $1",
      [corrida.corrida_id],
    ),
  ]);
  const linhas = (corrida.resultado_final.classificacao ??
    []) as unknown as LinhaFinal[];
  const lista = linhas
    .filter((l) => l.posicao !== null)
    .sort((a, b) => (a.posicao ?? 0) - (b.posicao ?? 0))
    .map((l) => {
      const v = vinculos.find((x) => x.id === l.participanteId);
      const p = v?.piloto_id ? pilotos.get(v.piloto_id) : undefined;
      return {
        posicao: l.posicao as number,
        ...dadosDoPiloto(p, l.nome),
        kartNumero: numeroDoKart(v?.kart_numero),
        melhorVoltaMs: l.melhorVoltaMs ?? 0,
        gapMs: l.diferenca?.tipo === "tempo" ? (l.diferenca.ms ?? 0) : 0,
        gapTexto: textoDiferenca(
          (l.diferenca as Parameters<typeof textoDiferenca>[0]) ?? null,
        ),
        voltas: l.voltas,
        pilotoId: v?.piloto_id ?? null,
      };
    });
  const vencedor = lista.find((l) => l.posicao === 1);
  const pVencedor = vencedor?.pilotoId
    ? pilotos.get(vencedor.pilotoId)
    : undefined;
  return {
    corrida: {
      numero: 2,
      categoria: nomeDaCategoria(corrida.categoria_id),
      etapa: `${corrida.etapa_numero}ª Etapa`,
      kartodromo: corrida.kartodromo,
      campeonato: `${ativo.nome} ${ativo.temporada}`,
    },
    vencedor: vencedor
      ? {
          nome: vencedor.nome,
          avatarUrl: vencedor.avatarUrl,
          numero: vencedor.numero,
          corNumero: pVencedor?.corNumero ?? null,
          corAssinatura: pVencedor?.corAssinatura ?? null,
        }
      : null,
    pilotos: lista.map(({ pilotoId, ...resto }) => {
      void pilotoId;
      return resto;
    }),
    patrocinadores,
  };
}

// ---- Grid de largada ----------------------------------------------------------------------

export async function overlayGrid() {
  await aplicarAjustesDeCategoria();
  const patrocinadores = await patrocinadoresDoOverlay();
  const ativo = await lerCampeonatoAtivo();
  const vazio = { categoria: null, etapa: null, pilotos: [], patrocinadores };
  if (!ativo) return vazio;
  // A bateria cuja classificação terminou e cuja corrida ainda não terminou (a mais recente).
  const [b] = await consultar<{
    quali_id: string;
    corrida_id: string | null;
    categoria_id: string;
    etapa_numero: number;
    quali_final: ResultadoPublicado | null;
  }>(
    `select q.id as quali_id, f.id as corrida_id, b.categoria_id, e.numero as etapa_numero,
            q.resultado_final as quali_final
       from bateria_campeonato b
       join etapa e on e.id = b.etapa_id
       join corrida q on q.id = b.corrida_id and q.estado = 'finalizada'
       left join corrida f on f.classificacao_id = q.id
      where e.campeonato_id = $1 and (f.id is null or f.estado <> 'finalizada')
      order by q.encerrada_em desc nulls last limit 1`,
    [ativo.id],
  ).catch(() => []);
  if (!b) return vazio;
  const [pilotos, doGrid, daQuali] = await Promise.all([
    mapaDePilotos(),
    b.corrida_id
      ? consultar<{
          nome: string;
          piloto_id: string | null;
          kart_numero: string | null;
          posicao_grid: number | null;
        }>(
          `select nome, piloto_id, kart_numero, posicao_grid from corrida_piloto
            where corrida_id = $1 order by posicao_grid nulls last, criado_em`,
          [b.corrida_id],
        )
      : Promise.resolve([]),
    consultar<{ id: string; piloto_id: string | null }>(
      "select id, piloto_id from corrida_piloto where corrida_id = $1",
      [b.quali_id],
    ),
  ]);
  const melhorPorPiloto = new Map<string, number>();
  for (const l of (b.quali_final?.classificacao ??
    []) as unknown as LinhaFinal[]) {
    const pid = daQuali.find((x) => x.id === l.participanteId)?.piloto_id;
    if (pid && l.melhorVoltaMs) melhorPorPiloto.set(pid, l.melhorVoltaMs);
  }
  return {
    categoria: nomeDaCategoria(b.categoria_id),
    etapa: `Etapa ${b.etapa_numero}`,
    pilotos: doGrid.map((g, i) => {
      const p = g.piloto_id ? pilotos.get(g.piloto_id) : undefined;
      return {
        posicao: g.posicao_grid ?? i + 1,
        ...dadosDoPiloto(p, g.nome),
        kartNumero: numeroDoKart(g.kart_numero),
        kartPlaca: g.kart_numero,
        melhorVoltaMs: g.piloto_id
          ? (melhorPorPiloto.get(g.piloto_id) ?? 0)
          : 0,
      };
    }),
    patrocinadores,
  };
}
