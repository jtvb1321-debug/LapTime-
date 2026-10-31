import { headers } from "next/headers";

// Endereço público do sistema, usado nos links enviados aos clientes (termo).
// Em produção defina URL_PUBLICA (ex.: https://gridlap.com.br). Sem isso, usa
// o endereço pelo qual o operador está acessando — que no computador da pista
// pode não abrir no celular do cliente.
export async function urlPublica(): Promise<string> {
  const fixa = process.env.URL_PUBLICA?.trim().replace(/\/+$/, "");
  if (fixa) return fixa;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${protocolo}://${host}`;
}
