#!/usr/bin/env bash
set -euo pipefail

umask 077

APP_DIR="/home/debian/apps/pasta-house"
ENV_FILE="$APP_DIR/server/.env"
BACKUP_DIR="/var/backups/pasta-house/postgres"
RETENTION_DAYS="14"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "ERROR: Cannot read env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

if [[ "$DB_NAME" != "pasta_house" ]]; then
  echo "ERROR: Refusing to backup unexpected database: $DB_NAME" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
FINAL_FILE="$BACKUP_DIR/pasta_house-$TIMESTAMP.dump"
TMP_FILE="$FINAL_FILE.tmp"

export PGPASSWORD="$DB_PASSWORD"

pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$TMP_FILE"

unset PGPASSWORD

mv "$TMP_FILE" "$FINAL_FILE"

find "$BACKUP_DIR" \
  -type f \
  -name "pasta_house-*.dump" \
  -mtime +"$RETENTION_DAYS" \
  -delete

BYTES="$(stat -c%s "$FINAL_FILE")"

if [[ "$BYTES" -le 0 ]]; then
  echo "ERROR: Backup file is empty: $FINAL_FILE" >&2
  exit 1
fi

echo "Backup created: $FINAL_FILE"
echo "Backup size bytes: $BYTES"
