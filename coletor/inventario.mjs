// Inventário do que está ligado neste computador: USB, portas seriais e
// aparelhos vistos na rede. SÓ LEITURA — consulta o próprio sistema operacional
// (lista de dispositivos do Windows/Linux e tabela ARP); não captura pacotes,
// não abre portas e não envia nada aos aparelhos.
//
// Cada item: { chave, tipo: "usb" | "serial" | "rede", nome, detalhe? }.
// A "chave" identifica o TIPO de aparelho (ex.: usb:VID_0403&PID_6001), não a
// unidade: assim o sistema reconhece o decoder mesmo em outra porta USB.
import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import {
  MAC_DECODER_CALX,
  acordarFaixasDoDecoder,
  interfacesLocais,
  listarVizinhos,
} from "./descoberta.mjs";

const NOME_GENERICO =
  /composite|composto|root hub|generic usb hub|hub usb|usb hub/i;
const EH_HUB = /hub/i;

function vidPid(texto) {
  const m = /VID_([0-9A-F]{4})[&+]PID_([0-9A-F]{4})/i.exec(texto);
  return m ? `VID_${m[1].toUpperCase()}&PID_${m[2].toUpperCase()}` : null;
}

// Itens de `Get-PnpDevice` (FriendlyName, InstanceId, Class) → inventário.
export function inventarioDePnp(itens) {
  const lista = Array.isArray(itens) ? itens : itens ? [itens] : [];
  const porChave = new Map();
  for (const d of lista) {
    const id = String(d?.InstanceId ?? "");
    const nome = String(d?.FriendlyName ?? "").trim();
    const classe = String(d?.Class ?? "");
    if (!id) continue;
    const fabricante = String(d?.Manufacturer ?? "").trim();
    const driver = String(d?.Service ?? "").trim();
    const extra = [
      id,
      fabricante && `fabricante: ${fabricante}`,
      driver && `driver: ${driver}`,
    ]
      .filter(Boolean)
      .join(" | ");

    // Porta serial (COM): o nome traz "(COM3)".
    const com = /\((COM\d+)\)/i.exec(nome);
    if (classe === "Ports" && com) {
      const chave = `serial:${com[1].toUpperCase()}`;
      porChave.set(chave, {
        chave,
        tipo: "serial",
        nome,
        detalhe: extra,
      });
      continue;
    }

    if (!/^(USB|FTDIBUS)\\/i.test(id)) continue;
    const par = vidPid(id);
    if (!par) continue;
    if (EH_HUB.test(nome)) continue;
    const chave = `usb:${par}`;
    const atual = porChave.get(chave);
    // Vários itens do mesmo aparelho (pai composto + interfaces): fica o que
    // tem o nome mais descritivo.
    if (
      !atual ||
      (NOME_GENERICO.test(atual.nome) && !NOME_GENERICO.test(nome))
    ) {
      porChave.set(chave, {
        chave,
        tipo: "usb",
        nome: nome || chave,
        detalhe: extra,
      });
    }
  }
  return [...porChave.values()];
}

// `lsusb` (Linux): "Bus 001 Device 004: ID 0403:6001 Future Technology ..."
export function inventarioDeLsusb(texto) {
  const itens = [];
  for (const m of String(texto).matchAll(
    /ID ([0-9a-f]{4}):([0-9a-f]{4})\s*(.*)$/gim,
  )) {
    const nome = m[3].trim();
    if (EH_HUB.test(nome)) continue;
    const chave = `usb:VID_${m[1].toUpperCase()}&PID_${m[2].toUpperCase()}`;
    if (!itens.some((i) => i.chave === chave)) {
      itens.push({ chave, tipo: "usb", nome: nome || chave });
    }
  }
  return itens;
}

// Portas seriais do Linux/macOS (nomes de arquivo em /dev).
export function inventarioDeTty(arquivos) {
  return arquivos
    .filter((a) => /^(ttyUSB|ttyACM|tty\.usb|cu\.usb)/i.test(a))
    .map((a) => ({
      chave: `serial:/dev/${a}`,
      tipo: "serial",
      nome: `Porta serial /dev/${a}`,
    }));
}

// Aparelhos que a tabela ARP já conhece (só vizinhos "de verdade").
export function inventarioDeRede(vizinhos) {
  return vizinhos.map((v) => ({
    chave: `rede:${v.mac}`,
    tipo: "rede",
    nome:
      v.mac === MAC_DECODER_CALX
        ? `Decoder CalX Pro (${v.ip})`
        : `Aparelho na rede (${v.ip})`,
    detalhe: v.ip,
  }));
}

// Adaptador USB-Ethernet do decoder (TP-Link, VID_2357&PID_0601) ligado mas
// sem rede: o Windows deu um IP 169.254.x (sem DHCP) e nada chega ao decoder.
export const CHAVE_ADAPTADOR_DECODER = "usb:VID_2357&PID_0601";
export function alertaPlacaDoDecoder(itens, placas) {
  if (!itens.some((i) => i.chave === CHAVE_ADAPTADOR_DECODER)) return null;
  if (placas.some((p) => p.ip.startsWith("192.168.137."))) return null;
  if (!placas.some((p) => p.ip.startsWith("169.254."))) return null;
  return {
    chave: "alerta:placa-decoder-sem-rede",
    tipo: "outro",
    nome: "A placa do decoder está sem rede",
    detalhe:
      "Rode 'Preparar rede do decoder' (uma vez, como administrador) e reconecte o adaptador.",
  };
}

function executar(comando, args, timeout = 20000) {
  return new Promise((resolve) => {
    execFile(
      comando,
      args,
      { timeout, windowsHide: true, maxBuffer: 5 * 1024 * 1024 },
      (erro, saida) => resolve(erro ? null : String(saida)),
    );
  });
}

const SCRIPT_WINDOWS = [
  "[Console]::OutputEncoding = [Text.Encoding]::UTF8;",
  "Get-PnpDevice -PresentOnly |",
  "Where-Object { $_.InstanceId -match '^(USB|FTDIBUS)\\\\' -or $_.Class -eq 'Ports' } |",
  "Select-Object FriendlyName, InstanceId, Class, Manufacturer, Service |",
  "ConvertTo-Json -Compress",
].join(" ");

export async function coletarInventario() {
  const itens = [];
  if (process.platform === "win32") {
    const saida = await executar("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      SCRIPT_WINDOWS,
    ]);
    if (saida && saida.trim()) {
      try {
        itens.push(...inventarioDePnp(JSON.parse(saida)));
      } catch {
        // saída inesperada do PowerShell: segue só com a rede
      }
    }
  } else {
    const lsusb = await executar("lsusb", []);
    if (lsusb) itens.push(...inventarioDeLsusb(lsusb));
    try {
      itens.push(...inventarioDeTty(readdirSync("/dev")));
    } catch {
      // sem acesso ao /dev
    }
  }
  let vizinhos = await listarVizinhos();
  // Decoder de rede ainda não visto: acorda a faixa do cabo dele e olha de novo.
  if (
    !vizinhos.some((v) => v.mac === MAC_DECODER_CALX) &&
    (await acordarFaixasDoDecoder())
  ) {
    vizinhos = await listarVizinhos();
  }
  itens.push(...inventarioDeRede(vizinhos));
  const alerta = alertaPlacaDoDecoder(itens, interfacesLocais());
  if (alerta) itens.push(alerta);
  return itens;
}
