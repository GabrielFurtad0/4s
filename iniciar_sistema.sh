#!/bin/bash

# Script de inicializacao para macOS e Linux
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "============================================================================"
echo "  4S ERP - Forca de Vendas (Rua), Backoffice Pre-Nota e Gestao B2B"
echo "============================================================================"
echo ""

echo "[1/2] Iniciando Backend Spring Boot (Porta 8085 - Banco H2 Local)..."
(cd "$DIR/backend" && ./mvnw spring-boot:run) &
BACKEND_PID=$!

echo "[2/2] Iniciando Frontend React + TanStack + Vite (Porta 8080)..."
(cd "$DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

cleanup() {
    echo ""
    echo "Encerrando servidores 4S ERP..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo ""
echo "Aguardando inicializacao dos servidores (6 segundos)..."
sleep 6

if command -v open >/dev/null 2>&1; then
    open http://localhost:8080
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:8080
fi

echo ""
echo "============================================================================"
echo "  Pronto! Sistema iniciado com sucesso."
echo "  - Frontend: http://localhost:8080"
echo "  - Backend API: http://localhost:8085"
echo "  - Console H2: http://localhost:8085/h2-console"
echo "  Pressione Ctrl+C para encerrar ambos os servidores."
echo "============================================================================"
echo ""

wait
