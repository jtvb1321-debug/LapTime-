import { cookies } from "next/headers";
import { COOKIE_ENTRADA } from "@/lib/entrada";
import { EntradaAnimada } from "./entrada-animada";

// Montada nas telas de destino do login (admin e área do piloto). Só renderiza
// quando o login acabou de acontecer; a sessão já foi validada pelo layout.
export async function EntradaGrid() {
  const ativa = (await cookies()).get(COOKIE_ENTRADA)?.value === "1";
  return ativa ? <EntradaAnimada /> : null;
}
