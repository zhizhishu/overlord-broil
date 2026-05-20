#!/usr/bin/env bash
set -euo pipefail

REPO="${FLUX_REPO:-zhizhishu/flux-3xui-orchestrator}"
REF="${FLUX_REF:-main}"
RAW_BASE="${FLUX_RAW_BASE:-https://raw.githubusercontent.com/${REPO}/${REF}}"
INSTALL_DIR="${FLUX_INSTALL_DIR:-/opt/flux-3xui-orchestrator}"
SOURCE_DIR="${FLUX_SOURCE_DIR:-${INSTALL_DIR}/source}"
NETWORK_STACK="${FLUX_NETWORK_STACK:-v4}"
FRONTEND_PORT="${FLUX_FRONTEND_PORT:-80}"
BACKEND_PORT="${FLUX_BACKEND_PORT:-6365}"
DB_NAME="${FLUX_DB_NAME:-gost}"
DB_USER="${FLUX_DB_USER:-gost}"
DB_PASSWORD="${FLUX_DB_PASSWORD:-}"
JWT_SECRET="${FLUX_JWT_SECRET:-}"
INSTALL_DOCKER="${FLUX_INSTALL_DOCKER:-1}"
BUILD_ON_PULL_FAILURE="${FLUX_BUILD_ON_PULL_FAILURE:-1}"
GHCR_USERNAME="${GHCR_USERNAME:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
GITHUB_TOKEN="${FLUX_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"
ACTION="install"
BACKUP_DIR="${FLUX_BACKUP_DIR:-}"
BACKUP_FILE="${FLUX_BACKUP_FILE:-}"
ASSUME_YES="0"
ACTION_SET="0"
STACK_EXPLICIT="0"

usage() {
  cat <<'EOF'
Usage:
  install-master.sh [action] [options]

Actions:
  install                 Install or repair the master stack (default)
  upgrade                 Back up, refresh compose/sql files, pull images and restart
  backup                  Create a tar.gz backup of config files and a MySQL dump when running
  restore                 Restore from --backup-file and restart the stack
  uninstall               Stop and remove stack containers; requires --yes and keeps data files

Options:
  --dir PATH              Install directory, default /opt/flux-3xui-orchestrator
  --stack v4|v6           Compose network stack, default v4
  --frontend-port PORT    Public frontend port, default 80
  --backend-port PORT     Public backend API port, default 6365
  --backup-dir PATH       Backup output directory, default /opt/flux-3xui-orchestrator/backups
  --backup-file PATH      Backup archive used by restore
  --repo OWNER/REPO       GitHub repo, default zhizhishu/flux-3xui-orchestrator
  --ref REF               Git ref to download, default main
  --no-install-docker     Fail instead of installing Docker when it is missing
  --no-build-fallback     Fail instead of building local images when GHCR pull fails
  --yes                   Required for uninstall
  -h, --help              Show this help

Environment:
  FLUX_GITHUB_TOKEN       Optional token for downloading files from a private repo
  GHCR_USERNAME/GHCR_TOKEN  Optional login for private GHCR packages
  FLUX_DB_PASSWORD          Optional database password; generated when empty
  FLUX_JWT_SECRET           Optional JWT secret; generated when empty
  FLUX_BACKUP_DIR           Optional backup output directory
  FLUX_BACKUP_FILE          Optional restore archive path
  FLUX_BUILD_ON_PULL_FAILURE Build local images after GHCR pull failure, default 1
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    install|upgrade|backup|restore|uninstall)
      if [ "$ACTION_SET" = "1" ]; then
        echo "Only one action can be specified." >&2
        usage >&2
        exit 2
      fi
      ACTION="$1"
      ACTION_SET="1"
      shift
      ;;
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --stack)
      NETWORK_STACK="$2"
      STACK_EXPLICIT="1"
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
    --backup-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    --backup-file)
      BACKUP_FILE="$2"
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
    --no-build-fallback)
      BUILD_ON_PULL_FAILURE="0"
      shift
      ;;
    --yes)
      ASSUME_YES="1"
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

BACKUP_DIR="${BACKUP_DIR:-${INSTALL_DIR}/backups}"
COMPOSE_FILE="docker-compose-${NETWORK_STACK}.yml"
ENV_FILE=".env"

