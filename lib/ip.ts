// IP do cliente a partir dos cabeçalhos do proxy. Atrás da Cloudflare (caso da
// Discloud) o endereço confiável é o CF-Connecting-IP; sem ela, usa o primeiro
// da cadeia X-Forwarded-For e por fim X-Real-IP. Só vale com proxy na frente:
// com acesso direto ao app, qualquer um pode forjar esses cabeçalhos.
export function ipDoCliente(
  cabecalho: (nome: string) => string | null | undefined,
): string | null {
  return (
    cabecalho("cf-connecting-ip")?.trim() ||
    cabecalho("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabecalho("x-real-ip")?.trim() ||
    null
  );
}
