#!/usr/bin/env node
// Agente do computador da pista (linha de comando do projeto). O mesmo código
// vira o executável GridLap-Agente.exe (npm run agente:exe).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rodarAgente } from "./agente-principal.mjs";

const pasta = path.dirname(fileURLToPath(import.meta.url));
process.exitCode = await rodarAgente(process.argv.slice(2), {
  pasta,
  comandoDeInicio: `"${process.execPath}" "${path.join(pasta, "agente.mjs")}" rodar`,
  interativo: false,
});
