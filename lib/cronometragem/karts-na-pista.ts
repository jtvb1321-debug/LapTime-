import { consultar } from "@/lib/db/conexao";

// Karts na pista antes da tomada de tempo (tela da bateria em preparação): a primeira passagem de
// cada sensor só marca que o kart está na pista. Nenhuma volta conta aqui: o cálculo das voltas só
// usa passagens a partir do início da bateria. Somente leitura.

export interface KartNaPista {
  kartId: string;
  numero: string;
  sensor: string;
  primeiraMs: number;
  ultimaMs: number;
  leituras: number;
}

// Passagem antiga não é "estar na pista": uma bateria vazia pode ficar aberta por horas.
export const JANELA_NA_PISTA_MIN = 20;

// Karts ativos cujo sensor passou depois que a bateria foi aberta (e nos últimos minutos) e que
// ainda não estão com nenhum piloto nesta bateria, na ordem em que passaram.
export async function kartsNaPista(corridaId: string): Promise<KartNaPista[]> {
  const linhas = await consultar<{
    kart_id: string;
    numero: string;
    sensor: string;
    primeira_ms: number;
    ultima_ms: number;
    leituras: number;
  }>(
    `select k.id as kart_id, k.numero, ks.transponder as sensor,
            round(extract(epoch from min(p.instante)) * 1000)::float8 as primeira_ms,
            round(extract(epoch from max(p.instante)) * 1000)::float8 as ultima_ms,
            count(*)::int as leituras
       from corrida c
       join kart k on k.status = 'ativo'
       join kart_sensor ks on ks.kart_id = k.id and ks.removido_em is null
       join transponder t on t.codigo = ks.transponder and t.status = 'ativo'
       join passagem p on p.transponder = ks.transponder
        and p.instante >= greatest(c.criado_em, now() - make_interval(mins => $2))
      where c.id = $1
        and c.estado in ('preparada', 'pronta')
        and not exists (select 1 from corrida_piloto cp
                         where cp.corrida_id = c.id and cp.kart_id = k.id)
      group by k.id, k.numero, ks.transponder
      order by min(p.instante), k.numero`,
    [corridaId, JANELA_NA_PISTA_MIN],
  );
  return linhas.map((l) => ({
    kartId: l.kart_id,
    numero: l.numero,
    sensor: l.sensor,
    primeiraMs: l.primeira_ms,
    ultimaMs: l.ultima_ms,
    leituras: l.leituras,
  }));
}
