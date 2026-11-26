#!/bin/bash
# Dumps the database to BACKUP_DIR as a gzip-compressed SQL file and deletes dumps older than
# BACKUP_KEEP_DAYS. Uses the standard PG* variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
#   backup.sh        one backup, then exit
#   backup.sh loop   a backup every BACKUP_INTERVAL_HOURS (used by the "backup" compose service)
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"

backup_once() {
  umask 077  # dumps contain all data
  mkdir -p "$BACKUP_DIR"
  local name="srm-$(date +%Y%m%d-%H%M%S).sql.gz"
  # Write to a temporary name first so a failed dump never looks like a valid backup.
  if pg_dump --clean --if-exists --no-owner | gzip > "$BACKUP_DIR/$name.tmp"; then
    mv "$BACKUP_DIR/$name.tmp" "$BACKUP_DIR/$name"
    echo "$(date -Is) backup written: $name"
  else
    rm -f "$BACKUP_DIR/$name.tmp"
    echo "$(date -Is) BACKUP FAILED" >&2
    return 1
  fi
  find "$BACKUP_DIR" -maxdepth 1 -name 'srm-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/pruned: /'
}

if [ "${1:-}" = "loop" ]; then
  while true; do
    backup_once || true  # keep trying at the next interval
    sleep "$((INTERVAL_HOURS * 3600))"
  done
else
  backup_once
fi
