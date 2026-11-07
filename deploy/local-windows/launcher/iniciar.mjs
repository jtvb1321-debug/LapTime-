// Liga o Grid Lap neste computador: banco embutido (PostgreSQL), sistema e
// agente do decoder. Roda com o Node que vem junto do pacote:
//   node\node.exe launcher\iniciar.mjs
// Pode ser executado várias vezes: só liga o que ainda não estiver no ar.
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DADOS = path.join(RAIZ, "dados");
const LOGS = path.join(DADOS, "logs");
const PG_BIN = path.join(RAIZ, "pgsql", "bin");
const PG_DADOS = path.join(DADOS, "pg");
const NODE = process.execPath;
const require = createRequire(path.join(RAIZ, "app", "server.js"));
const { Client } = require("pg");

mkdirSync(LOGS, { recursive: true });
const logArquivo = path.join(LOGS, "iniciar.log");
function log(texto) {
  const linha = `[${new Date().toLocaleString("pt-BR")}] ${texto}`;
  appendFileSync(logArquivo, linha + "\n");
  console.log(linha);
}

function lerJson(arquivo, padrao) {
  try {
    return { ...padrao, ...JSON.parse(readFileSync(arquivo, "utf8")) };
  } catch {
    return padrao;
  }
}

// Configuração que a pessoa pode ajustar: dados\config.json.
const arquivoConfig = path.join(DADOS, "config.json");
const config = lerJson(arquivoConfig, {
  porta: 3001,
  portaBanco: 55433,
  // true = outros aparelhos da rede também abrem o sistema (o Windows pode
  // perguntar sobre o firewall). false = só este computador.
  rede: false,
});
if (!existsSync(arquivoConfig)) {
  writeFileSync(arquivoConfig, JSON.stringify(config, null, 2));
}

// Senhas geradas na primeira vez (banco e administrador).
const arquivoSegredos = path.join(DADOS, "segredos.json");
const segredos = lerJson(arquivoSegredos, {});
let primeiraVez = false;
if (!segredos.bancoSenha) {
  segredos.bancoSenha = randomBytes(18).toString("base64url");
  segredos.adminEmail = "admin@gridlap.com.br";
  segredos.adminSenha = randomBytes(9).toString("base64url");
  writeFileSync(arquivoSegredos, JSON.stringify(segredos, null, 2));
  primeiraVez = true;
}

const URL_APP = `http://localhost:${config.porta}`;

function executar(exe, args, opcoes = {}) {
  return spawnSync(exe, args, {
    encoding: "utf8",
    windowsHide: true,
    ...opcoes,
  });
}

