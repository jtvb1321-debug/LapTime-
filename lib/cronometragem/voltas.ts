import { FUSO } from "@/lib/operacao/tempo";

// Formatação dos tempos da cronometragem. O cálculo das voltas está em
// lib/cronometragem/motor.ts.

// Hora no fuso de Brasília com milissegundos: "15:51:07.290".
export function formatarHoraComMs(instanteMs: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(new Date(instanteMs));
}

// 754000 → "12:34"; 3754000 → "1:02:34"
export function formatarDuracao(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// 65038 → "1:05.038"
export function formatarTempoVolta(ms: number): string {
  const total = Math.round(ms);
  const minutos = Math.floor(total / 60000);
  const segundos = Math.floor((total % 60000) / 1000);
  const milis = total % 1000;
  return `${minutos}:${String(segundos).padStart(2, "0")}.${String(milis).padStart(3, "0")}`;
}
