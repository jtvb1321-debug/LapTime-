import { cookies } from "next/headers";
import { AberturaCliente } from "@/components/site/abertura-cliente";

export const COOKIE_ABERTURA = "gl_abertura";

// Abertura animada da página inicial: aparece uma vez por sessão do navegador. A decisão é do
// servidor (cookie de sessão), então não há "piscada" do conteúdo antes da animação. É só
// apresentação: a página inteira já está carregada por baixo e a animação pode ser dispensada com
// um toque, tecla ou rolagem. Com movimento reduzido ela nem aparece.
export async function AberturaGridLap() {
  if ((await cookies()).has(COOKIE_ABERTURA)) return null;
  return <AberturaCliente />;
}
