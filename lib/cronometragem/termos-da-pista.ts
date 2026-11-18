import QRCode from "qrcode";
import { consultar } from "@/lib/db/conexao";
import type { Ator } from "@/lib/operacao/erros";
import { buscarClientes, type Cliente } from "@/lib/operacao/clientes-store";
import {
  convitesVigentes,
  garantirConvite,
  situacaoDoTermo,
  type SituacaoTermo,
} from "@/lib/operacao/termo-store";

// Aba Termos da pista: o termo de responsabilidade é resolvido ANTES da bateria, pelo cadastro do
// piloto (busca por nome, apelido, número ou telefone). Aqui só a leitura; quem gera o link e
// cadastra é a ação da aba. A regra continua a mesma: sem termo válido o piloto não larga.

export interface TermoDoCliente {
  clienteId: string;
  numero: number;
  nome: string;
  apelido?: string;
  telefone: string;
  situacao: SituacaoTermo["situacao"];
  assinadoEm?: Date;
  // Link e QR do convite vigente (só para quem ainda precisa assinar).
  url: string | null;
  qr: string | null;
  expiraEm?: Date;
}

async function montar(
  clientes: Cliente[],
  baseDoSistema: string,
): Promise<TermoDoCliente[]> {
  if (clientes.length === 0) return [];
  const situacoes = await Promise.all(
    clientes.map((c) => situacaoDoTermo(c.id)),
  );
  const convites = await convitesVigentes(clientes.map((c) => c.id));
  return Promise.all(
    clientes.map(async (c, i) => {
      const s = situacoes[i];
      const convite = s.situacao === "valido" ? undefined : convites.get(c.id);
      const url = convite ? `${baseDoSistema}/assinar/${convite.token}` : null;
      return {
        clienteId: c.id,
        numero: c.numero,
        nome: c.nome,
        apelido: c.apelido,
        telefone: c.telefone,
        situacao: s.situacao,
        assinadoEm: s.situacao === "pendente" ? undefined : s.aceitoEm,
        url,
        qr: url
          ? await QRCode.toString(url, { type: "svg", margin: 1, width: 144 })
          : null,
        expiraEm: convite?.expiraEm,
      };
    }),
  );
}

// Resultado da busca no cadastro, já com a situação do termo de cada um.
export async function termosPorBusca(
  termo: string,
  baseDoSistema: string,
): Promise<TermoDoCliente[]> {
  return montar(await buscarClientes(termo, 8), baseDoSistema);
}

// Pilotos que já estão em alguma bateria aberta e ainda NÃO têm termo válido: são os primeiros
// da fila da aba (a bateria não larga sem eles).
//
// Com `ator`, o link de quem ainda não tem é criado na hora: o operador não precisa "gerar" nada.
export async function aguardandoTermo(
  baseDoSistema: string,
  ator?: Ator,
): Promise<TermoDoCliente[]> {
  const linhas = await consultar<{ id: string }>(
    `select distinct c.id
       from corrida_piloto cp
       join corrida r on r.id = cp.corrida_id
       join cliente c on c.id = cp.cliente_id
      where r.estado in ('preparada', 'pronta', 'em_andamento', 'encerrando')`,
  );
  if (linhas.length === 0) return [];
  const clientes = await consultar<{
    id: string;
    numero: number;
    nome: string;
    apelido: string | null;
    telefone: string;
  }>(
    `select id, numero, nome, apelido, telefone from cliente
      where id = any($1) order by nome`,
    [linhas.map((l) => l.id)],
  );
  const doBanco = clientes.map((c) => ({
    id: c.id,
    numero: c.numero,
    nome: c.nome,
    apelido: c.apelido ?? undefined,
    telefone: c.telefone,
  }));
  let pendentes = (await montar(doBanco, baseDoSistema)).filter(
    (t) => t.situacao !== "valido",
  );
  if (ator && pendentes.some((t) => !t.url)) {
    for (const t of pendentes.filter((x) => !x.url)) {
      try {
        await garantirConvite(t.clienteId, ator);
      } catch {
        // assinou entre uma leitura e outra, ou o cadastro saiu
      }
    }
    pendentes = (await montar(doBanco, baseDoSistema)).filter(
      (t) => t.situacao !== "valido",
    );
  }
  return pendentes;
}
