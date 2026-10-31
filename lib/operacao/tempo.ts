// Datas da operação são sempre no horário de Brasília. O Brasil não tem
// horário de verão desde 2019, então o deslocamento é fixo em -03:00 — assim
// o resultado não depende do fuso do servidor (que no Docker é UTC).
export const FUSO = "America/Sao_Paulo";
const DESLOCAMENTO = "-03:00";
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function ehDiaValido(dia: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const data = new Date(`${dia}T00:00:00${DESLOCAMENTO}`);
  return (
    !Number.isNaN(data.getTime()) &&
    new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(data) === dia
  );
}

export function ehHoraValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(
    new Date(),
  );
}

export function instanteLocal(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00${DESLOCAMENTO}`);
}

// [início, fim) do dia em horário de Brasília.
export function limitesDoDia(dia: string): { inicio: Date; fim: Date } {
  const inicio = instanteLocal(dia, "00:00");
  return { inicio, fim: new Date(inicio.getTime() + UM_DIA_MS) };
}

export function somarDias(dia: string, dias: number): string {
  const data = new Date(
    instanteLocal(dia, "12:00").getTime() + dias * UM_DIA_MS,
  );
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(data);
}

export function formatarHora(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export function formatarDataHora(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export function formatarDiaLongo(dia: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(instanteLocal(dia, "12:00"));
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// "12,50" / "12.50" / "1.234,50" → 1250 (centavos) — ou null se inválido.
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(limpo)) {
    return null;
  }
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const centavos = Math.round(Number(normal) * 100);
  return Number.isFinite(centavos) ? centavos : null;
}

// 8000 → "80,00" (pra preencher campos de valor).
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

// Dia (AAAA-MM-DD) de um instante, em horário de Brasília.
export function diaLocal(data: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(data);
}

// Relógio do servidor (em função própria pra não ser chamado direto durante
// a renderização de componentes).
export function agoraMs(): number {
  return Date.now();
}

// ---- meses ("AAAA-MM") e datas de calendário ----

export function ehMesValido(mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

export function mesAtual(): string {
  return hojeEmSaoPaulo().slice(0, 7);
}

export function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const indice = ano * 12 + (m - 1) + n;
  const novoAno = Math.floor(indice / 12);
  const novoMes = (indice % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
}

// [início, fim) do mês em horário de Brasília.
export function limitesDoMes(mes: string): { inicio: Date; fim: Date } {
  return {
    inicio: instanteLocal(`${mes}-01`, "00:00"),
    fim: instanteLocal(`${somarMeses(mes, 1)}-01`, "00:00"),
  };
}

// Mesmo dia do mês, n meses depois (31/01 + 1 mês = 28 ou 29/02).
export function somarMesesAoDia(dia: string, n: number): string {
  const alvo = somarMeses(dia.slice(0, 7), n);
  const ultimo = Number(
    somarDias(`${somarMeses(alvo, 1)}-01`, -1).slice(8, 10),
  );
  const d = Math.min(Number(dia.slice(8, 10)), ultimo);
  return `${alvo}-${String(d).padStart(2, "0")}`;
}

export function formatarMes(mes: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    month: "long",
    year: "numeric",
  }).format(instanteLocal(`${mes}-15`, "12:00"));
}

// "2026-10-20" → "20/10/2026"
export function formatarDiaCurto(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

export function idadeEm(nascimento: string, hoje: string): number {
  const [na, nm, nd] = nascimento.split("-").map(Number);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  return ha - na - (hm < nm || (hm === nm && hd < nd) ? 1 : 0);
}
