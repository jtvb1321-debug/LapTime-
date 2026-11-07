import { execFile } from "node:child_process";
import dgram from "node:dgram";
import net from "node:net";
import os from "node:os";

// Busca de decoders na rede. Duas etapas, da mais discreta à mais ativa:
//
//  1. PASSIVA (sempre): lista os aparelhos que este computador já conhece na
//     rede (tabela ARP) e, se pedido, ESCUTA portas UDP por alguns segundos.
//     Não envia nada.
//  2. ATIVA (só com --ativo): tenta abrir conexão TCP nas portas candidatas
//     de uma faixa de IPs que VOCÊ escolheu e, nas que abrirem, apenas ESPERA
//     os bytes que o aparelho mandar sozinho. Não envia dados.
//
// Atenção: decoders que aceitam um programa por vez podem tratar a conexão da
// busca como "o programa". Faça a busca fora de corrida e com o outro
// programa (ex.: LapTime) fechado.

// Portas candidatas — não são garantia de nada, só lugares comuns onde
// decoders e conversores serial→rede costumam escutar. Acrescente as suas
// com --portas.
export const PORTAS_CANDIDATAS = [23, 80, 4001, 5100, 10001];

const IGNORAR_MAC = /^(ff[-:]ff[-:]ff[-:]ff[-:]ff[-:]ff|01[-:]00[-:]5e)/i;

export function lerTabelaArp(texto) {
  const achados = [];
  const re =
    /(\d{1,3}(?:\.\d{1,3}){3})\D+?([0-9a-f]{2}([-:])[0-9a-f]{2}(?:\3[0-9a-f]{2}){4})/gi;
  for (const m of texto.matchAll(re)) {
    const [, ip, mac] = m;
    const primeiro = Number(ip.split(".")[0]);
    if (primeiro >= 224 || IGNORAR_MAC.test(mac)) continue;
    achados.push({ ip, mac: mac.toLowerCase().replaceAll("-", ":") });
  }
  return achados;
}

export function listarVizinhos() {
  return new Promise((resolve) => {
    execFile("arp", ["-a"], { timeout: 5000 }, (erro, saida) => {
      resolve(erro ? [] : lerTabelaArp(String(saida)));
    });
  });
}

export function interfacesLocais() {
  const lista = [];
  for (const [nome, enderecos] of Object.entries(os.networkInterfaces())) {
    for (const e of enderecos ?? []) {
      if (e.family !== "IPv4" || e.internal) continue;
      lista.push({ nome, ip: e.address, mascara: e.netmask, cidr: e.cidr });
    }
  }
  return lista;
}

function ipParaNumero(ip) {
  return ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
}

