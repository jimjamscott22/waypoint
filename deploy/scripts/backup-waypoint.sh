#!/usr/bin/env bash
set -euo pipefail

: "${DB_BACKUP_USER:?DB_BACKUP_USER is required}"
: "${DB_BACKUP_PASSWORD:?DB_BACKUP_PASSWORD is required}"

DB_NAME="${DB_NAME:-waypoint}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/waypoint}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql.gz"
TEMP="${TARGET}.tmp"

if [[ "$BACKUP_DIR" != /* || "$BACKUP_DIR" == "/" ]]; then
  echo "BACKUP_DIR must be a non-root absolute path" >&2
  exit 1
fi
trap 'rm -f "$TEMP"' EXIT

install -d -m 0700 "$BACKUP_DIR"
export MYSQL_PWD="$DB_BACKUP_PASSWORD"
DUMP_CONNECTION=(--user="$DB_BACKUP_USER")
if [[ -n "${DB_HOST:-}" ]]; then
  if [[ -n "${DB_SOCKET:-}" ]]; then
    echo "Configure DB_SOCKET or DB_HOST, not both" >&2
    exit 1
  fi
  DUMP_CONNECTION+=(--protocol=tcp --host="$DB_HOST" --port="${DB_PORT:-3306}")
else
  DUMP_CONNECTION+=(--protocol=socket --socket="${DB_SOCKET:-/run/mysqld/mysqld.sock}")
fi

mariadb-dump "${DUMP_CONNECTION[@]}" --single-transaction --quick \
  --skip-lock-tables --no-tablespaces "$DB_NAME" | gzip -9 > "$TEMP"
mv "$TEMP" "$TARGET"
sha256sum "$TARGET" > "${TARGET}.sha256"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "${DB_NAME}-*.sql.gz" -o -name "${DB_NAME}-*.sql.gz.sha256" \) -mtime "+$RETENTION_DAYS" -delete
unset MYSQL_PWD
echo "Created $TARGET"
