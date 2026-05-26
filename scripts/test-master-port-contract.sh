#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

export DB_NAME="${DB_NAME:-gost_port_contract}"
export DB_USER="${DB_USER:-gost_port_contract}"
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
    echo "${file} must publish flux-master target port 5166." >&2
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

assert_installer_migration_guard() {
  local installer="${PROJECT_ROOT}/scripts/install-master.sh"

  grep -q 'remove_legacy_split_containers' "$installer" || {
    echo "install-master.sh must remove legacy split-panel containers during install/upgrade." >&2
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

  echo "install-master.sh: migration guards passed"
}

require_command docker

assert_single_public_entry docker-compose.yml
assert_single_public_entry docker-compose-v4.yml
assert_single_public_entry docker-compose-v6.yml
assert_installer_migration_guard

echo "master port contract tests passed"
