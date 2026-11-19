import type { Etapa } from "@/lib/types";

// "14:30" → "14h30" (e "14:00" → "14h"), como se fala na pista.
export function formatHora(hora?: string | null): string {
  if (!hora) return "";
  const [h, m] = hora.split(":");
  if (h === undefined || m === undefined) return hora;
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

// Data por extenso e, se houver, o horário: "12 de dezembro de 2026 às 14h30".
export function formatDataEHora(etapa: Pick<Etapa, "data" | "hora">): string {
  const data = new Date(`${etapa.data}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return etapa.hora ? `${data} às ${formatHora(etapa.hora)}` : data;
}
