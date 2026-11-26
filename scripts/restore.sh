#!/bin/bash
# Restores the database from a backup made by backup.sh. Run on the host, from the project folder:
#   scripts/restore.sh backups/srm-20260101-030000.sql.gz
# The current data is replaced. Make a fresh backup first if you may need it.
set -euo pipefail

cd "$(dirname "$0")/.."
file="${1:-}"
[ -f "$file" ] || { echo "Usage: $0 <backup .sql.gz>" >&2; ls -1 backups 2>/dev/null | tail -5 >&2; exit 1; }

set -a; . ./.env; set +a
read -r -p "Replace the current database with $file? [y/N] " answer
[ "$answer" = "y" ] || { echo "Cancelled"; exit 1; }

docker compose stop backend
gunzip -c "$file" | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose start backend
echo "Restored from $file"
