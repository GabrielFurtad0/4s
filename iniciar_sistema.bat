@echo off
chcp 65001 >nul
title 4S ERP - Total Trigo

echo ============================================================================
echo   TOTAL TRIGO ERP - Forca de Vendas (Rua), Backoffice Pre-Nota e Importacao
echo ============================================================================
echo.
echo [1/2] Iniciando Backend Spring Boot (Porta 8085 - Banco H2 Local)...
start "TotalTrigo Backend API (8085)" /D "%~dp0backend" cmd /k "mvnw.cmd spring-boot:run"

echo [2/2] Iniciando Frontend React + TanStack + Vite (Porta 8080)...
start "TotalTrigo Frontend Web (8080)" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo Aguardando inicializacao dos servidores (6 segundos)...
timeout /t 6 >nul

start http://localhost:8080

echo.
echo ============================================================================
echo   Pronto! Sistema iniciado com sucesso.
echo   - Frontend: http://localhost:8080
echo   - Backend API: http://localhost:8085
echo   - Console H2: http://localhost:8085/h2-console
echo ============================================================================
echo.
