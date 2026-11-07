#!/usr/bin/env node
// Ferramenta para achar e estudar o decoder CalX Pro ligado a este computador.
// Rode com o Node que vem no Grid Lap, a partir da pasta C:\GridLap:
//
//   node\node.exe agente\calx.mjs achar
//       acha o IP do decoder pelo MAC (34-ea-e7-57-78-41).
//
//   node\node.exe agente\calx.mjs portas 192.168.137.50
//       testa TODAS as portas TCP do decoder (1 a 65535) e mostra as abertas
//       e o que o aparelho mandar sozinho em cada uma. Não envia dados.
//
//   node\node.exe agente\calx.mjs ouvir --tcp 5000,10000 --udp 5000 --segundos 120
//       espera o decoder CONECTAR NESTE PC (TCP) ou mandar pacotes (UDP) e
//       grava tudo em agente\capturas.
//
//   node\node.exe agente\calx.mjs gravar 192.168.137.50 5000 --segundos 120
//       conecta numa porta do decoder e grava tudo o que chegar. Passe
//       transponders na antena durante a gravação e anote quais e quando.
//
// Feche o LapTime antes: o decoder pode aceitar só um programa por vez.

import { execFile } from "node:child_process";
import dgram from "node:dgram";
import { createWriteStream, mkdirSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CAPTURAS = path.join(path.dirname(fileURLToPath(import.meta.url)), "capturas");

function argumentos(lista) {
  const opcoes = {};
  const pos = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.startsWith("--")) {
      const prox = lista[i + 1];
      if (prox === undefined || prox.startsWith("--")) opcoes[a.slice(2)] = true;
      else {
        opcoes[a.slice(2)] = prox;
        i++;
      }
    } else pos.push(a);
  }
  return { opcoes, pos };
}

const hora = () => new Date().toLocaleTimeString("pt-BR");
const log = (m) => console.log(`[${hora()}] ${m}`);
const numeros = (t) => String(t ?? "").split(",").map((s) => Number(s.trim())).filter((n) => n > 0 && n < 65536);

function previa(bytes) {
  const texto = bytes.toString("latin1").replace(/[^\x20-\x7e]/g, ".").slice(0, 60);
  return `${bytes.length} bytes  hex ${bytes.subarray(0, 24).toString("hex")}  "${texto}"`;
}

function abrirArquivo(rotulo) {
  mkdirSync(CAPTURAS, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  const arquivo = path.join(CAPTURAS, `calx-${rotulo.replace(/[^\w.-]/g, "_")}-${carimbo}.log`);
  const saida = createWriteStream(arquivo, { flags: "a" });
  log(`gravando em ${arquivo}`);
  return {
    arquivo,
    escrever(origem, pedaco) {
      const texto = pedaco.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
      saida.write(`${new Date().toISOString()}\t${origem}\t${pedaco.length}\t${pedaco.toString("hex")}\t${texto}\n`);
      console.log(`  ${origem}  ${previa(pedaco)}`);
    },
    fechar: () => new Promise((r) => saida.end(r)),
  };
}

function testarPorta(host, porta, timeoutMs, escutaMs) {
  return new Promise((resolve) => {
    const pedacos = [];
    let abriu = false;
    let fim = false;
    const s = net.connect({ host, port: porta });
    const terminar = () => {
      if (fim) return;
      fim = true;
      clearTimeout(t);
      s.destroy();
      resolve({ porta, abriu, bytes: Buffer.concat(pedacos) });
    };
    let t = setTimeout(terminar, timeoutMs);
    s.on("connect", () => {
      abriu = true;
      clearTimeout(t);
      t = setTimeout(terminar, escutaMs);
    });
    s.on("data", (d) => pedacos.push(d));
    s.on("error", terminar);
    s.on("close", terminar);
  });
}

const MAC_DECODER = "34:ea:e7:57:78:41";

function validarIp(host) {
  if (!host || net.isIP(host) !== 4) {
    throw new Error(`"${host ?? ""}" não é um IP. Use o IP que "calx.mjs achar" mostrar (ex.: 192.168.137.50).`);
  }
}

function lerArp() {
  return new Promise((resolve) => {
    execFile("arp", ["-a"], { windowsHide: true, timeout: 5000 }, (e, saida) => {
      const lista = [];
      for (const m of String(saida ?? "").matchAll(/(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}(?:[-:][0-9a-f]{2}){5})/gi)) {
        lista.push({ ip: m[1], mac: m[2].toLowerCase().replaceAll("-", ":") });
      }
      resolve(lista);
    });
  });
}

