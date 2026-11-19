import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { lerTracados } from "@/lib/tracados-store";
import type { Tracado } from "@/lib/types";

// Traçados que o site público mostra: os do campeonato ativo (nenhum, se não houver ativo).
export async function tracadosDoCampeonatoAtivo(): Promise<Tracado[]> {
  const ativo = await lerCampeonatoAtivo();
  if (!ativo) return [];
  const todos = await lerTracados();
  return ativo.tracadoIds
    .map((id) => todos.find((t) => t.id === id))
    .filter((t): t is Tracado => Boolean(t));
}
