@echo off
title SolarQuote Pro - Servidor y App
echo ===================================================
echo     Iniciando SolarQuote Pro & CRM Solar
echo ===================================================
echo.
cd /d "%~dp0"
call npm.cmd run dev
pause
