@echo off
chcp 65001 >nul
echo ============================================================================
echo   TOTAL TRIGO ERP - Forca de Vendas (Rua), Backoffice Pre-Nota NF-e e Importacao
echo ============================================================================
echo.
echo [1/2] Iniciando Backend Spring Boot (Porta 8085 - Banco H2 Local + Flyway)...
start "TotalTrigo Backend API (8085)" cmd /k "cd /d "%~dp0backend" && "C:\Users\PC-Gabriel\.m2\wrapper\dists\apache-maven-3.9.14-bin\1cb7fhup6b5n3bed6kckbrnspv\apache-maven-3.9.14\bin\mvn.cmd" spring-boot:run"

echo [2/2] Iniciando Frontend React + Vite + Tailwind (Porta 5173)...
start "TotalTrigo Frontend Web (5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Aguardando servidores subirem...
timeout /t 5 >nul
start http://localhost:5173
echo Pronto! Acesse http://localhost:5173 no navegador.
