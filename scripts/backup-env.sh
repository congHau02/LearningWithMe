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
      if [[ "$query" =~ sslMode=(REQUIRED|VERIFY_CA|VERIFY_IDENTITY|PREFERRED|DISABLED) ]]; then
        MYSQL_SSL_MODE="${BASH_REMATCH[1]}"
      elif [[ "$query" =~ useSSL=true ]]; then
        MYSQL_SSL_MODE="REQUIRED"
      elif [[ "$query" =~ useSSL=false ]]; then
        MYSQL_SSL_MODE="DISABLED"
      elif [[ "$MYSQL_HOST" == *.tidbcloud.com ]]; then
        MYSQL_SSL_MODE="VERIFY_IDENTITY"
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
      local effective_mode="$MYSQL_SSL_MODE"
      local ca_file="${MYSQL_SSL_CA:-}"
      if [[ -z "$ca_file" && -f /etc/ssl/certs/ca-certificates.crt ]]; then
        ca_file="/etc/ssl/certs/ca-certificates.crt"
      fi
      if [[ ("$effective_mode" == "VERIFY_CA" || "$effective_mode" == "VERIFY_IDENTITY") ]]; then
        if [[ -n "$ca_file" ]]; then
          MYSQL_SSL_ARGS+=("--ssl-mode=${effective_mode}" "--ssl-ca=${ca_file}")
          return 0
        fi
        effective_mode="REQUIRED"
      fi
      MYSQL_SSL_ARGS+=("--ssl-mode=${effective_mode}")
    elif [[ "$MYSQL_SSL_MODE" != "DISABLED" && "$MYSQL_SSL_MODE" != "PREFERRED" ]] && "$bin" --help 2>/dev/null | grep -q -- '--ssl'; then
      MYSQL_SSL_ARGS+=(--ssl)
    elif [[ "$MYSQL_SSL_MODE" == "DISABLED" ]] && "$bin" --help 2>/dev/null | grep -q -- 'skip-ssl'; then
      MYSQL_SSL_ARGS+=(--skip-ssl)
    fi
  fi
}

build_redis_cli_args() {
  REDIS_ARGS=(-h "$REDIS_HOST" -p "$REDIS_PORT")
  if [[ "$REDIS_TLS" == "true" || "$REDIS_TLS" == "TRUE" || "$REDIS_TLS" == "1" ]]; then
    REDIS_ARGS+=(--tls)
  fi
  if [[ -n "$REDIS_PASSWORD" ]]; then
    if [[ -n "$REDIS_USERNAME" && "$REDIS_USERNAME" != "default" ]]; then
      REDIS_ARGS+=(--user "$REDIS_USERNAME")
    fi
    export REDISCLI_AUTH="$REDIS_PASSWORD"
  fi
}
