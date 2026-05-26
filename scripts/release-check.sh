#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FULL="false"

usage() {
  cat <<'EOF'
Usage: scripts/release-check.sh [--full]

Runs the release gate for Flux 3x-ui Orchestrator.

Default checks:
  - shell syntax
  - agent mock test
  - tokenized 3x-ui fixture test
  - optional real 3x-ui E2E contract when THREE_XUI_E2E_URL/TOKEN are set
  - default/legacy compose config validation
  - frontend install and production build in Docker Node 22
  - git whitespace check

With --full:
  - Docker Maven backend package build
  - installer diagnostics in Debian, Ubuntu, Alpine, Rocky Linux and Oracle Linux containers
  - disposable compose smoke test built from the current checkout
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --full)
      FULL="true"
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

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required for release checks." >&2
    exit 2
  fi
}

step() {
  echo
  echo "==> $*"
}

require_command bash
require_command git
require_command docker

cd "$PROJECT_ROOT"

TEMP_DOCKER_CONFIG=""
cleanup_release_check() {
  if [ -n "$TEMP_DOCKER_CONFIG" ] && [ -d "$TEMP_DOCKER_CONFIG" ]; then
    rm -rf "$TEMP_DOCKER_CONFIG"
  fi
}
trap cleanup_release_check EXIT

if [ -z "${DOCKER_CONFIG:-}" ] && [ "${FLUX_RELEASE_CHECK_ISOLATE_DOCKER_CONFIG:-true}" = "true" ]; then
  TEMP_DOCKER_CONFIG="$(mktemp -d)"
  export DOCKER_CONFIG="$TEMP_DOCKER_CONFIG"
fi

export DB_NAME="${DB_NAME:-gost_release_check}"
export DB_USER="${DB_USER:-gost_release_check}"
export DB_PASSWORD="${DB_PASSWORD:-release-check-password}"
export JWT_SECRET="${JWT_SECRET:-release-check-jwt-secret}"
export SECRET_ENCRYPTION_KEY="${SECRET_ENCRYPTION_KEY:-release-check-secret-encryption-key}"
export FRONTEND_PORT="${FRONTEND_PORT:-18080}"
export BACKEND_PORT="${BACKEND_PORT:-16365}"
export EXPOSE_BACKEND="${EXPOSE_BACKEND:-0}"
export PHPMYADMIN_PORT="${PHPMYADMIN_PORT:-}"

step "Validate shell scripts"
bash -n scripts/*.sh
sh -n scripts/install-master-bootstrap.sh scripts/install-flux-agent-bootstrap.sh

step "Run agent mock tests"
bash scripts/test-flux-agent-mock.sh

step "Run tokenized 3x-ui fixture tests"
bash scripts/test-three-xui-fixture.sh

step "Run optional real 3x-ui E2E contract"
bash scripts/test-three-xui-e2e.sh

step "Validate compose files"
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose-v4.yml config --quiet
docker compose -f docker-compose-v6.yml config --quiet
docker compose -f docker-compose.legacy-v4.yml config --quiet
docker compose -f docker-compose.legacy-v6.yml config --quiet

step "Validate master port contract"
bash scripts/test-master-port-contract.sh

step "Build frontend with Docker Node 22"
docker run --rm \
  -v "${PROJECT_ROOT}:/workspace" \
  -v flux_3xui_frontend_node_modules:/workspace/vite-frontend/node_modules \
  -w /workspace/vite-frontend \
  node:22-bookworm \
  bash -lc "npm install --legacy-peer-deps --no-audit --no-fund && npm run build"

if [ "$FULL" = "true" ]; then
  step "Build backend with Docker Maven"
  docker run --rm \
    -v "${PROJECT_ROOT}/springboot-backend:/workspace" \
    -w /workspace \
    maven:3.9-eclipse-temurin-21 \
    mvn -B -DskipTests package

  step "Run Linux install matrix diagnostics"
  bash scripts/test-install-matrix.sh

  step "Run disposable compose smoke test"
  bash scripts/test-compose-smoke.sh --build-local
else
  step "Dry-run compose smoke test"
  bash scripts/test-compose-smoke.sh --build-local --dry-run
fi

step "Check git whitespace"
git diff --check

echo
echo "Release checks passed."
