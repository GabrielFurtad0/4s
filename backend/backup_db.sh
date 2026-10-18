#!/usr/bin/env bash
# =====================================================
#   TotalTrigo ERP - Rotina de Backup Automatico (Linux/GCP)
# =====================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/backups}"
DATA_DIR="${DATA_DIR:-${SCRIPT_DIR}/data}"
H2_SOURCE="${DATA_DIR}/totaltrigo_db.mv.db"

# Criar pasta de backup se nao existir
mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
echo "==================================================="
echo "  TotalTrigo ERP - Backup Automatico"
echo "  Timestamp: ${TIMESTAMP}"
echo "==================================================="

# -----------------------------------------------------
# 1. BACKUP DO BANCO H2 (Arquivo Local)
# -----------------------------------------------------
echo ""
echo "[1/2] Verificando banco de dados local H2..."
if [ -f "${H2_SOURCE}" ]; then
    H2_BACKUP_DEST="${BACKUP_DIR}/totaltrigo_h2_${TIMESTAMP}.mv.db"
    cp "${H2_SOURCE}" "${H2_BACKUP_DEST}"
    echo "[OK] Backup H2 realizado com sucesso: ${H2_BACKUP_DEST}"
else
    echo "[AVISO] Arquivo H2 (${H2_SOURCE}) nao encontrado. Pulando backup H2."
fi

# -----------------------------------------------------
# 2. BACKUP DO BANCO POSTGRESQL (pg_dump compactado)
# -----------------------------------------------------
echo ""
echo "[2/2] Verificando utilitario pg_dump e conexao PostgreSQL..."

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-totaltrigo}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
export PGPASSWORD

if command -v pg_dump >/dev/null 2>&1; then
    PG_BACKUP_DEST="${BACKUP_DIR}/totaltrigo_pg_${TIMESTAMP}.dump"
    echo "[i] Executando pg_dump compactado (-Fc formato custom zlib)..."
    if pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -Fc -f "${PG_BACKUP_DEST}"; then
        echo "[OK] Backup PostgreSQL gerado com sucesso: ${PG_BACKUP_DEST}"
    else
        echo "[AVISO] pg_dump falhou ao conectar em ${PGHOST}:${PGPORT}/${PGDATABASE}."
    fi
else
    echo "[AVISO] pg_dump nao encontrado no PATH. Pulando backup PostgreSQL."
fi

# -----------------------------------------------------
# 3. ROTACAO DE BACKUPS (Manter ultimos 30 backups)
# -----------------------------------------------------
echo ""
echo "[*] Aplicando politica de retencao (ultimos 30 backups mantidos)..."

# Rotacao backups H2
ls -1t "${BACKUP_DIR}"/totaltrigo_h2_*.mv.db 2>/dev/null | tail -n +31 | while IFS= read -r file; do
    if [ -f "$file" ]; then
        echo "[-] Removendo backup H2 antigo: $file"
        rm -f "$file"
    fi
done

# Rotacao backups PostgreSQL
ls -1t "${BACKUP_DIR}"/totaltrigo_pg_* 2>/dev/null | tail -n +31 | while IFS= read -r file; do
    if [ -f "$file" ]; then
        echo "[-] Removendo backup PostgreSQL antigo: $file"
        rm -f "$file"
    fi
done

echo ""
echo "==================================================="
echo "  Rotina de Backup Concluida!"
echo "==================================================="
