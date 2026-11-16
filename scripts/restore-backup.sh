#!/usr/bin/env bash
#
# Restores a compressed MySQL + Redis backup archive (.tar.gz) created by scripts/create-backup.sh.
#
# Usage:
#   ./scripts/restore-backup.sh <backup-archive.tar.gz> [--flush-redis]

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-archive.tar.gz> [--flush-redis]" >&2
  exit 1
fi

ARCHIVE_PATH="$1"
FLUSH_REDIS="${2:-}"

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Error: Backup archive not found at '$ARCHIVE_PATH'" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup-env.sh
source "${SCRIPT_DIR}/backup-env.sh"

resolve_backup_connection_env

STAGE_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$STAGE_DIR"
  unset REDISCLI_AUTH || true
}
trap cleanup EXIT

tar -xzf "$ARCHIVE_PATH" -C "$STAGE_DIR"

if [[ ! -f "${STAGE_DIR}/mysql.sql" ]] || [[ ! -f "${STAGE_DIR}/redis-dump.tsv" ]]; then
  echo "Error: Archive '$ARCHIVE_PATH' is missing mysql.sql or redis-dump.tsv" >&2
  exit 1
fi

# 1. Restore MySQL dump
append_mysql_ssl_args mysql
MYSQL_ARGS=(-h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "${MYSQL_SSL_ARGS[@]}")

echo "▸ Restoring MySQL database '${MYSQL_DATABASE}' on ${MYSQL_HOST}:${MYSQL_PORT}..."
MYSQL_PWD="$MYSQL_PASSWORD" mysql "${MYSQL_ARGS[@]}" "$MYSQL_DATABASE" < "${STAGE_DIR}/mysql.sql"

# 2. Restore Redis keys + TTLs
build_redis_cli_args

if [[ "$FLUSH_REDIS" == "--flush-redis" ]]; then
  echo "▸ Flushing target Redis database before restore..."
  redis-cli "${REDIS_ARGS[@]}" FLUSHDB >/dev/null
fi

LUA_RESTORE_SCRIPT="
local raw = string.gsub(ARGV[2], '..', function(cc) return string.char(tonumber(cc, 16)) end)
return redis.call('RESTORE', KEYS[1], tonumber(ARGV[1]), raw, 'REPLACE')
"

echo "▸ Restoring Redis keys to ${REDIS_HOST}:${REDIS_PORT}..."
RESTORED_KEYS=0
while IFS=$'\t' read -r KEY PTTL HEX_DUMP || [[ -n "${KEY:-}" ]]; do
  [[ -z "$KEY" || -z "${HEX_DUMP:-}" ]] && continue
  HEX_DUMP="${HEX_DUMP%$'\r'}"
  redis-cli "${REDIS_ARGS[@]}" EVAL "$LUA_RESTORE_SCRIPT" 1 "$KEY" "$PTTL" "$HEX_DUMP" >/dev/null
  RESTORED_KEYS=$((RESTORED_KEYS + 1))
done < "${STAGE_DIR}/redis-dump.tsv"

echo "✓ Restore complete: MySQL '${MYSQL_DATABASE}' and ${RESTORED_KEYS} Redis key(s) restored."