function numeroParaIp(n) {
  return [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join(".");
}

// "192.168.1.0/24" → todos os hosts utilizáveis. Faixas maiores que /22 são
// recusadas (varrer centenas de aparelhos sem querer não é o objetivo).
export function hostsDaFaixa(cidr) {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(cidr.trim());
  if (!m)
    throw new Error(`Faixa inválida: ${cidr} (use o formato 192.168.1.0/24).`);
  const bits = Number(m[2]);
  if (bits < 22 || bits > 30) {
    throw new Error("Use uma faixa entre /22 e /30.");
  }
  const tamanho = 2 ** (32 - bits);
  const rede = Math.floor(ipParaNumero(m[1]) / tamanho) * tamanho;
  const hosts = [];
  for (let i = 1; i < tamanho - 1; i++) hosts.push(numeroParaIp(rede + i));
  return hosts;
}

// Abre a conexão e só ESCUTA: devolve o que o aparelho mandar sozinho.
export function espiar(host, porta, { timeoutMs = 400, escutaMs = 1500 } = {}) {
  return new Promise((resolve) => {
    const pedacos = [];
    let abriu = false;
    const socket = net.connect({ host, port: porta });
    const terminar = () => {
      clearTimeout(limite);
      socket.destroy();
      resolve({ abriu, bytes: Buffer.concat(pedacos).subarray(0, 512) });
    };
    const limite = setTimeout(terminar, timeoutMs);
    socket.on("connect", () => {
      abriu = true;
      clearTimeout(limite);
      setTimeout(terminar, escutaMs);
    });
    socket.on("data", (d) => pedacos.push(d));
    socket.on("error", terminar);
  });
}

// Varre `hosts` × `portas` com no máximo `concorrencia` conexões ao mesmo
// tempo. `reconhecer(bytes, host, porta)` devolve o driver que entende os
// bytes (ou null).
/**
 * @param {{
 *   hosts: string[],
 *   portas: number[],
 *   concorrencia?: number,
 *   timeoutMs?: number,
 *   escutaMs?: number,
 *   reconhecer?: (bytes: Buffer, host: string, porta: number) => ({ id: string } | null),
 *   aoAchar?: (achado: { host: string, porta: number, bytes: Buffer, driver: string | null }) => void,
 * }} opcoes
 * @returns {Promise<Array<{ host: string, porta: number, bytes: Buffer, driver: string | null }>>}
 */
export async function varrer({
  hosts,
  portas,
  concorrencia = 48,
  timeoutMs = 400,
  escutaMs = 1500,
  reconhecer,
  aoAchar,
}) {
  const alvos = hosts.flatMap((host) =>
    portas.map((porta) => ({ host, porta })),
  );
  const achados = [];
  let proximo = 0;
  async function trabalhador() {
    while (proximo < alvos.length) {
      const { host, porta } = alvos[proximo++];
      const { abriu, bytes } = await espiar(host, porta, {
        timeoutMs,
        escutaMs,
      });
      if (!abriu) continue;
      const driver = reconhecer ? reconhecer(bytes, host, porta) : null;
      const achado = { host, porta, bytes, driver: driver?.id ?? null };
      achados.push(achado);
      aoAchar?.(achado);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concorrencia, alvos.length) }, trabalhador),
  );
  return achados;
}

// Escuta portas UDP (sem enviar nada) e devolve quem falou e o que parece ser.
export function escutarUdp(portas, ms) {
  return new Promise((resolve) => {
    const vistos = new Map();
    const sockets = [];
    for (const porta of portas) {
      const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
      s.on("message", (msg, remoto) => {
        const chave = `${remoto.address}:${porta}`;
        const v = vistos.get(chave) ?? {
          origem: remoto.address,
          porta,
          pacotes: 0,
          exemplo: msg.subarray(0, 64),
        };
        v.pacotes += 1;
        vistos.set(chave, v);
      });
      s.on("error", () => s.close());
      s.bind(porta, () => undefined);
      sockets.push(s);
    }
    setTimeout(() => {
      for (const s of sockets) {
        try {
          s.close();
        } catch {
          // já fechado por erro de bind
        }
      }
      resolve([...vistos.values()]);
    }, ms);
  });
}

// Decoder CalX Pro conhecido de fábrica (MAC da unidade da pista).
export const MAC_DECODER_CALX = "34:ea:e7:57:78:41";
// Faixa do cabo de rede dedicado ao decoder (compartilhamento de conexão do
// Windows para o adaptador). Outras faixas: variável GRIDLAP_FAIXAS_DECODER
// (ex.: "192.168.50.0/24,192.168.60.0/24").
const FAIXA_PADRAO_DECODER = "192.168.137.0/24";
let ultimaBusca = 0;

// "Acorda" a faixa do decoder para ele aparecer na tabela ARP: uma tentativa
// de conexão rápida por IP (porta 9), sem enviar dados. Só em placas que
// têm IP nessa faixa, e no máximo a cada 30 segundos.
export async function acordarFaixasDoDecoder() {
  if (Date.now() - ultimaBusca < 30_000) return false;
  ultimaBusca = Date.now();
  const faixas = (process.env.GRIDLAP_FAIXAS_DECODER || FAIXA_PADRAO_DECODER)
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const locais = interfacesLocais().map((i) => i.ip);
  let acordou = false;
  for (const faixa of faixas) {
    let hosts;
    try {
      hosts = hostsDaFaixa(faixa);
    } catch {
      continue;
    }
    const base = faixa.split("/")[0].split(".").slice(0, 3).join(".");
    if (!locais.some((ip) => ip.startsWith(`${base}.`))) continue;
    await varrer({
      hosts: hosts.filter((h) => !locais.includes(h)),
      portas: [9],
      concorrencia: 128,
      timeoutMs: 600,
      escutaMs: 0,
    });
    acordou = true;
  }
  return acordou;
}
