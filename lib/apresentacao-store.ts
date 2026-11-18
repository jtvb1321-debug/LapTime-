import { consultar } from "@/lib/db/conexao";

// Dados do vídeo de apresentação do piloto: o recorte da foto de macacão (webp com transparência,
// guardado como data URI) e a cor da faixa. Fica numa tabela própria (`piloto_apresentacao`) e,
// se ela ainda não existir no banco, tudo aqui se comporta como "sem apresentação" — o cadastro
// e o site continuam funcionando.

const FOTO = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+=*)$/;
export const FOTO_CORPO_MAX_CARACTERES = 900_000;

export function fotoCorpoValida(valor: string) {
  return valor.length <= FOTO_CORPO_MAX_CARACTERES && FOTO.test(valor);
}

function tabelaAusente(erro: unknown) {
  return (erro as { code?: string } | null)?.code === "42P01";
}

export interface Apresentacao {
  corFaixa: string;
  versao: number;
}

export async function lerApresentacao(
  pilotoId: string,
): Promise<Apresentacao | null> {
  try {
    const linhas = await consultar<{ cor_faixa: string; versao: string }>(
      `select cor_faixa, length(foto_corpo)::text as versao
         from piloto_apresentacao where piloto_id = $1`,
      [pilotoId],
    );
    if (!linhas[0]) return null;
    return { corFaixa: linhas[0].cor_faixa, versao: Number(linhas[0].versao) };
  } catch (erro) {
    if (tabelaAusente(erro)) return null;
    throw erro;
  }
}

export async function lerFotoCorpo(
  pilotoId: string,
): Promise<{ tipo: string; bytes: Buffer } | null> {
  try {
    const linhas = await consultar<{ foto_corpo: string }>(
      "select foto_corpo from piloto_apresentacao where piloto_id = $1",
      [pilotoId],
    );
    const m = FOTO.exec(linhas[0]?.foto_corpo ?? "");
    if (!m) return null;
    return {
      tipo: `image/${m[1]}`,
      bytes: Buffer.from(m[2], "base64"),
    };
  } catch (erro) {
    if (tabelaAusente(erro)) return null;
    throw erro;
  }
}

// Devolve false se a tabela não existir (migração ainda não aplicada) — quem chama não deve falhar.
export async function salvarApresentacao(
  pilotoId: string,
  fotoCorpo: string,
  corFaixa: string,
): Promise<boolean> {
  try {
    await consultar(
      `insert into piloto_apresentacao (piloto_id, foto_corpo, cor_faixa)
       values ($1, $2, $3)
       on conflict (piloto_id) do update
         set foto_corpo = excluded.foto_corpo, cor_faixa = excluded.cor_faixa,
             atualizado_em = clock_timestamp()`,
      [pilotoId, fotoCorpo, corFaixa],
    );
    return true;
  } catch (erro) {
    if (tabelaAusente(erro)) return false;
    throw erro;
  }
}
