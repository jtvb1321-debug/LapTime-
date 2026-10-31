@echo off
rem Simulador de decoder (SOMENTE TESTE): gera passagens de 4 karts de mentira
rem (SIM1001 a SIM1004) e envia ao Grid Lap local. Ctrl+C para parar.
cd /d "%~dp0"
node coletor\coletor.mjs rodar
pause