// Encontra o decoder pelo MAC: mostra as placas, "acorda" a faixa de cada
// placa com cabo (uma conexão TCP rápida por IP) e procura o MAC na tabela ARP.
async function achar(opcoes) {
  const mac = String(opcoes.mac ?? MAC_DECODER).toLowerCase().replaceAll("-", ":");
  const placas = [];
  for (const [nome, ends] of Object.entries(os.networkInterfaces())) {
    for (const e of ends ?? []) if (e.family === "IPv4" && !e.internal) placas.push({ nome, ip: e.address, mascara: e.netmask });
  }
  console.log("Placas de rede:");
  for (const p of placas) console.log(`  ${p.nome}: ${p.ip} / ${p.mascara}`);

  let lista = await lerArp();
  let achado = lista.find((v) => v.mac === mac);
  if (!achado) {
    const faixas = placas.filter((p) => p.mascara === "255.255.255.0" && !p.ip.startsWith("169.254."));
    for (const p of faixas) {
      const base = p.ip.split(".").slice(0, 3).join(".");
      log(`procurando em ${base}.1-254 (${p.nome})…`);
      const ips = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`).filter((ip) => ip !== p.ip);
      await Promise.all(ips.map((ip) => testarPorta(ip, 9, 600, 0)));
    }
    lista = await lerArp();
    achado = lista.find((v) => v.mac === mac);
  }
  if (achado) {
    console.log(`\nDECODER ENCONTRADO: ${achado.ip}  (MAC ${mac})`);
    console.log(`Próximo passo: node\\node.exe agente\\calx.mjs portas ${achado.ip}`);
    return;
  }
  console.log(`\nDecoder (MAC ${mac}) não encontrado.`);
  if (!placas.some((p) => p.ip.startsWith("192.168.137."))) {
    console.log("Nenhuma placa com IP 192.168.137.1: o compartilhamento da Wi-Fi para a placa TP-Link ainda não está ativo.");
  }
  console.log("Confira: cabo do decoder no adaptador TP-Link, compartilhamento ativo, e desligue/ligue o decoder; espere 30s e rode de novo.");
}

async function portas(host, opcoes) {
  validarIp(host);
  const de = Number(opcoes.de ?? 1);
  const ate = Number(opcoes.ate ?? 65535);
  const paralelo = Number(opcoes.paralelo ?? 300);
  const timeout = Number(opcoes.timeout ?? 800);
  log(`testando portas TCP ${de}-${ate} em ${host} (só conecta e escuta; não envia dados)…`);
  const abertas = [];
  let proxima = de;
  let feitas = 0;
  const total = ate - de + 1;
  const progresso = setInterval(() => log(`${feitas}/${total} portas testadas, ${abertas.length} aberta(s)`), 10_000);
  const trabalhador = async () => {
    while (proxima <= ate) {
      const p = proxima++;
      const r = await testarPorta(host, p, timeout, 2500);
      feitas++;
      if (r.abriu) {
        abertas.push(r);
        log(`ABERTA ${host}:${p}  ${r.bytes.length ? previa(r.bytes) : "(não mandou nada sozinha)"}`);
      }
    }
  };
  await Promise.all(Array.from({ length: paralelo }, trabalhador));
  clearInterval(progresso);
  console.log(`\nTerminado: ${abertas.length} porta(s) aberta(s): ${abertas.map((a) => a.porta).sort((a, b) => a - b).join(", ") || "nenhuma"}`);
  if (!abertas.length) {
    console.log("Nenhuma porta aberta: o decoder provavelmente é quem conecta no PC. Tente: calx.mjs ouvir --tcp ... --udp ...");
  }
}

async function ouvir(opcoes) {
  const tcp = numeros(opcoes.tcp);
  const udp = numeros(opcoes.udp);
  if (!tcp.length && !udp.length) throw new Error("informe --tcp e/ou --udp com as portas, ex.: --tcp 5000 --udp 5000");
  const segundos = Number(opcoes.segundos ?? 120);
  const gravador = abrirArquivo("ouvir");
  const fechar = [];
  for (const p of tcp) {
    const srv = net.createServer((s) => {
      const origem = `${s.remoteAddress}:${s.remotePort}->tcp${p}`;
      log(`CONEXÃO RECEBIDA de ${origem}`);
      s.on("data", (d) => gravador.escrever(origem, d));
      s.on("error", () => {});
      s.on("close", () => log(`conexão encerrada: ${origem}`));
    });
    srv.on("error", (e) => log(`não consegui escutar TCP ${p}: ${e.message}`));
    srv.listen(p, "0.0.0.0", () => log(`escutando TCP ${p}`));
    fechar.push(() => srv.close());
  }
  for (const p of udp) {
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    sock.on("message", (d, info) => gravador.escrever(`${info.address}:${info.port}->udp${p}`, d));
    sock.on("error", (e) => log(`não consegui escutar UDP ${p}: ${e.message}`));
    sock.bind(p, () => log(`escutando UDP ${p}`));
    fechar.push(() => sock.close());
  }
  log(`esperando ${segundos}s. Ligue/desligue o decoder e passe transponders na antena.`);
  await new Promise((r) => setTimeout(r, segundos * 1000));
  fechar.forEach((f) => f());
  await gravador.fechar();
  log("fim da escuta.");
}

async function gravar(host, porta, opcoes) {
  validarIp(host);
  if (!(Number(porta) > 0 && Number(porta) < 65536)) throw new Error(`"${porta ?? ""}" não é uma porta. Use a porta ABERTA que "calx.mjs portas" mostrou.`);
  const segundos = Number(opcoes.segundos ?? 120);
  const gravador = abrirArquivo(`${host}-${porta}`);
  const s = net.connect({ host, port: Number(porta) });
  s.on("connect", () => log(`conectado em ${host}:${porta}. Passe transponders na antena (${segundos}s).`));
  s.on("data", (d) => gravador.escrever(`${host}:${porta}`, d));
  s.on("error", (e) => log(`erro: ${e.message}`));
  s.on("close", () => log("conexão encerrada pelo decoder."));
  await new Promise((r) => setTimeout(r, segundos * 1000));
  s.destroy();
  await gravador.fechar();
  log("fim da gravação.");
}

const { opcoes, pos } = argumentos(process.argv.slice(2));
try {
  if (pos[0] === "achar") await achar(opcoes);
  else if (pos[0] === "portas") await portas(pos[1], opcoes);
  else if (pos[0] === "ouvir") await ouvir(opcoes);
  else if (pos[0] === "gravar") await gravar(pos[1], pos[2], opcoes);
  else {
    console.log("Uso:\n  calx.mjs achar\n  calx.mjs portas IP\n  calx.mjs ouvir --tcp 5000 --udp 5000 [--segundos 120]\n  calx.mjs gravar IP PORTA [--segundos 120]");
  }
} catch (e) {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
}