install_base_packages() {
  if command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl tar
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y ca-certificates curl tar
  elif command -v yum >/dev/null 2>&1; then
    yum install -y ca-certificates curl tar
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache ca-certificates curl tar
  else
    echo "curl and tar are required. Please install them first." >&2
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

download_source() {
  local archive="/tmp/flux-3xui-orchestrator-${REF}.tar.gz"
  rm -rf "$SOURCE_DIR"
  mkdir -p "$SOURCE_DIR"
  download_file "https://github.com/${REPO}/archive/${REF}.tar.gz" "$archive"
  tar -xzf "$archive" -C "$SOURCE_DIR" --strip-components=1
}

build_local_images() {
  echo "Building backend/frontend images locally from ${REPO}@${REF}..."
  download_source
  docker build -t ghcr.io/zhizhishu/flux-3xui-orchestrator-backend:latest "${SOURCE_DIR}/springboot-backend"
  docker build -t ghcr.io/zhizhishu/flux-3xui-orchestrator-frontend:latest "${SOURCE_DIR}/vite-frontend"
}

read_env_value() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- || true
}

require_env_values() {
  local file="$1"
  local missing=""
  local key value

  if [ ! -f "$file" ]; then
    echo "Required env file is missing: ${file}" >&2
    exit 2
  fi

  for key in DB_NAME DB_USER DB_PASSWORD JWT_SECRET FRONTEND_PORT BACKEND_PORT; do
    value="$(read_env_value "$key" "$file")"
    if [ -z "$value" ]; then
      missing="${missing} ${key}"
    fi
  done

  if [ -n "$missing" ]; then
    echo "Required value(s) missing from ${file}:${missing}" >&2
    exit 2
  fi
}

