# Prepara a rede do decoder CalX Pro (rode UMA vez, como Administrador).
#
# O decoder pede IP por DHCP. Sem DHCP ele cai em 169.254.x e o Windows nao
# consegue falar com ele. Este script ativa o "Compartilhamento de Conexao com a
# Internet" da placa que tem internet (Wi-Fi) para a placa do adaptador USB-Ethernet
# do decoder (TP-Link): a placa fica com 192.168.137.1 e entrega 192.168.137.x ao
# decoder. O compartilhamento continua valendo depois de desconectar/reconectar.
#
# Uso:   clique com o botao direito > "Executar com o PowerShell" (como administrador)
#        ou use "Preparar rede do decoder.cmd" (pede permissao de administrador).
#   -Desfazer          desliga o compartilhamento
#   -Placa "TP-LINK"   texto que identifica a descricao da placa do decoder
#   -Internet "Wi-Fi"  nome da placa que tem internet (padrao: a da rota padrao)
param(
  [switch]$Desfazer,
  [string]$Placa = "TP-?LINK|USB.*Ethernet|Ethernet.*USB",
  [string]$Internet = ""
)

$ErrorActionPreference = "Stop"
$eAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $eAdmin) {
  Write-Host "Rode como Administrador (botao direito > Executar como administrador)." -ForegroundColor Red
  exit 1
}

function Mostrar($t) { Write-Host $t }

$redes = New-Object -ComObject HNetCfg.HNetShare
$itens = @()
# foreach: Where-Object sobre EnumEveryConnection nao funciona.
foreach ($c in $redes.EnumEveryConnection) {
  $props = $redes.NetConnectionProps.Invoke($c)
  $cfg = $redes.INetSharingConfigurationForINetConnection.Invoke($c)
  $itens += [pscustomobject]@{ Nome = $props.Name; Conexao = $c; Config = $cfg }
}

if ($Desfazer) {
  foreach ($i in $itens) {
    if ($i.Config.SharingEnabled) {
      $i.Config.DisableSharing()
      Mostrar "Compartilhamento desligado em: $($i.Nome)"
    }
  }
  exit 0
}

# Placa do decoder: pela DESCRICAO do adaptador (o nome "Ethernet 4" muda).
$adaptadores = Get-NetAdapter -Physical -ErrorAction SilentlyContinue
$doDecoder = $adaptadores | Where-Object { $_.InterfaceDescription -match $Placa } | Select-Object -First 1
if (-not $doDecoder) {
  Write-Host "Nao achei a placa do decoder (descricao parecida com '$Placa')." -ForegroundColor Red
  Write-Host "Placas vistas:"
  $adaptadores | ForEach-Object { Write-Host "  $($_.Name) - $($_.InterfaceDescription) [$($_.Status)]" }
  Write-Host "Conecte o adaptador USB-Ethernet e rode de novo (ou passe -Placa 'texto da descricao')."
  exit 1
}

# Placa com internet: a da rota padrao (ou a informada).
if ($Internet) {
  $comInternet = $adaptadores | Where-Object { $_.Name -eq $Internet } | Select-Object -First 1
} else {
  $rota = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceIndex -ne $doDecoder.ifIndex } |
    Sort-Object RouteMetric | Select-Object -First 1
  $comInternet = if ($rota) { $adaptadores | Where-Object { $_.ifIndex -eq $rota.InterfaceIndex } | Select-Object -First 1 }
}
if (-not $comInternet) {
  Write-Host "Nao achei a placa que tem internet (Wi-Fi). Passe -Internet 'Wi-Fi'." -ForegroundColor Red
  exit 1
}

Mostrar "Placa do decoder:   $($doDecoder.Name) ($($doDecoder.InterfaceDescription))"
Mostrar "Placa com internet: $($comInternet.Name)"

$publica = $itens | Where-Object { $_.Nome -eq $comInternet.Name } | Select-Object -First 1
$privada = $itens | Where-Object { $_.Nome -eq $doDecoder.Name } | Select-Object -First 1
if (-not $publica -or -not $privada) {
  Write-Host "O Windows nao listou uma das placas para compartilhamento." -ForegroundColor Red
  exit 1
}

# Só uma conexao pode ser a "publica": desliga o que estiver ligado nas outras.
foreach ($i in $itens) {
  if ($i.Config.SharingEnabled -and $i.Nome -ne $publica.Nome -and $i.Nome -ne $privada.Nome) {
    $i.Config.DisableSharing()
  }
}
if ($publica.Config.SharingEnabled) { $publica.Config.DisableSharing() }
if ($privada.Config.SharingEnabled) { $privada.Config.DisableSharing() }

$publica.Config.EnableSharing(0)   # 0 = publica (a que tem internet)
$privada.Config.EnableSharing(1)   # 1 = privada (a do decoder)

Mostrar ""
Mostrar "Pronto. A placa '$($doDecoder.Name)' deve ficar com 192.168.137.1 em alguns segundos."
Mostrar "Reconecte o adaptador do decoder (ou desligue e ligue o decoder) e abra o Grid Lap."
