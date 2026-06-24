#!/bin/bash
# =============================================================
# KAI-OS Database Backup Script
# Creates timestamped backups of the Supabase/Postgres database.
#
# Usage:
#   export SUPABASE_DB_URL="postgresql://...:...@...:6543/postgres"
#   ./scripts/backup-db.sh
#
# For Supabase:
#   1. Go to Project Settings → Database → Connection string (URI)
#   2. Use the "Session pooler" URI with your password
#   3. Set it as SUPABASE_DB_URL env var
#
# Scheduled backup (crontab -e):
#   0 3 * * * cd /path/to/kai-os && ./scripts/backup-db.sh
# =============================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_URL="${SUPABASE_DB_URL:-}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set."
  echo "Usage: export SUPABASE_DB_URL='postgresql://...' && ./scripts/backup-db.sh"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="${BACKUP_DIR}/kai-os-backup-${TIMESTAMP}.sql.gz"

echo "Starting KAI-OS database backup..."
echo "  Backup dir:  $BACKUP_DIR"
echo "  Output file: $BACKUP_FILE"

pg_dump "$DB_URL" \
  --no-owner \
  --no-acl \
  --verbose \
  | gzip > "$BACKUP_FILE"

echo ""
echo "Backup complete!"
echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo "  File: $BACKUP_FILE"

# Keep only last 30 backups
find "$BACKUP_DIR" -name "kai-os-backup-*.sql.gz" -mtime +30 -delete
echo "Cleaned up backups older than 30 days."
