# Libera a porta 3001 no Firewall do Windows para o celular/tablet abrir o sistema e a página de
# assinatura do termo. Rode UMA vez, como administrador (botão direito no
# PowerShell → "Executar como administrador"):
#
#   powershell -ExecutionPolicy Bypass -File liberar-porta-celular.ps1
#
# Vale para redes Privada e de Domínio.
# Para desfazer:  Remove-NetFirewallRule -DisplayName "GridLap assinatura (3001)"
New-NetFirewallRule -DisplayName "GridLap assinatura (3001)" -Direction Inbound `
  -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private,Domain | Out-Null
Write-Host "Porta 3001 liberada para redes Privada/Domínio."
