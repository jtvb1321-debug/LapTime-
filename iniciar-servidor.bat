@echo off
rem Sobe o Grid Lap nesta maquina e abre o link publico (Cloudflare Tunnel).
rem O endereco https://....trycloudflare.com aparece na janela "Grid Lap - tunel"
rem e MUDA a cada vez que o tunel e iniciado.
cd /d "%~dp0"

start "Grid Lap - servidor" cmd /k npx next start -H 127.0.0.1 -p 3000
timeout /t 8 /nobreak >nul
start "Grid Lap - tunel" "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --no-autoupdate --url http://127.0.0.1:3000

echo.
echo Servidor local: http://127.0.0.1:3000
echo Procure o link https://...trycloudflare.com na janela "Grid Lap - tunel".
pause
