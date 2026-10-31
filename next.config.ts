import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as respostas. Sem CSP por enquanto: o Next
// injeta scripts em linha na hidratação e uma política correta exige "nonce"
// por requisição (pendência registrada no relatório de auditoria). HSTS só
// deve ser ligado no proxy que serve o HTTPS.
const CABECALHOS_DE_SEGURANCA = [
  // A página só pode ser exibida em quadro do próprio site (anti-clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Gera .next/standalone (servidor Node mínimo) — usado pela imagem Docker.
  output: "standalone",
  // Não anuncia a tecnologia do servidor.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_DE_SEGURANCA }];
  },
};

export default nextConfig;
