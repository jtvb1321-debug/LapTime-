// Gerador mínimo de .zip (arquivos sem compressão, nomes em UTF-8). Serve para
// entregar pacotes pequenos, como o instalador do agente, sem dependência extra.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) {
    c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ArquivoZip {
  nome: string;
  conteudo: Uint8Array | string;
}

// Data fixa (01/01/2026): o pacote é igual para o mesmo conteúdo.
const DOS_DATA = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function criarZip(arquivos: ArquivoZip[]): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;

  for (const a of arquivos) {
    const nome = Buffer.from(a.nome, "utf8");
    const dados =
      typeof a.conteudo === "string"
        ? Buffer.from(a.conteudo, "utf8")
        : Buffer.from(a.conteudo);
    const crc = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // nome em UTF-8
    local.writeUInt16LE(0, 8); // sem compressão
    local.writeUInt16LE(0, 10); // hora
    local.writeUInt16LE(DOS_DATA, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);
    partes.push(local, nome, dados);

    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4);
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(0x0800, 8);
    entrada.writeUInt16LE(0, 10);
    entrada.writeUInt16LE(0, 12);
    entrada.writeUInt16LE(DOS_DATA, 14);
    entrada.writeUInt32LE(crc, 16);
    entrada.writeUInt32LE(dados.length, 20);
    entrada.writeUInt32LE(dados.length, 24);
    entrada.writeUInt16LE(nome.length, 28);
    entrada.writeUInt32LE(deslocamento, 42);
    central.push(entrada, nome);

    deslocamento += local.length + nome.length + dados.length;
  }

  const tamanhoCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamanhoCentral, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...partes, ...central, fim]);
}
