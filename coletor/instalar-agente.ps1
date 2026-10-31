# Faz o agente do computador da pista iniciar sozinho quando este usuário entra
# no Windows. Rode UMA vez, depois de parear (node coletor/agente.mjs parear ...):
#
#   powershell -ExecutionPolicy Bypass -File coletor\instalar-agente.ps1
#
# Para desfazer:  powershell -ExecutionPolicy Bypass -File coletor\instalar-agente.ps1 -Remover
#
# Só cria (ou apaga) um arquivo na pasta "Inicializar" do SEU usuário; não mexe
# em serviços, no registro nem em configurações do sistema.
param([switch]$Remover)

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$atalho = Join-Path ([Environment]::GetFolderPath('Startup')) 'GridLap-Agente.cmd'

if ($Remover) {
  if (Test-Path $atalho) { Remove-Item $atalho; Write-Host "Removido: $atalho" }
  else { Write-Host "Nada para remover." }
  exit 0
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Error "Node.js não encontrado. Instale o Node 18 ou mais novo."; exit 1 }
if (-not (Test-Path (Join-Path $pasta 'agente.json'))) {
  Write-Error "Este computador ainda não foi pareado. Rode primeiro: node coletor\agente.mjs parear CODIGO --servidor http://..."
  exit 1
}

$linhas = @(
  '@echo off',
  "cd /d `"$pasta`"",
  "start `"GridLap Agente`" /min `"$node`" agente.mjs rodar"
)
Set-Content -Path $atalho -Value $linhas -Encoding ASCII
Write-Host "Pronto: o agente vai iniciar junto com o Windows ($atalho)."
Write-Host "Para iniciar agora sem reiniciar: node coletor\agente.mjs rodar"
