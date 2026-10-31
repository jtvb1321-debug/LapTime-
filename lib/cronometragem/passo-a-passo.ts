import { consultar } from "@/lib/db/conexao";
import type {
  EstadoCorrida,
  FaseCorrida,
  PainelDaCorrida,
} from "@/lib/cronometragem/corridas-store";

// Passo a passo do balcão: transforma o estado real da bateria (pilotos, termos,
// karts, pagamento, fase) numa lista de passos com o que já foi feito e o que é
// o próximo. Nada é inventado: cada passo vem de um dado do sistema.

export interface DadosDaBateria {
  corridaId: string;
  nome: string;
  fase: FaseCorrida;
  estado: EstadoCorrida;
  // Pilotos já cadastrados e vagas ainda abertas (da reserva).
  pilotos: number;
  vagas: number;
  comTermo: number;
  comKart: number;
  // Pilotos de reserva (com cobrança acompanhada) e quantos já estão pagos.
  comCobranca: number;
  pagos: number;
  // Fases irmãs, quando a bateria tem classificação e corrida.
  classificacao?: { id: string; estado: EstadoCorrida };
  corrida?: { id: string; estado: EstadoCorrida };
}

export type SituacaoDoPasso = "feito" | "agora" | "pendente" | "opcional";

export interface Passo {
  chave: string;
  titulo: string;
  detalhe: string;
  situacao: SituacaoDoPasso;
  // Onde fazer o passo e o texto do botão.
  href?: string;
  acao?: string;
}

const COMECOU: EstadoCorrida[] = ["em_andamento", "encerrando", "finalizada"];
const AO_VIVO: EstadoCorrida[] = ["em_andamento", "encerrando"];

