@echo off
chcp 65001 >nul
title Grid Lap - TESTE com simulador do CalX Pro
cd /d "%~dp0"
echo.
echo TESTE SEM DECODER: um simulador manda passagens no formato real do CalX Pro.
echo O Grid Lap precisa estar aberto ("Grid Lap.exe"). Em ate 1 minuto aparece
echo "Decoder CalX Pro" em Cronometragem ^> Equipamentos, com as passagens simuladas.
echo Feche esta janela para parar o teste.
echo.
rem O agente procura o decoder neste endereco (so enquanto o teste roda).
>"agente\calx-host.txt" echo 127.0.0.1
node\node.exe agente\calx.mjs simular --aceleracao 10
del "agente\calx-host.txt" >nul 2>&1
echo.
pause
