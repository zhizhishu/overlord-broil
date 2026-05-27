#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

export DB_NAME="${DB_NAME:-overlord_port_contract}"
export DB_USER="${DB_USER:-overlord_port_contract}"
export DB_PASSWORD="${DB_PASSWORD:-port-contract-password}"
export JWT_SECRET="${JWT_SECRET:-port-contract-jwt-secret}"
export SECRET_ENCRYPTION_KEY="${SECRET_ENCRYPTION_KEY:-port-contract-secret-key}"
export FRONTEND_PORT="${FRONTEND_PORT:-18080}"
export BACKEND_PORT="${BACKEND_PORT:-16365}"
export EXPOSE_BACKEND="${EXPOSE_BACKEND:-0}"
export PHPMYADMIN_PORT="${PHPMYADMIN_PORT:-}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required for master port contract tests." >&2
    exit 2
  fi
}

compose_config() {
  docker compose -f "${PROJECT_ROOT}/$1" config
}

assert_single_public_entry() {
  local file="$1"
  local config
  local published_count

  config="$(compose_config "$file")"
  published_count="$(printf '%s\n' "$config" | grep -c 'published:' || true)"

  if [ "$published_count" -ne 1 ]; then
    echo "${file} must publish exactly one default host port, found ${published_count}." >&2
    printf '%s\n' "$config" >&2
    exit 1
  fi

  printf '%s\n' "$config" | grep -q 'target: 5166' || {
    echo "${file} must publish overlord-master target port 5166." >&2
    exit 1
  }

  printf '%s\n' "$config" | grep -q "published: \"${FRONTEND_PORT}\"" || {
    echo "${file} must publish only FRONTEND_PORT=${FRONTEND_PORT}." >&2
    exit 1
  }

  if printf '%s\n' "$config" | grep -Eq '^  (backend|frontend|phpmyadmin):$'; then
    echo "${file} default stack must not include legacy backend/frontend/phpMyAdmin services." >&2
    exit 1
  fi

  echo "${file}: single public entry contract passed"
}

assert_direct_compose_default_port() {
  local file="$1"
  local config

  config="$(FRONTEND_PORT= BACKEND_PORT= compose_config "$file")"
  printf '%s\n' "$config" | grep -q 'published: "5166"' || {
    echo "${file} must default to publishing 5166 when FRONTEND_PORT is not set." >&2
    printf '%s\n' "$config" >&2
    exit 1
  }

  echo "${file}: direct compose default port passed"
}

assert_installer_migration_guard() {
  local installer="${PROJECT_ROOT}/scripts/install-master.sh"

  grep -q 'remove_legacy_split_containers' "$installer" || {
    echo "install-master.sh must remove legacy split-panel containers during install/upgrade." >&2
    exit 1
  }

  for legacy_container in vite-frontend springboot-backend gost-phpmyadmin; do
    grep -q "$legacy_container" "$installer" || {
      echo "install-master.sh must include legacy container ${legacy_container} in the migration cleanup guard." >&2
      exit 1
    }
  done

  grep -q 'docker container inspect gost-mysql' "$installer" || {
    echo "install-master.sh must remove the obsolete gost-mysql container when migrating to SQLite mode." >&2
    exit 1
  }

  grep -q 'Kept legacy MySQL Docker volumes' "$installer" || {
    echo "install-master.sh must document that SQLite migration removes only the old MySQL container, not its volumes." >&2
    exit 1
  }

  grep -q 'Migrated legacy FRONTEND_PORT=80' "$installer" || {
    echo "install-master.sh must keep the FRONTEND_PORT=80 migration guard." >&2
    exit 1
  }

  grep -q 'Disabled public phpMyAdmin exposure' "$installer" || {
    echo "install-master.sh must disable public phpMyAdmin exposure by default." >&2
    exit 1
  }

  grep -q 'OB_SQLITE_DATA_DIR' "$installer" || {
    echo "install-master.sh usage must document OB_SQLITE_DATA_DIR." >&2
    exit 1
  }

  grep -q 'sqlite-data' "$installer" || {
    echo "install-master.sh must back up SQLite data separately from compose/env files." >&2
    exit 1
  }

  if grep -q 'for key in DB_MODE JWT_SECRET' "$installer"; then
    echo "install-master.sh restore validation must accept legacy MySQL .env files without DB_MODE." >&2
    exit 1
  fi

  grep -q 'compose_cmd up -d master || true' "$installer" || {
    echo "install-master.sh must restart a stopped SQLite master if file backup fails." >&2
    exit 1
  }

  echo "install-master.sh: migration guards passed"
}

require_command docker

assert_single_public_entry docker-compose.yml
assert_single_public_entry docker-compose-v4.yml
assert_single_public_entry docker-compose-v6.yml
assert_single_public_entry docker-compose.sqlite.yml
assert_direct_compose_default_port docker-compose.yml
assert_direct_compose_default_port docker-compose-v4.yml
assert_direct_compose_default_port docker-compose-v6.yml
assert_direct_compose_default_port docker-compose.sqlite.yml
assert_installer_migration_guard

echo "master port contract tests passed"
