# Sobe o sistema local: túnel do banco + servidor em http://127.0.0.1:3001 +
# acessível na rede (celular, tablet) em http://<IP deste computador>:3001.
# Tudo é religado sozinho se cair. Rode quantas vezes quiser: só inicia o que
# ainda não estiver no ar.
#
#   powershell -ExecutionPolicy Bypass -File iniciar-local.ps1
#
# Para parar: powershell -ExecutionPolicy Bypass -File parar-local.ps1
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $pasta

function Escutando($porta) {
  [bool](Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue)
}

# Endereço deste computador na rede (o do celular precisa estar na mesma rede).
$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
$ip = if ($cfg) { $cfg.IPv4Address.IPAddress } else { $null }
$urlCelular = if ($ip) { "http://${ip}:3001" } else { $null }

if (-not (Test-Path (Join-Path $pasta ".next"))) {
  Write-Host "Primeira vez (ou sem build): gerando o sistema, pode levar alguns minutos..."
  npm run build
}

# Túnel do banco (reconecta se a conexão cair ou ficar ociosa).
if (-not (Escutando 55432)) {
  $tunel = Join-Path $pasta ".tunel-local.cmd"
  Set-Content -Path $tunel -Encoding ASCII -Value @(
    "@echo off",
    ":a",
    "ssh -N -L 55432:127.0.0.1:55432 -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes gts-server",
    "ping -n 4 127.0.0.1 >nul",
    "goto a"
  )
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$tunel`"" -WindowStyle Hidden
  Write-Host "Túnel do banco iniciado."
}

# Servidor do sistema (reinicia sozinho se parar). Os links de termo saem com o
# endereço da rede, para abrir no celular.
if (-not (Escutando 3001)) {
  $servidor = Join-Path $pasta ".servidor-local.cmd"
  $linhas = @("@echo off", "cd /d `"$pasta`"")
  if ($urlCelular) { $linhas += "set URL_PUBLICA=$urlCelular" }
  $linhas += @(":a", "call npx next start -H 0.0.0.0 -p 3001", "ping -n 4 127.0.0.1 >nul", "goto a")
  Set-Content -Path $servidor -Encoding ASCII -Value $linhas
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$servidor`"" -WindowStyle Hidden
  Write-Host "Servidor iniciado."
}

for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri http://127.0.0.1:3001/login -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
      Write-Host "Pronto: http://127.0.0.1:3001 (neste computador)"
      if ($urlCelular) {
        Write-Host "Na rede (celular/tablet): $urlCelular"
        Write-Host "Se o celular não abrir, libere a porta 3001 uma vez (como administrador): liberar-porta-celular.ps1"
      }
      exit 0
    }
  } catch { Start-Sleep -Seconds 2 }
}
Write-Host "O servidor ainda não respondeu. Veja se a porta 3001 está livre e tente de novo."
exit 1
