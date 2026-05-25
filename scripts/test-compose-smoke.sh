#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${FLUX_COMPOSE_FILE:-docker-compose-v4.yml}"
BACKEND_PORT="${BACKEND_PORT:-16365}"
FRONTEND_PORT="${FRONTEND_PORT:-18080}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:6365/flow/test}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:${FRONTEND_PORT}/}"
DB_NAME="${DB_NAME:-gost_smoke}"
DB_USER="${DB_USER:-gost_smoke}"
DB_PASSWORD="${DB_PASSWORD:-test-password}"
JWT_SECRET="${JWT_SECRET:-test-jwt-secret}"
TIMEOUT_SECONDS="${FLUX_COMPOSE_SMOKE_TIMEOUT_SECONDS:-240}"
POLL_SECONDS="${FLUX_COMPOSE_SMOKE_POLL_SECONDS:-5}"
ALLOW_EXISTING="${FLUX_COMPOSE_SMOKE_ALLOW_EXISTING:-false}"
BUILD_LOCAL="${FLUX_COMPOSE_SMOKE_BUILD_LOCAL:-false}"
DRY_RUN="false"

usage() {
  cat <<'EOF'
Usage: scripts/test-compose-smoke.sh [--compose-file FILE] [--backend-port PORT] [--frontend-port PORT] [--timeout SECONDS] [--build-local] [--dry-run]

Starts the compose smoke stack with test environment values, checks:
  - backend:  GET /flow/test from inside the backend container
  - frontend: GET /

The script always runs docker compose down --volumes --remove-orphans before exit
after a stack start attempt.

Because the compose files use fixed container, volume, and network names, the
script fails before startup if those resources already exist. Set
FLUX_COMPOSE_SMOKE_ALLOW_EXISTING=true to override this guard in disposable
environments.

Use --build-local to build backend/frontend images from the current checkout
before startup. This avoids depending on GHCR pull permissions and makes CI
smoke tests validate the current commit.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --compose-file)
      COMPOSE_FILE="${2:?missing value for --compose-file}"
      shift 2
      ;;
    --backend-port)
      BACKEND_PORT="${2:?missing value for --backend-port}"
      BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}/flow/test"
      shift 2
      ;;
    --frontend-port)
      FRONTEND_PORT="${2:?missing value for --frontend-port}"
      FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}/"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:?missing value for --timeout}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --build-local)
      BUILD_LOCAL="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

COMPOSE_PATH="${PROJECT_ROOT}/${COMPOSE_FILE}"
if [ ! -f "$COMPOSE_PATH" ]; then
  echo "Compose file not found: ${COMPOSE_PATH}" >&2
  exit 2
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required for compose smoke tests." >&2
    exit 2
  fi
}

compose() {
  docker compose -f "$COMPOSE_PATH" "$@"
}

check_http() {
  local label="$1"
  local url="$2"
  local status

  status="$(curl --silent --show-error --location --output /dev/null --write-out '%{http_code}' "$url" || true)"
  case "$status" in
    2*|3*)
      echo "${label} healthy: ${url} (${status})"
      return 0
      ;;
    *)
      echo "${label} not ready: ${url} (${status})"
      return 1
      ;;
  esac
}

check_container_http() {
  local label="$1"
  local container="$2"
  local url="$3"

  if docker exec "$container" sh -c "wget --no-verbose --tries=1 --spider '$url'" >/dev/null 2>&1; then
    echo "${label} healthy inside ${container}: ${url}"
    return 0
  fi

  echo "${label} not ready inside ${container}: ${url}"
  return 1
}

wait_for_http() {
  local label="$1"
  local url="$2"
  local deadline
  deadline=$((SECONDS + TIMEOUT_SECONDS))

  while [ "$SECONDS" -lt "$deadline" ]; do
    if check_http "$label" "$url"; then
      return 0
    fi
    sleep "$POLL_SECONDS"
  done

  echo "${label} did not become healthy within ${TIMEOUT_SECONDS}s." >&2
  return 1
}

wait_for_container_http() {
  local label="$1"
  local container="$2"
  local url="$3"
  local deadline
  deadline=$((SECONDS + TIMEOUT_SECONDS))

  while [ "$SECONDS" -lt "$deadline" ]; do
    if check_container_http "$label" "$container" "$url"; then
      return 0
    fi
    sleep "$POLL_SECONDS"
  done

  echo "${label} did not become healthy within ${TIMEOUT_SECONDS}s." >&2
  return 1
}

assert_no_existing_resource() {
  local kind="$1"
  local name="$2"

  if [ "$ALLOW_EXISTING" = "true" ]; then
    return 0
  fi

  case "$kind" in
    container)
      if docker container inspect "$name" >/dev/null 2>&1; then
        echo "Refusing to run: existing container '${name}' would be affected by cleanup." >&2
        exit 1
      fi
      ;;
    volume)
      if docker volume inspect "$name" >/dev/null 2>&1; then
        echo "Refusing to run: existing volume '${name}' would be affected by cleanup." >&2
        exit 1
      fi
      ;;
    network)
      if docker network inspect "$name" >/dev/null 2>&1; then
        echo "Refusing to run: existing network '${name}' would be affected by cleanup." >&2
        exit 1
      fi
      ;;
  esac
}

assert_clean_compose_resources() {
  assert_no_existing_resource container gost-mysql
  assert_no_existing_resource container gost-phpmyadmin
  assert_no_existing_resource container springboot-backend
  assert_no_existing_resource container vite-frontend
  assert_no_existing_resource volume mysql_data
  assert_no_existing_resource volume backend_logs
  assert_no_existing_resource network gost-network
}

build_local_images() {
  echo "Building local compose smoke images..."
  docker build -t ghcr.io/zhizhishu/flux-3xui-orchestrator-backend:latest "${PROJECT_ROOT}/springboot-backend"
  docker build -t ghcr.io/zhizhishu/flux-3xui-orchestrator-frontend:latest "${PROJECT_ROOT}/vite-frontend"
}

cleanup() {
  local exit_code=$?
  if [ "$DRY_RUN" = "true" ]; then
    return "$exit_code"
  fi

  echo "Cleaning up compose smoke stack..."
  compose down --volumes --remove-orphans
  return "$exit_code"
}

require_command docker
require_command curl

export DB_NAME DB_USER DB_PASSWORD JWT_SECRET BACKEND_PORT FRONTEND_PORT
export EXPOSE_BACKEND="${EXPOSE_BACKEND:-0}"

echo "Compose file: ${COMPOSE_FILE}"
echo "Backend internal URL: ${BACKEND_URL}"
echo "Frontend URL: ${FRONTEND_URL}"

compose config --quiet

if [ "$DRY_RUN" = "true" ]; then
  if [ "$BUILD_LOCAL" = "true" ]; then
    echo "Dry run passed. Would build local backend/frontend images, then run: docker compose -f ${COMPOSE_PATH} up -d mysql backend frontend"
  else
    echo "Dry run passed. Would run: docker compose -f ${COMPOSE_PATH} up -d mysql backend frontend"
  fi
  exit 0
fi

assert_clean_compose_resources
trap cleanup EXIT

if [ "$BUILD_LOCAL" = "true" ]; then
  build_local_images
fi

compose up -d mysql backend frontend
wait_for_container_http "backend" springboot-backend "$BACKEND_URL"
wait_for_http "frontend" "$FRONTEND_URL"

echo "compose smoke test passed"
