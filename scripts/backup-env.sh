#!/usr/bin/env bash
#
# Shared MySQL (JDBC / env) and Redis connection resolver for create-backup.sh and restore-backup.sh.

resolve_backup_connection_env() {
  if [[ -n "${SPRING_DATASOURCE_URL:-}" ]]; then
    local stripped="${SPRING_DATASOURCE_URL#jdbc:mysql://}"
    local hostport="${stripped%%/*}"
    local rest="${stripped#*/}"
    local db="${rest%%\?*}"
    local query="${rest#*\?}"

    if [[ "$hostport" == *:* ]]; then
      MYSQL_HOST="${MYSQL_HOST:-${hostport%%:*}}"
      MYSQL_PORT="${MYSQL_PORT:-${hostport##*:}}"
    else
      MYSQL_HOST="${MYSQL_HOST:-$hostport}"
    fi
    MYSQL_DATABASE="${MYSQL_DATABASE:-$db}"

    if [[ -z "${MYSQL_SSL_MODE:-}" ]]; then
      if [[ "$query" =~ (sslMode=REQUIRED|useSSL=true) ]]; then
        MYSQL_SSL_MODE="REQUIRED"
      elif [[ "$query" =~ (sslMode=DISABLED|useSSL=false) ]]; then
        MYSQL_SSL_MODE="DISABLED"
      fi
    fi
  fi

  MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
  MYSQL_PORT="${MYSQL_PORT:-3306}"
  MYSQL_DATABASE="${MYSQL_DATABASE:-studytogether}"
  MYSQL_USER="${MYSQL_USER:-${SPRING_DATASOURCE_USERNAME:-studyuser}}"
  MYSQL_PASSWORD="${MYSQL_PASSWORD:-${SPRING_DATASOURCE_PASSWORD:-}}"
  MYSQL_SSL_MODE="${MYSQL_SSL_MODE:-}"

  REDIS_HOST="${REDIS_HOST:-${SPRING_DATA_REDIS_HOST:-127.0.0.1}}"
  REDIS_PORT="${REDIS_PORT:-${SPRING_DATA_REDIS_PORT:-6379}}"
  REDIS_USERNAME="${REDIS_USERNAME:-${SPRING_DATA_REDIS_USERNAME:-default}}"
  REDIS_PASSWORD="${REDIS_PASSWORD:-${SPRING_DATA_REDIS_PASSWORD:-}}"
  REDIS_TLS="${REDIS_TLS:-${SPRING_DATA_REDIS_SSL_ENABLED:-false}}"
}

append_mysql_ssl_args() {
  local bin="$1"
  MYSQL_SSL_ARGS=()
  if [[ -n "$MYSQL_SSL_MODE" ]]; then
    if "$bin" --help 2>/dev/null | grep -q 'ssl-mode'; then
      MYSQL_SSL_ARGS+=("--ssl-mode=${MYSQL_SSL_MODE}")
    elif [[ "$MYSQL_SSL_MODE" == "REQUIRED" ]] && "$bin" --help 2>/dev/null | grep -q -- '--ssl'; then
      MYSQL_SSL_ARGS+=(--ssl)
    elif [[ "$MYSQL_SSL_MODE" == "DISABLED" ]] && "$bin" --help 2>/dev/null | grep -q -- 'skip-ssl'; then
      MYSQL_SSL_ARGS+=(--skip-ssl)
    fi
  fi
}

build_redis_cli_args() {
  REDIS_ARGS=(-h "$REDIS_HOST" -p "$REDIS_PORT")
  if [[ "$REDIS_TLS" == "true" ]]; then
    REDIS_ARGS+=(--tls)
  fi
  if [[ -n "$REDIS_PASSWORD" ]]; then
    if [[ -n "$REDIS_USERNAME" && "$REDIS_USERNAME" != "default" ]]; then
      REDIS_ARGS+=(--user "$REDIS_USERNAME")
    fi
    export REDISCLI_AUTH="$REDIS_PASSWORD"
  fi
}
