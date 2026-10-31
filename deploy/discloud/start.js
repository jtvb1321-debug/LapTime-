// Inicialização na Discloud: porta 8080, build em dist/ (mesmo layout do
// deploy do GTS Center). O Postgres vem de DATABASE_URL (variável do painel).
const fs = require("node:fs");
const path = require("node:path");

if (!fs.existsSync(path.join(__dirname, "dist", "BUILD_ID"))) {
  console.error("[GRIDLAP] dist/BUILD_ID ausente: o build não foi disponibilizado neste diretório.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("[GRIDLAP] DATABASE_URL não configurada (painel > Variáveis).");
  process.exit(1);
}
process.chdir(__dirname);
process.argv = [process.execPath, require.resolve("next/dist/bin/next"), "start", "-H", "0.0.0.0", "-p", "8080"];
require("next/dist/bin/next");
