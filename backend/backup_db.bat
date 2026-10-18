@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   TotalTrigo ERP - Rotina de Backup Automatico
echo ===================================================

:: Determinar diretorio base do backend
set "SCRIPT_DIR=%~dp0"
set "BACKUP_DIR=%SCRIPT_DIR%backups"
set "DATA_DIR=%SCRIPT_DIR%data"
set "H2_SOURCE=%DATA_DIR%\totaltrigo_db.mv.db"

:: Criar pasta de backups se nao existir
if not exist "%BACKUP_DIR%" (
    echo [+] Criando pasta de backups: %BACKUP_DIR%
    mkdir "%BACKUP_DIR%"
)

:: Gerar timestamp padrao YYYYMMDD_HHMMSS
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd_HHmmss'" 2^>nul`) do (
    set "TIMESTAMP=%%i"
)

if "%TIMESTAMP%"=="" (
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do (
        set "dt=%%I"
        set "TIMESTAMP=!dt:~0,8!_!dt:~8,6!"
    )
)

if "%TIMESTAMP%"=="" (
    set "TIMESTAMP=%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
    set "TIMESTAMP=%TIMESTAMP: =0%"
)

echo [i] Data/Hora do backup: %TIMESTAMP%

:: ----------------------------------------------------
:: 1. BACKUP DO BANCO H2 - Arquivo Local
:: ----------------------------------------------------
echo.
echo [1/2] Verificando banco de dados local H2...
if exist "%H2_SOURCE%" (
    set "H2_BACKUP_DEST=%BACKUP_DIR%\totaltrigo_h2_%TIMESTAMP%.mv.db"
    copy /y "%H2_SOURCE%" "!H2_BACKUP_DEST!" >nul 2>nul
    if !errorlevel! equ 0 (
        echo [OK] Backup H2 realizado com sucesso:
        echo      - Destino: !H2_BACKUP_DEST!
    ) else (
        echo [AVISO] Nao foi possivel copiar o arquivo H2 no momento.
        echo         O arquivo pode estar bloqueado pela aplicacao backend em execucao.
    )
) else (
    echo [AVISO] Arquivo H2 !H2_SOURCE! nao encontrado. Pulando backup H2.
)

:: ----------------------------------------------------
:: 2. BACKUP DO BANCO POSTGRESQL - pg_dump compactado
:: ----------------------------------------------------
echo.
echo [2/2] Verificando conexao PostgreSQL e utilitario pg_dump...

if "%PGHOST%"=="" set "PGHOST=localhost"
if "%PGPORT%"=="" set "PGPORT=5432"
if "%PGDATABASE%"=="" set "PGDATABASE=totaltrigo"
if "%PGUSER%"=="" set "PGUSER=postgres"
if "%PGPASSWORD%"=="" set "PGPASSWORD=postgres"

where pg_dump >nul 2>nul
if !errorlevel! equ 0 (
    set "PG_BACKUP_DEST=%BACKUP_DIR%\totaltrigo_pg_%TIMESTAMP%.dump"
    echo [i] Executando pg_dump compactado formato Custom -Fc...
    pg_dump -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -Fc -f "!PG_BACKUP_DEST!"
    if !errorlevel! equ 0 (
        echo [OK] Backup PostgreSQL gerado com sucesso:
        echo      - Destino: !PG_BACKUP_DEST!
    ) else (
        echo [AVISO] pg_dump falhou ao conectar em %PGHOST%:%PGPORT%/%PGDATABASE%.
    )
) else (
    echo [AVISO] Utilitario pg_dump nao encontrado no PATH do sistema.
    echo         Para backup PostgreSQL, instale as ferramentas cliente do PostgreSQL
    echo         ou configure a variavel PATH.
)

:: ----------------------------------------------------
:: 3. ROTACAO DE BACKUPS - Manter apenas os 30 mais recentes
:: ----------------------------------------------------
echo.
echo [*] Aplicando politica de retencao - ultimos 30 backups mantidos...

:: Rotacao H2
for /f "skip=30 delims=" %%F in ('dir "%BACKUP_DIR%\totaltrigo_h2_*.mv.db" /b /o-d /a-d 2^>nul') do (
    del "%BACKUP_DIR%\%%F"
    echo [-] Backup H2 antigo removido: %%F
)

:: Rotacao PostgreSQL
for /f "skip=30 delims=" %%F in ('dir "%BACKUP_DIR%\totaltrigo_pg_*.*" /b /o-d /a-d 2^>nul') do (
    del "%BACKUP_DIR%\%%F"
    echo [-] Backup PostgreSQL antigo removido: %%F
)

echo.
echo ===================================================
echo   Rotina de Backup Concluida!
echo ===================================================

endlocal
