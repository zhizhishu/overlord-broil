#!/usr/bin/env bash
set -euo pipefail

REPO="${FLUX_REPO:-zhizhishu/flux-3xui-orchestrator}"
REF="${FLUX_REF:-main}"
RAW_BASE="${FLUX_RAW_BASE:-https://raw.githubusercontent.com/${REPO}/${REF}}"
INSTALL_DIR="${FLUX_INSTALL_DIR:-/opt/flux-3xui-orchestrator}"
NETWORK_STACK="${FLUX_NETWORK_STACK:-v4}"
FRONTEND_PORT="${FLUX_FRONTEND_PORT:-80}"
BACKEND_PORT="${FLUX_BACKEND_PORT:-6365}"
DB_NAME="${FLUX_DB_NAME:-gost}"
DB_USER="${FLUX_DB_USER:-gost}"
DB_PASSWORD="${FLUX_DB_PASSWORD:-}"
JWT_SECRET="${FLUX_JWT_SECRET:-}"
INSTALL_DOCKER="${FLUX_INSTALL_DOCKER:-1}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
GITHUB_TOKEN="${FLUX_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"

usage() {
  cat <<'EOF'
Usage:
  install-master.sh [options]

Options:
  --dir PATH              Install directory, default /opt/flux-3xui-orchestrator
  --stack v4|v6           Compose network stack, default v4
  --frontend-port PORT    Public frontend port, default 80
  --backend-port PORT     Public backend API port, default 6365
  --repo OWNER/REPO       GitHub repo, default zhizhishu/flux-3xui-orchestrator
  --ref REF               Git ref to download, default main
  --no-install-docker     Fail instead of installing Docker when it is missing
  -h, --help              Show this help

Environment:
  FLUX_GITHUB_TOKEN       Optional token for downloading files from a private repo
  GHCR_USERNAME/GHCR_TOKEN  Optional login for private GHCR packages
  FLUX_DB_PASSWORD          Optional database password; generated when empty
  FLUX_JWT_SECRET           Optional JWT secret; generated when empty
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --stack)
      NETWORK_STACK="$2"
      shift 2
      ;;
    --frontend-port)
      FRONTEND_PORT="$2"
      shift 2
      ;;
    --backend-port)
      BACKEND_PORT="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      RAW_BASE="https://raw.githubusercontent.com/${REPO}/${REF}"
      shift 2
      ;;
    --ref)
      REF="$2"
      RAW_BASE="https://raw.githubusercontent.com/${REPO}/${REF}"
      shift 2
      ;;
    --no-install-docker)
      INSTALL_DOCKER="0"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this installer as root." >&2
  exit 2
fi

if [ "$NETWORK_STACK" != "v4" ] && [ "$NETWORK_STACK" != "v6" ]; then
  echo "--stack must be v4 or v6." >&2
  exit 2
fi

install_base_packages() {
  if command -v curl >/dev/null 2>&1; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y ca-certificates curl
  elif command -v yum >/dev/null 2>&1; then
    yum install -y ca-certificates curl
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache ca-certificates curl
  else
    echo "curl is required. Please install curl first." >&2
    exit 2
  fi
}

random_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  else
    dd if=/dev/urandom bs="$bytes" count=1 2>/dev/null | od -An -tx1 | tr -d ' \n'
    echo
  fi
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  if [ "$INSTALL_DOCKER" != "1" ]; then
    echo "Docker with the compose plugin is required." >&2
    exit 2
  fi

  echo "Docker is missing or docker compose is unavailable. Installing Docker..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh

  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker || true
  elif command -v service >/dev/null 2>&1; then
    service docker start || true
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker compose plugin is still unavailable after Docker installation." >&2
    exit 2
  fi
}

download_file() {
  local url="$1"
  local output="$2"
  echo "Downloading ${url}"
  if [ -n "$GITHUB_TOKEN" ]; then
    curl -fsSL --retry 3 --connect-timeout 20 -H "Authorization: Bearer ${GITHUB_TOKEN}" "$url" -o "$output"
  else
    curl -fsSL --retry 3 --connect-timeout 20 "$url" -o "$output"
  fi
}

read_env_value() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- || true
}

detect_host() {
  if [ -n "${FLUX_PANEL_HOST:-}" ]; then
    echo "$FLUX_PANEL_HOST"
    return
  fi

  curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || hostname
}

install_base_packages
ensure_docker

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

COMPOSE_FILE="docker-compose-${NETWORK_STACK}.yml"
ENV_FILE=".env"

download_file "${RAW_BASE}/${COMPOSE_FILE}" "$COMPOSE_FILE"
download_file "${RAW_BASE}/gost.sql" "gost.sql"

if [ ! -f "$ENV_FILE" ]; then
  DB_PASSWORD="${DB_PASSWORD:-$(random_hex 24)}"
  JWT_SECRET="${JWT_SECRET:-$(random_hex 32)}"
  umask 077
  cat > "$ENV_FILE" <<ENV
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
FRONTEND_PORT=${FRONTEND_PORT}
BACKEND_PORT=${BACKEND_PORT}
ENV
  chmod 600 "$ENV_FILE"
  echo "Generated ${INSTALL_DIR}/${ENV_FILE}"
else
  echo "Keeping existing ${INSTALL_DIR}/${ENV_FILE}"
fi

if [ -n "$GHCR_USERNAME" ] || [ -n "$GHCR_TOKEN" ]; then
  if [ -z "$GHCR_USERNAME" ] || [ -z "$GHCR_TOKEN" ]; then
    echo "Both GHCR_USERNAME and GHCR_TOKEN are required for GHCR login." >&2
    exit 2
  fi
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

FINAL_FRONTEND_PORT="$(read_env_value FRONTEND_PORT "$ENV_FILE")"
FINAL_BACKEND_PORT="$(read_env_value BACKEND_PORT "$ENV_FILE")"
PANEL_HOST="$(detect_host)"

cat <<EOF

Flux 3x-ui Orchestrator is running.

Install dir: ${INSTALL_DIR}
Frontend:    http://${PANEL_HOST}:${FINAL_FRONTEND_PORT}
Backend API: http://${PANEL_HOST}:${FINAL_BACKEND_PORT}

Default login from gost.sql:
  username: admin_user
  password: admin_user

Change the default password after first login.
EOF