export function dadosDoPainel(painel: PainelDaCorrida): DadosDaBateria {
  const pilotos = painel.grid.filter((p) => !p.vaga);
  return {
    corridaId: painel.corrida.id,
    nome: painel.corrida.nome,
    fase: painel.corrida.fase,
    estado: painel.corrida.estado,
    pilotos: pilotos.length,
    vagas: painel.grid.length - pilotos.length,
    comTermo: pilotos.filter((p) => p.termo === "valido").length,
    comKart: pilotos.filter((p) => p.kartNumero).length,
    comCobranca: pilotos.filter((p) => p.pagamento).length,
    pagos: pilotos.filter((p) => p.pagamento?.situacao === "pago").length,
    classificacao: painel.fases?.classificacao,
    corrida: painel.fases?.corrida,
  };
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

// Lista os passos e marca o próximo ("agora"): o primeiro obrigatório ainda
// não feito.
export function passosDoFluxo(d: DadosDaBateria): {
  passos: Passo[];
  proximo?: Passo;
} {
  const paginaDaBateria = `/admin/cronometragem/corridas/${d.corridaId}`;
  const lista: (Omit<Passo, "situacao"> & {
    feito: boolean;
    opcional?: boolean;
  })[] = [];

  const iniciou = COMECOU.includes(d.estado);

  if (d.fase !== "corrida") {
    lista.push(
      {
        chave: "pilotos",
        titulo: "Cadastrar os pilotos",
        detalhe:
          d.pilotos === 0
            ? "Nenhum piloto ainda."
            : `${plural(d.pilotos, "piloto cadastrado", "pilotos cadastrados")}${
                d.vagas > 0
                  ? `; ${plural(d.vagas, "vaga aberta", "vagas abertas")}`
                  : ""
              }.`,
        feito: iniciou || (d.pilotos > 0 && d.vagas === 0),
        href: paginaDaBateria,
        acao: "Cadastrar pilotos",
      },
      {
        chave: "pagamento",
        titulo: "Receber o pagamento",
        detalhe:
          d.comCobranca === 0
            ? "Sem cobrança registrada nesta bateria."
            : `${d.pagos} de ${d.comCobranca} pago(s). Não impede a largada.`,
        feito: d.comCobranca > 0 && d.pagos === d.comCobranca,
        opcional: true,
        href: paginaDaBateria,
        acao: "Receber",
      },
      {
        chave: "termos",
        titulo: "Termo assinado por todos",
        detalhe:
          d.pilotos === 0
            ? "Cadastre os pilotos primeiro."
            : `${d.comTermo} de ${d.pilotos} assinaram (link ou QR).`,
        feito: iniciou || (d.pilotos > 0 && d.comTermo === d.pilotos),
        href: `${paginaDaBateria}#termos`,
        acao: "Ver os termos",
      },
      {
        chave: "karts",
        titulo: "Sortear os karts",
        detalhe:
          d.pilotos === 0
            ? "Cadastre os pilotos primeiro."
            : `${d.comKart} de ${d.pilotos} já com kart (o sensor vem do kart).`,
        feito: iniciou || (d.pilotos > 0 && d.comKart === d.pilotos),
        href: paginaDaBateria,
        acao: "Sortear karts",
      },
      {
        chave: "iniciar",
        titulo:
          d.fase === "classificacao"
            ? "Iniciar a classificação"
            : "Iniciar a bateria",
        detalhe: iniciou
          ? "Bateria iniciada: os sensores são lidos desde a largada."
          : "Com todos aptos (termo e kart), dê a largada. Na classificação, dá para pular o tempo.",
        feito: iniciou,
        href: paginaDaBateria,
        acao: "Abrir a bateria",
      },
      {
        chave: "ao-vivo",
        titulo:
          d.fase === "classificacao"
            ? "Classificação em andamento"
            : "Bateria em andamento",
        detalhe: AO_VIVO.includes(d.estado)
          ? "Acompanhe os tempos ao vivo."
          : d.estado === "finalizada"
            ? "Terminou."
            : "Começa depois da largada.",
        feito: d.estado === "finalizada",
        href: paginaDaBateria,
        acao: "Ver ao vivo",
      },
    );
  } else {
    lista.push(
      {
        chave: "grid",
        titulo: "Grid de largada",
        detalhe: "Definido pela melhor volta da classificação.",
        feito: true,
        href: paginaDaBateria,
        acao: "Ver o grid",
      },
      {
        chave: "iniciar",
        titulo: "Iniciar a corrida",
        detalhe: iniciou
          ? "Corrida iniciada."
          : "Pilotos nos karts, alinhados no grid.",
        feito: iniciou,
        href: paginaDaBateria,
        acao: "Abrir a corrida",
      },
      {
        chave: "ao-vivo",
        titulo: "Corrida em andamento",
        detalhe: AO_VIVO.includes(d.estado)
          ? "Acompanhe os tempos ao vivo."
          : d.estado === "finalizada"
            ? "Terminou."
            : "Começa depois da largada.",
        feito: d.estado === "finalizada",
        href: paginaDaBateria,
        acao: "Ver ao vivo",
      },
    );
  }

  if (d.fase === "classificacao") {
    const quali = d.estado === "finalizada";
    lista.push({
      chave: "criar-corrida",
      titulo: "Criar a corrida",
      detalhe: d.corrida
        ? "Corrida criada."
        : quali
          ? "A classificação terminou: a corrida é criada sozinha (largada pela melhor volta)."
          : "Criada sozinha quando a classificação terminar (ou for pulada).",
      feito: Boolean(d.corrida),
      href: d.corrida
        ? `/admin/cronometragem/corridas/${d.corrida.id}`
        : paginaDaBateria,
      acao: d.corrida ? "Abrir a corrida" : "Criar a corrida",
    });
    if (d.corrida) {
      lista.push({
        chave: "corrida",
        titulo: "Corrida",
        detalhe:
          d.corrida.estado === "finalizada"
            ? "Terminou."
            : AO_VIVO.includes(d.corrida.estado)
              ? "Em andamento."
              : "Pronta para iniciar.",
        feito: d.corrida.estado === "finalizada",
        href: `/admin/cronometragem/corridas/${d.corrida.id}`,
        acao: "Abrir a corrida",
      });
    }
  }

  const terminouTudo =
    d.fase === "classificacao"
      ? d.corrida?.estado === "finalizada"
      : d.estado === "finalizada";
  lista.push({
    chave: "relatorios",
    titulo: "Relatórios (PDF)",
    detalhe: terminouTudo
      ? "Abra, imprima ou baixe os resultados."
      : "Ficam prontos quando a bateria terminar.",
    feito: false,
    href:
      d.fase === "classificacao" && d.corrida
        ? `/admin/cronometragem/corridas/${d.corrida.id}`
        : paginaDaBateria,
    acao: "Ver relatórios",
  });

  // O próximo passo é o primeiro obrigatório ainda não feito. Passos
  // posteriores a ele ficam pendentes; os anteriores já feitos, feitos.
  const indiceDoProximo = lista.findIndex((p) => !p.feito && !p.opcional);
  const passos: Passo[] = lista.map((p, i) => {
    const { feito, opcional, ...resto } = p;
    let situacao: SituacaoDoPasso;
    if (feito) situacao = "feito";
    else if (i === indiceDoProximo) situacao = "agora";
    else if (opcional) situacao = "opcional";
    else situacao = "pendente";
    return { ...resto, situacao };
  });
  return { passos, proximo: passos.find((p) => p.situacao === "agora") };
}

// Qual bateria acompanhar agora: a que está em andamento; senão a que está em
// preparação; senão a classificação recém-terminada (para criar a corrida) ou
// a última finalizada (para os relatórios). `null` = nenhuma.
export async function bateriaEmFoco(): Promise<string | null> {
  const consultas = [
    `select id from corrida where estado in ('em_andamento', 'encerrando')
      order by iniciada_em desc limit 1`,
    `select id from corrida where estado in ('preparada', 'pronta')
        and criado_em > now() - interval '2 days'
      order by criado_em desc limit 1`,
    `select c.id from corrida c
      where c.estado = 'finalizada' and c.fase = 'classificacao'
        and c.encerrada_em > now() - interval '12 hours'
        and not exists (select 1 from corrida r where r.classificacao_id = c.id)
      order by c.encerrada_em desc limit 1`,
    `select id from corrida where estado = 'finalizada'
        and encerrada_em > now() - interval '6 hours'
      order by encerrada_em desc limit 1`,
  ];
  for (const sql of consultas) {
    const [l] = await consultar<{ id: string }>(sql);
    if (l) return l.id;
  }
  return null;
}