resolve_restore_compose_file() {
  if [ -f "$COMPOSE_FILE" ]; then
    return
  fi

  if [ "$STACK_EXPLICIT" = "1" ]; then
    echo "Backup does not contain the requested compose file: ${COMPOSE_FILE}" >&2
    exit 2
  fi

  if [ -f docker-compose-v4.yml ]; then
    NETWORK_STACK="v4"
    COMPOSE_FILE="docker-compose-v4.yml"
    echo "Using restored compose file: ${COMPOSE_FILE}"
    return
  fi

  if [ -f docker-compose-v6.yml ]; then
    NETWORK_STACK="v6"
    COMPOSE_FILE="docker-compose-v6.yml"
    echo "Using restored compose file: ${COMPOSE_FILE}"
    return
  fi

  echo "Backup does not contain docker-compose-v4.yml or docker-compose-v6.yml." >&2
  exit 2
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

load_existing_env() {
  if [ -f "${INSTALL_DIR}/${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    set -a
    . "${INSTALL_DIR}/${ENV_FILE}"
    set +a
    DB_NAME="${DB_NAME:-gost}"
    DB_USER="${DB_USER:-gost}"
    DB_PASSWORD="${DB_PASSWORD:-}"
  fi
}

compose_cmd() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_for_mysql() {
  local i
  for i in $(seq 1 30); do
    if docker exec gost-mysql mysqladmin ping -h 127.0.0.1 -u"${DB_USER}" -p"${DB_PASSWORD}" --silent >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "MySQL did not become ready in time." >&2
  return 1
}

download_runtime_files() {
  download_file "${RAW_BASE}/${COMPOSE_FILE}" "$COMPOSE_FILE"
  download_file "${RAW_BASE}/gost.sql" "gost.sql"
}

ensure_env_file() {
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
}

docker_login_if_configured() {
  if [ -n "$GHCR_USERNAME" ] || [ -n "$GHCR_TOKEN" ]; then
    if [ -z "$GHCR_USERNAME" ] || [ -z "$GHCR_TOKEN" ]; then
      echo "Both GHCR_USERNAME and GHCR_TOKEN are required for GHCR login." >&2
      exit 2
    fi
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
  fi
}

pull_or_build_images() {
  if ! compose_cmd pull; then
    if [ "$BUILD_ON_PULL_FAILURE" != "1" ]; then
      echo "Image pull failed and local build fallback is disabled." >&2
      exit 2
    fi
    echo "Image pull failed. Falling back to local image build from the GitHub source archive."
    build_local_images
  fi
}

print_success() {
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
}

create_backup() {
  mkdir -p "$BACKUP_DIR"
  local stamp
  local workdir
  local archive
  local file_count=0
  stamp="$(date +%Y%m%d-%H%M%S)"
  workdir="$(mktemp -d)"
  archive="${BACKUP_DIR}/flux-master-backup-${stamp}.tar.gz"

  mkdir -p "${workdir}/files"
  for file in "$ENV_FILE" "docker-compose-v4.yml" "docker-compose-v6.yml" "gost.sql"; do
    if [ -f "$file" ]; then
      cp -p "$file" "${workdir}/files/${file}"
      file_count=$((file_count + 1))
    fi
  done

  load_existing_env
  if docker ps --format '{{.Names}}' | grep -qx 'gost-mysql' && [ -n "$DB_PASSWORD" ]; then
    echo "Creating MySQL logical dump..."
    if docker exec gost-mysql mysqldump -u"${DB_USER}" -p"${DB_PASSWORD}" --single-transaction --routines --triggers "${DB_NAME}" > "${workdir}/mysql.sql"; then
      :
    else
      echo "MySQL dump failed; continuing with file backup only." >&2
      rm -f "${workdir}/mysql.sql"
    fi
  fi

  if [ "$file_count" -eq 0 ] && [ ! -f "${workdir}/mysql.sql" ]; then
    rm -rf "$workdir"
    echo "Nothing to back up in ${INSTALL_DIR}; expected .env, docker-compose-v4.yml/docker-compose-v6.yml, gost.sql or a running gost-mysql container." >&2
    exit 2
  fi

  tar -czf "$archive" -C "$workdir" .
  rm -rf "$workdir"
  echo "Backup created: ${archive}"
}

restore_backup() {
  if [ -z "$BACKUP_FILE" ]; then
    echo "restore requires --backup-file PATH." >&2
    exit 2
  fi
  if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: ${BACKUP_FILE}" >&2
    exit 2
  fi

  local workdir
  workdir="$(mktemp -d)"
  tar -xzf "$BACKUP_FILE" -C "$workdir"

  if [ -d "${workdir}/files" ]; then
    cp -p "${workdir}/files/"* . 2>/dev/null || true
  else
    rm -rf "$workdir"
    echo "Backup archive does not contain a files directory." >&2
    exit 2
  fi

  require_env_values "$ENV_FILE"
  resolve_restore_compose_file

  docker_login_if_configured
  pull_or_build_images
  compose_cmd up -d

  if [ -f "${workdir}/mysql.sql" ]; then
    load_existing_env
    wait_for_mysql
    echo "Restoring MySQL logical dump..."
    docker exec -i gost-mysql mysql -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < "${workdir}/mysql.sql"
  fi

  rm -rf "$workdir"
  print_success
}

install_or_upgrade() {
  download_runtime_files
  ensure_env_file
  docker_login_if_configured
  pull_or_build_images
  compose_cmd up -d
  print_success
}

uninstall_stack() {
  if [ "$ASSUME_YES" != "1" ]; then
    echo "uninstall requires --yes. This removes containers but keeps ${INSTALL_DIR} and Docker volumes." >&2
    exit 2
  fi
  if [ -f "$ENV_FILE" ] && [ -f "$COMPOSE_FILE" ]; then
    create_backup
    compose_cmd down
    echo "Flux master containers removed. Data files and Docker volumes were kept."
  else
    echo "No compose/env files found in ${INSTALL_DIR}; nothing to uninstall."
  fi
}

install_base_packages
ensure_docker

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

case "$ACTION" in
  install)
    install_or_upgrade
    ;;
  upgrade)
    if [ -f "$ENV_FILE" ] || [ -f "$COMPOSE_FILE" ]; then
      create_backup
    fi
    install_or_upgrade
    ;;
  backup)
    create_backup
    ;;
  restore)
    restore_backup
    ;;
  uninstall)
    uninstall_stack
    ;;
  *)
    echo "Unknown action: ${ACTION}" >&2
    usage >&2
    exit 2
    ;;
esac
