@echo off
chcp 65001 >nul
title Grid Lap - Preparar rede do decoder
cd /d "%~dp0"
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Pedindo permissao de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Preparar rede do decoder.ps1"
echo.
pause
