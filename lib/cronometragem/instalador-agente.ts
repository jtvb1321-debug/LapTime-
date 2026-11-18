import { readFile } from "node:fs/promises";
import path from "node:path";
import { criarZip } from "@/lib/zip-simples";

// Arquivo "Instalar.cmd" do pacote: só usa o que o Windows já traz (cmd, winget)
// e roda o agente com o Node. Sem pedir nada ao operador.
const INSTALAR_CMD = [
  "@echo off",
  "setlocal",
  "title Grid Lap - Instalador do agente",
  'set "DESTINO=%LOCALAPPDATA%\\GridLap\\agente"',
  'set "NODE="',
  "echo.",
  "echo === Grid Lap - agente do computador da pista ===",
  "echo.",
  'for /f "delims=" %%i in (\'where node 2^>nul\') do if not defined NODE set "NODE=%%i"',
  'if not defined NODE if exist "%ProgramFiles%\\nodejs\\node.exe" set "NODE=%ProgramFiles%\\nodejs\\node.exe"',
  "if not defined NODE goto instalar_node",
  "goto copiar",
  "",
  ":instalar_node",
  "echo O Node.js nao esta instalado. Instalando agora, aguarde...",
  "winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements",
  'if exist "%ProgramFiles%\\nodejs\\node.exe" set "NODE=%ProgramFiles%\\nodejs\\node.exe"',
  "if defined NODE goto copiar",
  "echo.",
  "echo Nao consegui instalar o Node.js sozinho.",
  "echo Instale a versao LTS em https://nodejs.org e abra este arquivo de novo.",
  "pause",
  "exit /b 1",
  "",
  ":copiar",
  '"%NODE%" -e "process.exit(Number(process.versions.node.split(\'.\')[0])<18?1:0)"',
  "if errorlevel 1 (",
  "  echo O Node.js deste computador e antigo. Instale a versao LTS em https://nodejs.org",
  "  pause",
  "  exit /b 1",
  ")",
  'if not exist "%DESTINO%" mkdir "%DESTINO%"',
  'copy /y "%~dp0agente.cjs" "%DESTINO%\\agente.cjs" >nul',
  'copy /y "%~dp0pareamento.json" "%DESTINO%\\pareamento.json" >nul',
  'if not exist "%DESTINO%\\agente.cjs" goto falhou',
  '"%NODE%" "%DESTINO%\\agente.cjs" instalar',
  "echo.",
  "pause",
  "exit /b 0",
  "",
  ":falhou",
  "echo Nao consegui copiar os arquivos. Extraia a pasta inteira do .zip e tente de novo.",
  "pause",
  "exit /b 1",
  "",
].join("\r\n");

const LEIA_ME = [
  "GRID LAP - AGENTE DO COMPUTADOR DA PISTA",
  "",
  "1. Extraia esta pasta (clique direito no .zip > Extrair tudo).",
  "2. De duplo clique em Instalar.cmd.",
  "3. Conecte o decoder a este computador e ligue-o.",
  "",
  "Pronto: o agente procura o decoder sozinho e abre sempre que o Windows",
  "iniciar. O decoder aparece no sistema, em Configuracoes > Decoder.",
  "",
  "O codigo de pareamento deste pacote vale 15 minutos e so serve uma vez.",
  "Se passar do prazo, baixe o instalador de novo no sistema.",
  "",
  "Para desfazer o inicio automatico:",
  '  node "%LOCALAPPDATA%\\GridLap\\agente\\agente.cjs" remover-inicio',
  "",
].join("\r\n");

// Monta o .zip com o agente, o endereço do sistema e um código de pareamento
// recém-gerado (o chamador cria o código e controla a permissão).
export async function montarInstalador(
  servidor: string,
  codigo: string,
): Promise<Buffer> {
  const agente = await readFile(
    path.join(process.cwd(), "public", "agente", "agente.cjs"),
  );
  return criarZip([
    { nome: "Instalar.cmd", conteudo: INSTALAR_CMD },
    { nome: "agente.cjs", conteudo: agente },
    {
      nome: "pareamento.json",
      conteudo: JSON.stringify({ servidor, codigo }, null, 2),
    },
    { nome: "LEIA-ME.txt", conteudo: LEIA_ME },
  ]);
}
