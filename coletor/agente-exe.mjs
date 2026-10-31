// Ponto de entrada do executável (GridLap-Agente.exe): empacotado em um único
// arquivo por coletor/construir-exe.mjs. A chave deste computador (agente.json)
// e o registro (GridLap-Agente.log) ficam na pasta do .exe.
import path from "node:path";
import { rodarAgente } from "./agente-principal.mjs";

const exe = process.execPath;
rodarAgente(process.argv.slice(2), {
  pasta: path.dirname(exe),
  comandoDeInicio: `"${exe}" rodar`,
  interativo: true,
}).then((codigo) => {
  process.exitCode = codigo;
});
