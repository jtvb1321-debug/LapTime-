# Para o sistema local (servidor, túnel do banco e os religadores).
#   powershell -ExecutionPolicy Bypass -File parar-local.ps1

# Primeiro os religadores (senão eles sobem tudo de novo).
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
  Where-Object { $_.CommandLine -like "*.tunel-local.cmd*" -or $_.CommandLine -like "*.servidor-local.cmd*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

foreach ($porta in 3001, 55432) {
  Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Write-Host "Sistema local parado."
