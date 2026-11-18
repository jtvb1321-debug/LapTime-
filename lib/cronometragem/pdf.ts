import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { LinhaClassificacao } from "@/lib/cronometragem/motor";
import { montarVoltaAVolta } from "@/lib/cronometragem/relatorios";
import {
  qualyDaSessao,
  type CriterioDaSessao,
} from "@/lib/cronometragem/classificacao-oficial";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";
import { formatarDataHora } from "@/lib/operacao/tempo";

export type TipoRelatorio = "resultado" | "qualy" | "voltas" | "completo";

export interface DadosRelatorio {
  bateria: string;
  situacao: string;
  iniciadaEm: Date | null;
  encerradaEm: Date | null;
  duracaoMin?: number;
  tempoMinimoMs: number;
  classificacao: LinhaClassificacao[];
  // true = a bateria ainda não terminou (relatório parcial).
  parcial: boolean;
  // Critério oficial da sessão (camada compartilhada). Ausente = "atual" (como sempre foi).
  criterio?: CriterioDaSessao;
  geradoEm: Date;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 36;
const COR_TEXTO = rgb(0.1, 0.1, 0.12);
const COR_CINZA = rgb(0.4, 0.4, 0.45);
const COR_LINHA = rgb(0.85, 0.85, 0.88);
const COR_LARANJA = rgb(0.9, 0.42, 0.08);
const COR_FAIXA = rgb(0.96, 0.96, 0.97);
const COR_DESTAQUE = rgb(0.99, 0.9, 0.78);
const COR_ALERTA = rgb(0.75, 0.1, 0.1);

// As fontes padrão do PDF só têm o conjunto WinAnsi (português cabe; setas e
// símbolos fora dele viram "?").
function limpar(texto: string): string {
  return [...texto]
    .map((c) => {
      const n = c.codePointAt(0) ?? 63;
      if (n >= 32 && n <= 126) return c;
      if (n >= 160 && n <= 255) return c;
      if ("—–‘’“”•…€".includes(c)) return c;
      return "?";
    })
    .join("");
}

interface CelulaRica {
  texto: string;
  negrito?: boolean;
  cor?: RGB;
  fundo?: RGB;
}
type Celula = string | CelulaRica;

interface ColunaPdf {
  titulo: string;
  largura: number;
  alinhar?: "esquerda" | "direita" | "centro";
}

class Relatorio {
  doc!: PDFDocument;
  fonte!: PDFFont;
  negrito!: PDFFont;
  pagina!: PDFPage;
  // Distância do topo da página (pontos).
  y = 0;
  paisagem = false;

  static async criar(): Promise<Relatorio> {
    const r = new Relatorio();
    r.doc = await PDFDocument.create();
    r.fonte = await r.doc.embedFont(StandardFonts.Helvetica);
    r.negrito = await r.doc.embedFont(StandardFonts.HelveticaBold);
    return r;
  }

  get largura(): number {
    return this.pagina.getWidth();
  }
  get altura(): number {
    return this.pagina.getHeight();
  }
  get larguraUtil(): number {
    return this.largura - 2 * MARGEM;
  }

  novaPagina(paisagem: boolean) {
    this.paisagem = paisagem;
    this.pagina = this.doc.addPage(paisagem ? [A4[1], A4[0]] : A4);
    this.y = MARGEM;
  }

  texto(
    texto: string,
    x: number,
    tamanho: number,
    opcoes: { negrito?: boolean; cor?: RGB } = {},
  ) {
    this.pagina.drawText(limpar(texto), {
      x,
      y: this.altura - this.y - tamanho,
      size: tamanho,
      font: opcoes.negrito ? this.negrito : this.fonte,
      color: opcoes.cor ?? COR_TEXTO,
    });
  }

  larguraDe(texto: string, tamanho: number, negrito = false): number {
    return (negrito ? this.negrito : this.fonte).widthOfTextAtSize(
      limpar(texto),
      tamanho,
    );
  }

  // Corta o texto para caber na largura (com reticências).
  ajustar(texto: string, largura: number, tamanho: number, negrito = false) {
    let t = limpar(texto);
    if (this.larguraDe(t, tamanho, negrito) <= largura) return t;
    while (
      t.length > 1 &&
      this.larguraDe(`${t}...`, tamanho, negrito) > largura
    ) {
      t = t.slice(0, -1);
    }
    return `${t}...`;
  }

