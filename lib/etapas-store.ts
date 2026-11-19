import { randomUUID } from "node:crypto";
import { consultar } from "@/lib/db/conexao";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { Etapa, StatusEtapa } from "@/lib/types";

// Etapas de cada campeonato, com data e horário (hora de Brasília, sem fuso: é a hora do relógio da
// pista). Ficam no banco; antes eram só do navegador de quem cadastrou.
export const STATUS_DE_ETAPA: StatusEtapa[] = [
  "agendada",
  "em_andamento",
  "encerrada",
  "cancelada",
];

interface LinhaEtapa {
  id: string;
  campeonato_id: string;
  numero: number;
  nome: string;
  kartodromo: string;
  cidade: string;
  data: string;
  hora: string;
  status: StatusEtapa;
  tracado_id: string | null;
}

const SELECT = `select id, campeonato_id, numero, nome, kartodromo, cidade,
       to_char(data, 'YYYY-MM-DD') as data, to_char(hora, 'HH24:MI') as hora,
       status, tracado_id
  from etapa`;

function deLinha(l: LinhaEtapa): Etapa {
  return {
    id: l.id,
    campeonatoId: l.campeonato_id,
    numero: l.numero,
    nome: l.nome,
    kartodromo: l.kartodromo,
    cidade: l.cidade,
    data: l.data,
    hora: l.hora,
    status: l.status,
    tracadoId: l.tracado_id ?? undefined,
  };
}

export async function lerEtapasDoCampeonato(
  campeonatoId: string,
): Promise<Etapa[]> {
  try {
    const linhas = await consultar<LinhaEtapa>(
      `${SELECT} where campeonato_id = $1 order by data, hora, numero`,
      [campeonatoId],
    );
    return linhas.map(deLinha);
  } catch {
    return [];
  }
}

export async function etapasDoCampeonatoAtivo(): Promise<Etapa[]> {
  const ativo = await lerCampeonatoAtivo();
  return ativo ? lerEtapasDoCampeonato(ativo.id) : [];
}

export interface DadosDaEtapa {
  nome: string;
  kartodromo: string;
  cidade: string;
  data: string;
  hora: string;
  tracadoId?: string;
  status?: string;
  numero?: number;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function dataValida(texto: string) {
  if (!DATA.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

function validar(d: DadosDaEtapa) {
  const nome = d.nome.trim();
  const kartodromo = d.kartodromo.trim();
  const cidade = d.cidade.trim();
  if (nome.length < 2 || nome.length > 80) {
    throw new ErroNegocio("O nome da etapa deve ter de 2 a 80 caracteres.");
  }
  if (kartodromo.length < 2 || kartodromo.length > 80) {
    throw new ErroNegocio("Informe o kartódromo (2 a 80 caracteres).");
  }
  if (cidade.length < 2 || cidade.length > 80) {
    throw new ErroNegocio("Informe a cidade (2 a 80 caracteres).");
  }
  if (!dataValida(d.data)) throw new ErroNegocio("Informe uma data válida.");
  if (!HORA.test(d.hora)) {
    throw new ErroNegocio("Informe o horário no formato HH:MM (ex.: 14:30).");
  }
  const status = d.status ?? "agendada";
  if (!STATUS_DE_ETAPA.includes(status as StatusEtapa)) {
    throw new ErroNegocio("Situação da etapa inválida.");
  }
  if (
    d.numero !== undefined &&
    (!Number.isInteger(d.numero) || d.numero < 1 || d.numero > 99)
  ) {
    throw new ErroNegocio("O número da etapa deve ser de 1 a 99.");
  }
  return { nome, kartodromo, cidade, status, tracadoId: d.tracadoId || null };
}

async function conferirTracado(campeonatoId: string, tracadoId: string | null) {
  if (!tracadoId) return;
  const [v] = await consultar(
    "select 1 from campeonato_tracado where campeonato_id = $1 and tracado_id = $2",
    [campeonatoId, tracadoId],
  );
  if (!v) {
    throw new ErroNegocio(
      "Escolha um traçado que esteja entre os traçados deste campeonato.",
    );
  }
}

export async function criarEtapa(
  campeonatoId: string,
  d: DadosDaEtapa,
): Promise<void> {
  const v = validar(d);
  const [camp] = await consultar("select 1 from campeonato where id = $1", [
    campeonatoId,
  ]);
  if (!camp) throw new ErroNegocio("Campeonato não encontrado.");
  await conferirTracado(campeonatoId, v.tracadoId);
  const [prox] = await consultar<{ n: number }>(
    "select coalesce(max(numero), 0) + 1 as n from etapa where campeonato_id = $1",
    [campeonatoId],
  );
  const numero = d.numero ?? prox?.n ?? 1;
  try {
    await consultar(
      `insert into etapa (id, campeonato_id, numero, nome, kartodromo, cidade, data, hora, status, tracado_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        `etapa-${randomUUID().slice(0, 8)}`,
        campeonatoId,
        numero,
        v.nome,
        v.kartodromo,
        v.cidade,
        d.data,
        d.hora,
        v.status,
        v.tracadoId,
      ],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      throw new ErroNegocio(`Já existe a etapa de número ${numero}.`);
    }
    throw e;
  }
}

export async function atualizarEtapa(
  id: string,
  d: DadosDaEtapa,
): Promise<void> {
  const v = validar(d);
  const [atual] = await consultar<{ campeonato_id: string; numero: number }>(
    "select campeonato_id, numero from etapa where id = $1",
    [id],
  );
  if (!atual) throw new ErroNegocio("Etapa não encontrada.");
  await conferirTracado(atual.campeonato_id, v.tracadoId);
  const numero = d.numero ?? atual.numero;
  try {
    await consultar(
      `update etapa set numero = $2, nome = $3, kartodromo = $4, cidade = $5,
              data = $6, hora = $7, status = $8, tracado_id = $9
        where id = $1`,
      [
        id,
        numero,
        v.nome,
        v.kartodromo,
        v.cidade,
        d.data,
        d.hora,
        v.status,
        v.tracadoId,
      ],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      throw new ErroNegocio(`Já existe a etapa de número ${numero}.`);
    }
    throw e;
  }
}

export async function excluirEtapa(id: string): Promise<void> {
  await consultar("delete from etapa where id = $1", [id]);
}
