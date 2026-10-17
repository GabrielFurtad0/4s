@echo off
chcp 65001 > nul
set PYTHONIOENCODING=utf-8
echo ========================================================
echo    Iniciando Atualizacao Automatica de Estoque...
echo ========================================================
echo.
cd /d "%~dp0"
if exist "..\.venv\Scripts\python.exe" (
    "..\.venv\Scripts\python.exe" atualizar_estoque.py
) else if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" atualizar_estoque.py
) else (
    python atualizar_estoque.py
)
echo.
pause