  cabecalho(titulo: string, dados: DadosRelatorio) {
    this.texto("GRID LAP", MARGEM, 13, { negrito: true, cor: COR_LARANJA });
    const marca = "Cronometragem";
    this.texto(marca, this.largura - MARGEM - this.larguraDe(marca, 9), 9, {
      cor: COR_CINZA,
    });
    this.y += 20;
    this.texto(titulo, MARGEM, 18, { negrito: true });
    this.y += 24;
    this.texto(`${dados.bateria}  ·  ${dados.situacao}`, MARGEM, 10, {
      negrito: true,
    });
    this.y += 14;
    const partes = [
      dados.iniciadaEm ? `Início: ${formatarDataHora(dados.iniciadaEm)}` : null,
      dados.encerradaEm ? `Fim: ${formatarDataHora(dados.encerradaEm)}` : null,
      dados.duracaoMin ? `Duração prevista: ${dados.duracaoMin} min` : null,
      `Tempo mínimo entre leituras: ${dados.tempoMinimoMs / 1000} s`,
    ].filter(Boolean) as string[];
    this.texto(partes.join("   ·   "), MARGEM, 8.5, { cor: COR_CINZA });
    this.y += 13;
    if (dados.parcial) {
      this.texto(
        "RELATÓRIO PARCIAL: a bateria ainda não terminou.",
        MARGEM,
        9,
        { negrito: true, cor: COR_ALERTA },
      );
      this.y += 13;
    }
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.altura - this.y - 2 },
      end: { x: this.largura - MARGEM, y: this.altura - this.y - 2 },
      thickness: 1,
      color: COR_LARANJA,
    });
    this.y += 12;
  }

  // Desenha uma tabela; ao faltar espaço abre outra página repetindo o título
  // das colunas.
  tabela(
    colunas: ColunaPdf[],
    linhas: Celula[][],
    continuacao: (r: Relatorio) => void,
    opcoes: { alturaLinha?: number; tamanho?: number } = {},
  ) {
    const alturaLinha = opcoes.alturaLinha ?? 18;
    const tamanho = opcoes.tamanho ?? 9;
    const total = colunas.reduce((t, c) => t + c.largura, 0);

    const cabecalhoDaTabela = () => {
      this.pagina.drawRectangle({
        x: MARGEM,
        y: this.altura - this.y - alturaLinha,
        width: total,
        height: alturaLinha,
        color: COR_TEXTO,
      });
      let x = MARGEM;
      for (const c of colunas) {
        this.celula(c.titulo, x, c, tamanho, {
          negrito: true,
          cor: rgb(1, 1, 1),
        });
        x += c.largura;
      }
      this.y += alturaLinha;
    };

    cabecalhoDaTabela();
    linhas.forEach((linha, i) => {
      if (this.y + alturaLinha > this.altura - MARGEM - 14) {
        this.novaPagina(this.paisagem);
        continuacao(this);
        cabecalhoDaTabela();
      }
      if (i % 2 === 1) {
        this.pagina.drawRectangle({
          x: MARGEM,
          y: this.altura - this.y - alturaLinha,
          width: total,
          height: alturaLinha,
          color: COR_FAIXA,
        });
      }
      let x = MARGEM;
      linha.forEach((valor, j) => {
        const c = colunas[j];
        const rica: CelulaRica =
          typeof valor === "string" ? { texto: valor } : valor;
        if (rica.fundo) {
          this.pagina.drawRectangle({
            x,
            y: this.altura - this.y - alturaLinha,
            width: c.largura,
            height: alturaLinha,
            color: rica.fundo,
          });
        }
        this.celula(rica.texto, x, c, tamanho, rica);
        x += c.largura;
      });
      this.pagina.drawLine({
        start: { x: MARGEM, y: this.altura - this.y - alturaLinha },
        end: { x: MARGEM + total, y: this.altura - this.y - alturaLinha },
        thickness: 0.4,
        color: COR_LINHA,
      });
      this.y += alturaLinha;
    });
  }

  private celula(
    texto: string,
    x: number,
    coluna: ColunaPdf,
    tamanho: number,
    estilo: { negrito?: boolean; cor?: RGB },
  ) {
    const recuo = 5;
    const cabe = this.ajustar(
      texto,
      coluna.largura - 2 * recuo,
      tamanho,
      estilo.negrito,
    );
    const w = this.larguraDe(cabe, tamanho, estilo.negrito);
    const px =
      coluna.alinhar === "direita"
        ? x + coluna.largura - recuo - w
        : coluna.alinhar === "centro"
          ? x + (coluna.largura - w) / 2
          : x + recuo;
    this.texto(cabe, px, tamanho, estilo);
    // y já aponta para o topo da linha; o texto é centralizado na altura.
  }

  rodapes(dados: DadosRelatorio) {
    const paginas = this.doc.getPages();
    const gerado = formatarDataHora(dados.geradoEm);
    paginas.forEach((p, i) => {
      const texto = limpar(
        `Grid Lap · gerado em ${gerado} · página ${i + 1} de ${paginas.length}`,
      );
      const w = this.fonte.widthOfTextAtSize(texto, 8);
      p.drawText(texto, {
        x: (p.getWidth() - w) / 2,
        y: 20,
        size: 8,
        font: this.fonte,
        color: COR_CINZA,
      });
    });
  }
}

