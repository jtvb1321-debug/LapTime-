// Desliga o Grid Lap deste computador (agente, sistema e banco).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DADOS = path.join(RAIZ, "dados");

for (const nome of ["coletor", "agente", "app"]) {
  const arquivo = path.join(DADOS, `${nome}.pid`);
  if (!existsSync(arquivo)) continue;
  const pid = readFileSync(arquivo, "utf8").trim();
  if (/^\d+$/.test(pid)) {
    spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { windowsHide: true });
  }
  rmSync(arquivo, { force: true });
}

const pgDados = path.join(DADOS, "pg");
if (existsSync(path.join(pgDados, "postmaster.pid"))) {
  spawnSync(
    path.join(RAIZ, "pgsql", "bin", "pg_ctl.exe"),
    ["stop", "-D", pgDados, "-m", "fast", "-w", "-t", "60"],
    { windowsHide: true },
  );
}
console.log("Grid Lap desligado.");
