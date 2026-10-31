#!/usr/bin/env node
// Gera o executável único do agente (coletor/dist/GridLap-Agente.exe), que roda
// em qualquer Windows x64 sem instalar Node. Uso: npm run agente:exe
//
// Passos: 1) esbuild junta o agente em um arquivo só; 2) o Node monta o
// executável a partir do próprio node.exe deste computador (--build-sea).
// O executável NÃO é assinado digitalmente: o Windows (SmartScreen) e alguns
// antivírus podem avisar na primeira execução ("Mais informações → Executar
// assim mesmo").
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const pasta = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(pasta, "dist");
const pacote = path.join(dist, "agente-pacote.cjs");
const configuracao = path.join(dist, "sea-config.json");
const saida = path.join(
  dist,
  process.platform === "win32" ? "GridLap-Agente.exe" : "GridLap-Agente",
);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [path.join(pasta, "agente-exe.mjs")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: pacote,
  logLevel: "warning",
});

writeFileSync(
  configuracao,
  JSON.stringify(
    {
      main: pacote,
      output: saida,
      disableExperimentalSEAWarning: true,
    },
    null,
    2,
  ),
);

execFileSync(process.execPath, ["--build-sea", configuracao], {
  stdio: "inherit",
});

const mb = (statSync(saida).size / 1024 / 1024).toFixed(0);
console.log(`\nPronto: ${saida} (${mb} MB, Node ${process.version}).`);
console.log(
  "Copie esse arquivo para o computador do decoder (Windows x64) e dê duplo clique.",
);
