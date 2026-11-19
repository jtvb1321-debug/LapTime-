import { NextResponse } from "next/server";
import { exigirPermissao } from "@/lib/auth";
import { carregarCampeonatoAtivo } from "@/lib/dados-do-campeonato";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";
import { lerInscricoesDoCampeonato } from "@/lib/inscricoes-store";

export const dynamic = "force-dynamic";

// Relatórios do campeonato ativo em CSV (separador ";" e acentos ok no Excel). Só quem consulta
// relatórios (admin, fiscal, operador).
const TIPOS = ["resultados", "inscricoes", "financeiro", "punicoes"] as const;
type Tipo = (typeof TIPOS)[number];

function celula(v: unknown): string {
  const t = v === null || v === undefined ? "" : String(v);
  // Evita que o Excel interprete o texto como fórmula.
  const seguro = /^[=+\-@]/.test(t) ? `'${t}` : t;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

function csv(cabecalho: string[], linhas: unknown[][]): string {
  return (
    "﻿" +
    [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n") +
    "\r\n"
  );
}

const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const METODO = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão" } as const;
const STATUS_PAG = {
  aguardando: "a receber",
  confirmado: "recebido",
  cancelado: "cancelado",
} as const;
const TIPO_PUN = {
  advertencia: "Advertência",
  perda_pontos: "Perda de pontos",
  desclassificacao: "Desclassificação da etapa",
} as const;

export async function GET(request: Request) {
  const sessao = await exigirPermissao("relatorio.consultar");
  if (!sessao) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 401 });
  }
  const tipo = new URL(request.url).searchParams.get("tipo") as Tipo | null;
  if (!tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ erro: "Relatório inválido." }, { status: 400 });
  }
  const dados = await carregarCampeonatoAtivo();
  if (!dados) {
    return NextResponse.json(
      { erro: "Não há campeonato ativo." },
      { status: 404 },
    );
  }
  const nomeCat = (id: string) =>
    dados.categorias.find((c) => c.id === id)?.nome ?? id;
  let corpo = "";

  if (tipo === "resultados") {
    corpo = csv(
      [
        "Etapa",
        "Categoria",
        "Posição",
        "Piloto",
        "Voltas",
        "Melhor volta",
        "Pole",
        "Volta mais rápida",
        "Punição (pts)",
        "Pontos",
      ],
      dados.resultados.baterias.flatMap((b) =>
        [...b.linhas]
          .sort((x, y) => (x.posicao ?? 999) - (y.posicao ?? 999))
          .map((l) => [
            b.etapaNome,
            nomeCat(b.categoriaId),
            l.desclassificada
              ? "Desclassificado"
              : (l.posicao ?? l.situacao.toUpperCase()),
            l.nome,
            l.voltas,
            l.melhorVoltaMs ? formatarTempoVolta(l.melhorVoltaMs) : "",
            l.pole ? "sim" : "",
            l.voltaRapida ? "sim" : "",
            l.penalidade || "",
            l.total,
          ]),
      ),
    );
  } else if (tipo === "inscricoes") {
    const insc = await lerInscricoesDoCampeonato(dados.campeonato.id);
    corpo = csv(
      [
        "Etapa",
        "Nº",
        "Piloto",
        "Categoria",
        "Inscrição",
        "Valor (R$)",
        "Pagamento",
        "Forma",
      ],
      insc.map((i) => [
        i.etapaNome,
        i.pilotoNumero,
        i.pilotoNome,
        nomeCat(i.categoriaId),
        i.status,
        i.pagamento ? reais(i.pagamento.valorCentavos) : "0,00",
        i.pagamento ? STATUS_PAG[i.pagamento.status] : "gratuita",
        i.pagamento?.metodo ? METODO[i.pagamento.metodo] : "",
      ]),
    );
  } else if (tipo === "financeiro") {
    const insc = await lerInscricoesDoCampeonato(dados.campeonato.id);
    const soma = (etapaId: string | null, status: string) =>
      insc
        .filter(
          (i) =>
            (etapaId === null || i.etapaId === etapaId) &&
            i.pagamento?.status === status,
        )
        .reduce((t, i) => t + (i.pagamento?.valorCentavos ?? 0), 0);
    corpo = csv(
      ["Etapa", "Recebido (R$)", "A receber (R$)", "Cancelado (R$)"],
      [
        ...dados.etapas.map((e) => [
          e.nome,
          reais(soma(e.id, "confirmado")),
          reais(soma(e.id, "aguardando")),
          reais(soma(e.id, "cancelado")),
        ]),
        [
          "TOTAL",
          reais(soma(null, "confirmado")),
          reais(soma(null, "aguardando")),
          reais(soma(null, "cancelado")),
        ],
      ],
    );
  } else {
    corpo = csv(
      [
        "Data",
        "Piloto",
        "Etapa",
        "Tipo",
        "Pontos perdidos",
        "Motivo",
        "Situação",
      ],
      dados.resultados.punicoes.map((u) => [
        new Date(u.criadaEm).toLocaleDateString("pt-BR"),
        `#${u.pilotoNumero} ${u.pilotoNome}`,
        u.etapaNome ?? "",
        TIPO_PUN[u.tipo],
        u.tipo === "perda_pontos" ? u.pontos : "",
        u.motivo,
        u.anulada ? "anulada" : "valendo",
      ]),
    );
  }

  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}-${dados.campeonato.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
