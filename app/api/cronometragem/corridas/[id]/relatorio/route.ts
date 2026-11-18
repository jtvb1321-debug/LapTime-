import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/auth";
import { lerPainel } from "@/lib/cronometragem/corridas-store";
import {
  criterioDaSessao,
  lerConfigDeClassificacao,
} from "@/lib/cronometragem/classificacao-oficial";
import {
  gerarPdf,
  NOMES_DO_ARQUIVO,
  type TipoRelatorio,
} from "@/lib/cronometragem/pdf";
import { ESTADO_CORRIDA } from "@/lib/cronometragem/rotulos";

// PDF da bateria: ?tipo=completo|qualy|voltas|resultado (padrão: completo) e
// &baixar=1 para forçar o download (sem isso o navegador abre o PDF, de onde
// dá para imprimir). Exige login com permissão de ver a cronometragem.
export const dynamic = "force-dynamic";

const TIPOS: TipoRelatorio[] = ["completo", "qualy", "voltas", "resultado"];

function nomeSeguro(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "bateria"
  );
}

export async function GET(
  request: Request,
  contexto: { params: Promise<{ id: string }> },
) {
  const sessao = await exigirPermissao("cronometragem.ver");
  if (!sessao) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const { id } = await contexto.params;
  const url = new URL(request.url);
  const pedido = url.searchParams.get("tipo") ?? "completo";
  if (!TIPOS.includes(pedido as TipoRelatorio)) {
    return NextResponse.json(
      { erro: "Tipo de relatório inválido." },
      { status: 400 },
    );
  }
  const tipo = pedido as TipoRelatorio;

  const painel = await lerPainel(id);
  if (!painel) {
    return NextResponse.json(
      { erro: "Bateria não encontrada." },
      { status: 404 },
    );
  }
  const { corrida } = painel;
  if (!corrida.iniciadaEm) {
    return NextResponse.json(
      { erro: "A bateria ainda não começou: não há o que imprimir." },
      { status: 400 },
    );
  }

  const fim = corrida.encerradaEm ?? corrida.canceladaEm;
  const pdf = await gerarPdf(tipo, {
    bateria: corrida.nome,
    situacao: ESTADO_CORRIDA[corrida.estado].rotulo,
    iniciadaEm: corrida.iniciadaEm,
    encerradaEm: fim,
    duracaoMin: corrida.duracaoMin,
    tempoMinimoMs: corrida.tempoMinimoMs,
    classificacao: painel.classificacao,
    parcial: corrida.estado !== "finalizada",
    // Critério oficial da sessão (camada compartilhada); no padrão, "atual" (como sempre foi).
    criterio: criterioDaSessao(corrida, lerConfigDeClassificacao()),
    geradoEm: new Date(),
  });

  const arquivo = `${nomeSeguro(corrida.nome)}-${NOMES_DO_ARQUIVO[tipo]}.pdf`;
  const disposicao =
    url.searchParams.get("baixar") === "1" ? "attachment" : "inline";
  return new Response(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${disposicao}; filename="${arquivo}"`,
      "cache-control": "no-store",
    },
  });
}
