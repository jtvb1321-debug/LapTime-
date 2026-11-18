import { NextResponse, type NextRequest } from "next/server";

// Segurança em todas as páginas:
//  - Política de Segurança de Conteúdo (CSP) com nonce por requisição: só roda script que o próprio
//    servidor marcou, o que barra a maior parte dos ataques de injeção de script (XSS).
//    Está em modo "só relatar" (Content-Security-Policy-Report-Only): o navegador registra no
//    console o que seria bloqueado, mas nada deixa de funcionar. Para passar a BLOQUEAR, defina
//    CSP_MODO=bloquear no ambiente (depois de conferir que o console das telas está limpo).
//  - HSTS (só quando o sistema roda atrás de HTTPS: COOKIE_SECURE=1, como na Discloud).
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";

  const politica = [
    "default-src 'self'",
    // 'wasm-unsafe-eval': o recorte de fundo da foto do piloto roda WebAssembly no navegador.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    // O CSS é do próprio site; os estilos em linha (style="...") do React precisam do 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");

  const nome =
    process.env.CSP_MODO === "bloquear"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";

  const cabecalhosDaRequisicao = new Headers(request.headers);
  cabecalhosDaRequisicao.set("x-nonce", nonce);
  cabecalhosDaRequisicao.set(nome, politica);

  const resposta = NextResponse.next({
    request: { headers: cabecalhosDaRequisicao },
  });
  resposta.headers.set(nome, politica);
  if (process.env.COOKIE_SECURE === "1") {
    resposta.headers.set(
      "Strict-Transport-Security",
      "max-age=15552000", // 180 dias
    );
  }
  return resposta;
}

export const config = {
  matcher: [
    {
      // Páginas e rotas; fora arquivos estáticos e imagens, que não executam script.
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