function tempo(ms: number | null): string {
  return ms === null ? "—" : formatarTempoVolta(ms);
}

function secaoResultado(r: Relatorio, dados: DadosRelatorio) {
  r.novaPagina(false);
  r.cabecalho("Resultado final", dados);
  const colunas: ColunaPdf[] = [
    { titulo: "Pos", largura: 34, alinhar: "centro" },
    { titulo: "Piloto", largura: 170 },
    { titulo: "Kart", largura: 40, alinhar: "centro" },
    { titulo: "Voltas", largura: 40, alinhar: "centro" },
    { titulo: "Melhor volta", largura: 70, alinhar: "direita" },
    { titulo: "Tempo total", largura: 75, alinhar: "direita" },
    { titulo: "Diferença", largura: 94, alinhar: "direita" },
  ];
  const linhas: Celula[][] = dados.classificacao.map((l) => [
    l.posicao !== null
      ? { texto: `${l.posicao}º`, negrito: true }
      : { texto: "—", cor: COR_CINZA },
    { texto: l.nome, negrito: l.posicao === 1 },
    l.kartNumero ?? "—",
    String(l.voltas),
    tempo(l.melhorVoltaMs),
    tempo(l.tempoTotalMs),
    l.diferenca === null || l.diferenca.tipo === "lider"
      ? "—"
      : l.diferenca.tipo === "tempo"
        ? `+${formatarTempoVolta(l.diferenca.ms)}`
        : `+${l.diferenca.voltas} ${l.diferenca.voltas === 1 ? "volta" : "voltas"}`,
  ]);
  r.tabela(colunas, linhas, (rr) =>
    rr.cabecalho("Resultado final (continuação)", dados),
  );
  r.y += 10;
  r.texto(
    "Classificação por voltas válidas; com as mesmas voltas, vale quem cruzou a linha antes. Tempo total: da primeira leitura contada ao fim da última volta.",
    MARGEM,
    7.5,
    { cor: COR_CINZA },
  );
}

function secaoQualy(r: Relatorio, dados: DadosRelatorio) {
  r.novaPagina(false);
  r.cabecalho("Qualificação (melhor volta)", dados);
  const colunas: ColunaPdf[] = [
    { titulo: "Pos", largura: 32, alinhar: "centro" },
    { titulo: "Piloto", largura: 140 },
    { titulo: "Kart", largura: 38, alinhar: "centro" },
    { titulo: "Melhor volta", largura: 72, alinhar: "direita" },
    { titulo: "Volta nº", largura: 52, alinhar: "centro" },
    { titulo: "Diferença", largura: 72, alinhar: "direita" },
    { titulo: "Média", largura: 72, alinhar: "direita" },
    { titulo: "Voltas", largura: 45, alinhar: "centro" },
  ];
  const linhas: Celula[][] = qualyDaSessao(
    dados.classificacao,
    dados.criterio ?? "atual",
  ).map((q) => [
    q.posicao !== null
      ? { texto: `${q.posicao}º`, negrito: true }
      : { texto: "—", cor: COR_CINZA },
    { texto: q.nome, negrito: q.posicao === 1 },
    q.kartNumero ?? "—",
    { texto: tempo(q.melhorVoltaMs), negrito: q.posicao === 1 },
    q.melhorVoltaNumero !== null ? String(q.melhorVoltaNumero) : "—",
    q.diferencaMs !== null ? `+${formatarTempoVolta(q.diferencaMs)}` : "—",
    tempo(q.mediaMs),
    String(q.voltas),
  ]);
  r.tabela(colunas, linhas, (rr) =>
    rr.cabecalho("Qualificação (continuação)", dados),
  );
  r.y += 10;
  r.texto(
    "Ordenada pela melhor volta de cada piloto; empatando o tempo, vale quem o fez primeiro.",
    MARGEM,
    7.5,
    { cor: COR_CINZA },
  );
}

