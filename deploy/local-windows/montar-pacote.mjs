// Monta o pacote "Grid Lap local" para Windows: sistema (build standalone),
// Node e PostgreSQL embutidos, agente do decoder e os executáveis de atalho.
//
//   npm run build
//   node deploy/local-windows/montar-pacote.mjs [saida] [pasta-do-postgres]
//
// Saída padrão: dist-local/GridLap (pasta) e dist-local/GridLap-Local.zip.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projeto = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const aqui = path.join(projeto, "deploy", "local-windows");
const saida = path.resolve(process.argv[2] ?? path.join(projeto, "dist-local"));
const postgres = process.argv[3] ?? "C:\\Program Files\\PostgreSQL\\17";
const pacote = path.join(saida, "GridLap");

function falhar(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
}

const standalone = path.join(projeto, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  falhar("rode `npm run build` antes (não achei .next/standalone/server.js).");
}
for (const p of ["bin\\initdb.exe", "bin\\postgres.exe", "bin\\pg_ctl.exe"]) {
  if (!existsSync(path.join(postgres, p))) {
    falhar(`PostgreSQL não encontrado em ${postgres} (falta ${p}).`);
  }
}

console.log(`Montando em ${pacote} ...`);
rmSync(pacote, { recursive: true, force: true });
mkdirSync(pacote, { recursive: true });

// 1. Sistema. A pasta .data do standalone traz cópias de arquivos de dados
// reais do desenvolvimento (perfis, pilotos): NUNCA vai no pacote.
cpSync(standalone, path.join(pacote, "app"), {
  recursive: true,
  // O standalone usa links simbólicos (.next/node_modules/pg-xxxx); no Windows
  // criar link exige privilégio, então eles viram cópias.
  dereference: true,
  filter: (origem) => {
    const rel = path.relative(standalone, origem).replace(/\\/g, "/");
    return !(rel === ".data" || rel.startsWith(".data/") || /(^|\/)\.env/.test(rel));
  },
});
mkdirSync(path.join(pacote, "app", ".data"), { recursive: true });
cpSync(
  path.join(projeto, ".next", "static"),
  path.join(pacote, "app", ".next", "static"),
  { recursive: true },
);
cpSync(path.join(projeto, "public"), path.join(pacote, "app", "public"), {
  recursive: true,
});

// 2. Node.
mkdirSync(path.join(pacote, "node"));
cpSync(process.execPath, path.join(pacote, "node", "node.exe"));

// 3. PostgreSQL (só o necessário para rodar; sem pgAdmin, docs nem headers).
const pg = path.join(pacote, "pgsql");
cpSync(path.join(postgres, "bin"), path.join(pg, "bin"), {
  recursive: true,
  filter: (o) => !/(^|[\\/])(wx[^\\/]*\.dll|pgAdmin.*|stackbuilder.*)$/i.test(o),
});
cpSync(path.join(postgres, "lib"), path.join(pg, "lib"), { recursive: true });
cpSync(path.join(postgres, "share"), path.join(pg, "share"), {
  recursive: true,
  filter: (o) => !/[\\/]share[\\/]locale($|[\\/])/i.test(o),
});
// Biblioteca do Visual C++ ao lado do postgres.exe (implantação local).
for (const dll of ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"]) {
  const origem = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", dll);
  if (existsSync(origem) && !existsSync(path.join(pg, "bin", dll))) {
    cpSync(origem, path.join(pg, "bin", dll));
  }
}

// 4. Agente do decoder (sem configuração, fila nem executável do projeto).
const coletor = path.join(projeto, "coletor");
cpSync(coletor, path.join(pacote, "agente"), {
  recursive: true,
  filter: (o) => {
    const rel = path.relative(coletor, o).replace(/\\/g, "/");
    return !(
      rel === "dist" ||
      rel === "capturas" ||
      rel === "agente.json" ||
      rel === "config.json" ||
      rel.startsWith("fila.jsonl") ||
      rel.endsWith(".log")
    );
  },
});

// 5. Scripts de partida, documentação e executáveis de atalho.
cpSync(path.join(aqui, "launcher"), path.join(pacote, "launcher"), {
  recursive: true,
});
cpSync(path.join(aqui, "LEIA-ME.txt"), path.join(pacote, "LEIA-ME.txt"));
mkdirSync(path.join(pacote, "dados"));

const csc = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
if (!existsSync(csc)) falhar("compilador C# do Windows (csc.exe) não encontrado.");
for (const [nome, defs] of [
  ["Grid Lap.exe", []],
  ["Parar Grid Lap.exe", ["/define:PARAR"]],
]) {
  const r = spawnSync(
    csc,
    [
      "/nologo",
      "/target:winexe",
      "/optimize+",
      `/out:${path.join(pacote, nome)}`,
      "/r:System.Windows.Forms.dll",
      ...defs,
      path.join(aqui, "GridLap.cs"),
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) falhar(`csc falhou: ${r.stdout}${r.stderr}`);
}

// 6. Zip.
function tamanho(pasta) {
  let total = 0;
  for (const e of readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    total += e.isDirectory() ? tamanho(p) : statSync(p).size;
  }
  return total;
}
console.log(`Pasta pronta: ${(tamanho(pacote) / 1048576).toFixed(0)} MB.`);
const zip = path.join(saida, "GridLap-Local.zip");
rmSync(zip, { force: true });
const z = spawnSync(path.join(process.env.SystemRoot ?? "C:\Windows", "System32", "tar.exe"), ["-a", "-c", "-f", zip, "-C", saida, "GridLap"], {
  encoding: "utf8",
});
if (z.status !== 0) falhar(`zip falhou: ${z.stderr}`);
writeFileSync(
  path.join(saida, "LEIA-ME.txt"),
  "Copie GridLap-Local.zip para o notebook e siga o LEIA-ME.txt de dentro.\n",
);
console.log(`Zip: ${zip} (${(statSync(zip).size / 1048576).toFixed(0)} MB)`);
