#!/usr/bin/env bash
#
# Creates a compressed MySQL + Redis backup archive (.tar.gz) for Cùng Nhau Học Bài.
# Supports both Managed Cloud Free Tier (Aiven/TiDB MySQL + Redis Cloud) and local Docker.
#
# Usage:
#   ./scripts/create-backup.sh [output-archive.tar.gz]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/backup-env.sh
source "${SCRIPT_DIR}/backup-env.sh"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_ARCHIVE="${1:-${BACKUP_OUTPUT_PATH:-backups/backup-${TIMESTAMP}.tar.gz}}"

resolve_backup_connection_env

if [[ "${BACKUP_DRY_RUN:-false}" == "true" ]]; then
  printf 'MYSQL_HOST=%s MYSQL_PORT=%s MYSQL_DATABASE=%s MYSQL_USER=%s MYSQL_SSL_MODE=%s\n' \
    "$MYSQL_HOST" "$MYSQL_PORT" "$MYSQL_DATABASE" "$MYSQL_USER" "$MYSQL_SSL_MODE"
  printf 'REDIS_HOST=%s REDIS_PORT=%s REDIS_USERNAME=%s REDIS_TLS=%s OUTPUT=%s\n' \
    "$REDIS_HOST" "$REDIS_PORT" "$REDIS_USERNAME" "$REDIS_TLS" "$OUTPUT_ARCHIVE"
  exit 0
fi

STAGE_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$STAGE_DIR"
  unset REDISCLI_AUTH || true
}
trap cleanup EXIT

# 1. Dump MySQL schema and data
MYSQLDUMP_ARGS=(
  -h "$MYSQL_HOST"
  -P "$MYSQL_PORT"
  -u "$MYSQL_USER"
  --single-transaction
  --routines
  --triggers
  --no-tablespaces
)
if mysqldump --help 2>/dev/null | grep -q 'set-gtid-purged'; then
  MYSQLDUMP_ARGS+=(--set-gtid-purged=OFF)
fi
append_mysql_ssl_args mysqldump
MYSQLDUMP_ARGS+=("${MYSQL_SSL_ARGS[@]}")

echo "▸ Exporting MySQL database '${MYSQL_DATABASE}' from ${MYSQL_HOST}:${MYSQL_PORT}..."
MYSQL_PWD="$MYSQL_PASSWORD" mysqldump "${MYSQLDUMP_ARGS[@]}" "$MYSQL_DATABASE" > "${STAGE_DIR}/mysql.sql"

# 2. Export Redis keys + TTLs via binary-safe hex DUMP (works on Redis Cloud Free & Docker Redis)
build_redis_cli_args

LUA_EXPORT_SCRIPT="
local keys = redis.call('KEYS', '*')
table.sort(keys)
local lines = {}
for _, k in ipairs(keys) do
  local pttl = redis.call('PTTL', k)
  if pttl < 0 then pttl = 0 end
  local raw = redis.call('DUMP', k)
  local hex = {}
  for i = 1, #raw do
    hex[i] = string.format('%02x', string.byte(raw, i))
  end
  table.insert(lines, k .. '\t' .. tostring(pttl) .. '\t' .. table.concat(hex))
end
return table.concat(lines, '\n')
"

echo "▸ Exporting Redis snapshot from ${REDIS_HOST}:${REDIS_PORT}..."
redis-cli "${REDIS_ARGS[@]}" --raw EVAL "$LUA_EXPORT_SCRIPT" 0 > "${STAGE_DIR}/redis-dump.tsv"
sed -i '/^$/d' "${STAGE_DIR}/redis-dump.tsv" 2>/dev/null || true

# Best-effort RDB snapshot when server allows SYNC (e.g. local/VPS Redis)
redis-cli "${REDIS_ARGS[@]}" --rdb "${STAGE_DIR}/redis.rdb" >/dev/null 2>&1 || rm -f "${STAGE_DIR}/redis.rdb"

REDIS_KEY_COUNT="$(wc -l < "${STAGE_DIR}/redis-dump.tsv" | tr -d ' ')"
cat > "${STAGE_DIR}/metadata.json" <<EOF
{
  "createdAtUtc": "${TIMESTAMP}",
  "mysqlDatabase": "${MYSQL_DATABASE}",
  "redisKeyCount": ${REDIS_KEY_COUNT}
}
EOF

mkdir -p "$(dirname "$OUTPUT_ARCHIVE")"
tar -C "$STAGE_DIR" -czf "$OUTPUT_ARCHIVE" .
echo "✓ Backup archive created: ${OUTPUT_ARCHIVE} (${REDIS_KEY_COUNT} Redis key(s))"