const PILOTOS_POR_BLOCO = 9;

function secaoVoltas(r: Relatorio, dados: DadosRelatorio) {
  const m = montarVoltaAVolta(dados.classificacao);
  r.novaPagina(true);
  r.cabecalho("Volta a volta", dados);
  if (m.participantes.length === 0) {
    r.texto("Nenhuma volta completa registrada.", MARGEM, 10);
    return;
  }
  for (let ini = 0; ini < m.participantes.length; ini += PILOTOS_POR_BLOCO) {
    const fatia = m.participantes.slice(ini, ini + PILOTOS_POR_BLOCO);
    const larguraVolta = 46;
    const larguraCol = Math.max(
      64,
      (r.larguraUtil - larguraVolta) / fatia.length,
    );
    const colunas: ColunaPdf[] = [
      { titulo: "Volta", largura: larguraVolta, alinhar: "centro" },
      ...fatia.map((p) => ({
        titulo: `${p.nome}${p.kartNumero ? ` (K${p.kartNumero})` : ""}`,
        largura: larguraCol,
        alinhar: "direita" as const,
      })),
    ];
    const linhas: Celula[][] = m.linhas.map((l) => [
      { texto: String(l.numero), negrito: true },
      ...fatia.map((_, j): Celula => {
        const idx = ini + j;
        const valor = l.tempos[idx];
        if (valor === null) return { texto: "—", cor: COR_CINZA };
        if (valor === m.melhorGeral) {
          return { texto: tempo(valor), negrito: true, fundo: COR_DESTAQUE };
        }
        if (valor === m.melhores[idx]) {
          return { texto: tempo(valor), negrito: true, cor: COR_LARANJA };
        }
        return tempo(valor);
      }),
    ]);
    linhas.push([
      { texto: "Melhor", negrito: true },
      ...fatia.map((_, j): Celula => ({
        texto: tempo(m.melhores[ini + j]),
        negrito: true,
      })),
    ]);
    r.tabela(
      colunas,
      linhas,
      (rr) => rr.cabecalho("Volta a volta (continuação)", dados),
      { alturaLinha: 16, tamanho: 8.5 },
    );
    r.y += 14;
    if (ini + PILOTOS_POR_BLOCO < m.participantes.length) {
      if (r.y > r.altura - MARGEM - 100) r.novaPagina(true);
    }
  }
  r.texto(
    "Destaque colorido: melhor volta da bateria; em laranja: melhor volta de cada piloto.",
    MARGEM,
    7.5,
    { cor: COR_CINZA },
  );
}

// Gera o PDF pedido. "completo" junta qualificação, volta a volta e resultado
// final no mesmo arquivo.
export async function gerarPdf(
  tipo: TipoRelatorio,
  dados: DadosRelatorio,
): Promise<Uint8Array> {
  const r = await Relatorio.criar();
  if (tipo === "completo") {
    secaoQualy(r, dados);
    secaoVoltas(r, dados);
    secaoResultado(r, dados);
  } else if (tipo === "qualy") secaoQualy(r, dados);
  else if (tipo === "voltas") secaoVoltas(r, dados);
  else secaoResultado(r, dados);
  r.rodapes(dados);
  return r.doc.save();
}

export const NOMES_DO_ARQUIVO: Record<TipoRelatorio, string> = {
  completo: "relatorio-completo",
  qualy: "qualificacao",
  voltas: "volta-a-volta",
  resultado: "resultado-final",
};