async function responde(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

function abrirNavegador() {
  spawn("cmd", ["/c", "start", "", URL_APP], {
    windowsHide: true,
    detached: true,
    stdio: "ignore",
  }).unref();
}

async function esperar(condicao, segundos, motivo) {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    if (await condicao()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  log(`Tempo esgotado: ${motivo}`);
  return false;
}

function lancar(nome, exe, args, opcoes) {
  const saida = openSync(path.join(LOGS, `${nome}.log`), "a");
  const filho = spawn(exe, args, {
    ...opcoes,
    windowsHide: true,
    detached: true,
    stdio: ["ignore", saida, saida],
  });
  filho.unref();
  closeSync(saida);
  writeFileSync(path.join(DADOS, `${nome}.pid`), String(filho.pid));
  return filho.pid;
}

// -------------------------------------------------------------- 0. já no ar?
if (await responde(`${URL_APP}/login`)) {
  log("O Grid Lap já está no ar; abrindo o navegador.");
  abrirNavegador();
  process.exit(0);
}

// ------------------------------------------------------------ 1. banco
if (!existsSync(path.join(PG_DADOS, "PG_VERSION"))) {
  log("Preparando o banco de dados (só na primeira vez)...");
  const arquivoSenha = path.join(DADOS, "senha-banco.tmp");
  writeFileSync(arquivoSenha, segredos.bancoSenha);
  const base = [
    "-D",
    PG_DADOS,
    "-U",
    "gridlap",
    "--pwfile",
    arquivoSenha,
    "-A",
    "scram-sha-256",
    "-E",
    "UTF8",
  ];
  let r = executar(path.join(PG_BIN, "initdb.exe"), [
    ...base,
    "--locale=C",
    "--locale-provider=icu",
    "--icu-locale=pt-BR",
  ]);
  if (r.status !== 0) {
    log(`initdb com ordenação pt-BR falhou (${(r.stderr || "").trim()}); usando padrão.`);
    rmSync(PG_DADOS, { recursive: true, force: true });
    r = executar(path.join(PG_BIN, "initdb.exe"), [...base, "--locale=C"]);
  }
  rmSync(arquivoSenha, { force: true });
  if (r.status !== 0) {
    log(`Não foi possível criar o banco: ${r.stderr || r.stdout}`);
    process.exit(1);
  }
}

const pronto = executar(path.join(PG_BIN, "pg_isready.exe"), [
  "-h",
  "127.0.0.1",
  "-p",
  String(config.portaBanco),
]);
if (pronto.status !== 0) {
  log("Ligando o banco de dados...");
  // Sem canais (pipes): o postgres herdaria a saída e o spawnSync esperaria
  // por ele para sempre. Quem confirma que ligou é o pg_isready.
  executar(
    path.join(PG_BIN, "pg_ctl.exe"),
    [
      "start",
      "-D",
      PG_DADOS,
      "-l",
      path.join(LOGS, "postgres.log"),
      "-o",
      `-p ${config.portaBanco} -c listen_addresses=127.0.0.1`,
    ],
    { stdio: "ignore" },
  );
  const noAr = await esperar(
    () =>
      executar(path.join(PG_BIN, "pg_isready.exe"), [
        "-h",
        "127.0.0.1",
        "-p",
        String(config.portaBanco),
      ]).status === 0,
    90,
    "o banco não ligou",
  );
  if (!noAr) {
    log("Veja dados\\logs\\postgres.log.");
    process.exit(1);
  }
}

const conexao = (database) => ({
  host: "127.0.0.1",
  port: config.portaBanco,
  user: "gridlap",
  password: segredos.bancoSenha,
  database,
});

{
  const admin = new Client(conexao("postgres"));
  await admin.connect();
  const { rowCount } = await admin.query(
    "select 1 from pg_database where datname = 'gridlap'",
  );
  if (!rowCount) await admin.query("create database gridlap");
  await admin.end();
}

// ------------------------------------------------------- 2. sistema
log("Ligando o sistema...");
const pidApp = lancar("app", NODE, ["server.js"], {
  cwd: path.join(RAIZ, "app"),
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(config.porta),
    HOSTNAME: config.rede ? "0.0.0.0" : "127.0.0.1",
    DATABASE_URL: `postgres://gridlap:${encodeURIComponent(segredos.bancoSenha)}@127.0.0.1:${config.portaBanco}/gridlap`,
    AUTH_CONTAS_DEMO: "0",
    COOKIE_SECURE: "0",
    URL_PUBLICA: URL_APP,
  },
});
log(`Sistema iniciado (pid ${pidApp}).`);
if (!(await esperar(() => responde(`${URL_APP}/login`), 120, "o sistema não respondeu"))) {
  log("Veja dados\\logs\\app.log.");
  process.exit(1);
}

// -------------------------------------------- 3. administrador (1ª vez)
const banco = new Client(conexao("gridlap"));
await banco.connect();
let adminId;
try {
  const existente = await banco.query(
    "select id from perfil where lower(email) = lower($1)",
    [segredos.adminEmail],
  );
  if (existente.rowCount) {
    adminId = existente.rows[0].id;
  } else {
    // Mesmo formato do lib/senha.ts (scrypt: salt:hash em hexadecimal).
    const { scryptSync } = await import("node:crypto");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(segredos.adminSenha, salt, 64).toString("hex");
    adminId = `perfil-${randomUUID()}`;
    await banco.query(
      `insert into perfil (id, user_id, nome, email, papel, senha_hash)
       values ($1, $1, 'Administrador', $2, 'admin', $3)`,
      [adminId, segredos.adminEmail, `${salt}:${hash}`],
    );
    writeFileSync(
      path.join(DADOS, "CREDENCIAIS.txt"),
      [
        "Acesso ao Grid Lap neste computador",
        "",
        `Endereço: ${URL_APP}`,
        `Usuário:  ${segredos.adminEmail}`,
        `Senha:    ${segredos.adminSenha}`,
        "",
        "Guarde este arquivo; ele só existe neste computador.",
        "",
      ].join("\r\n"),
    );
    log("Administrador criado; a senha está em dados\\CREDENCIAIS.txt.");
  }

  // ------------------------------------------------ 4. agente do decoder
  const pastaAgente = path.join(RAIZ, "agente");
  if (existsSync(path.join(pastaAgente, "agente.mjs"))) {
    if (!existsSync(path.join(pastaAgente, "agente.json"))) {
      const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      let codigo = "";
      for (const b of randomBytes(8)) codigo += alfabeto[b % alfabeto.length];
      await banco.query(
        `insert into coletor_pareamento (id, codigo_hash, criado_por, expira_em)
         values ($1, $2, $3, now() + interval '15 minutes')`,
        [
          `pareamento-${randomUUID()}`,
          createHash("sha256").update(codigo).digest("hex"),
          adminId,
        ],
      );
      const r = executar(NODE, [
        path.join(pastaAgente, "agente.mjs"),
        "parear",
        codigo,
        "--servidor",
        `http://127.0.0.1:${config.porta}`,
      ]);
      log(`Agente do decoder: ${(r.stdout || r.stderr || "").trim().split("\n")[0]}`);
    }
    if (existsSync(path.join(pastaAgente, "agente.json"))) {
      const pidAgente = lancar("agente", NODE, ["agente.mjs", "rodar"], {
        cwd: pastaAgente,
      });
      log(`Agente do decoder ligado (pid ${pidAgente}).`);
    }
  }
} finally {
  await banco.end();
}

log(`Pronto: ${URL_APP}`);
if (primeiraVez) log("Primeira vez: veja a senha em dados\\CREDENCIAIS.txt.");
abrirNavegador();
