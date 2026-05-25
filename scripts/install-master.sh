#!/usr/bin/env bash
set -euo pipefail

REPO="${FLUX_REPO:-zhizhishu/flux-3xui-orchestrator}"
REF="${FLUX_REF:-main}"
RAW_BASE="${FLUX_RAW_BASE:-https://raw.githubusercontent.com/${REPO}/${REF}}"
INSTALL_DIR="${FLUX_INSTALL_DIR:-/opt/flux-3xui-orchestrator}"
SOURCE_DIR="${FLUX_SOURCE_DIR:-${INSTALL_DIR}/source}"
NETWORK_STACK="${FLUX_NETWORK_STACK:-v4}"
FRONTEND_PORT="${FLUX_FRONTEND_PORT:-5166}"
BACKEND_PORT="${FLUX_BACKEND_PORT:-6365}"
PHPMYADMIN_PORT="${FLUX_PHPMYADMIN_PORT:-}"
EXPOSE_BACKEND="${FLUX_EXPOSE_BACKEND:-0}"
DB_NAME="${FLUX_DB_NAME:-gost}"
DB_USER="${FLUX_DB_USER:-gost}"
DB_PASSWORD="${FLUX_DB_PASSWORD:-}"
JWT_SECRET="${FLUX_JWT_SECRET:-}"
SECRET_ENCRYPTION_KEY="${FLUX_SECRET_ENCRYPTION_KEY:-}"
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
FRONTEND_PORT_EXPLICIT="0"
BACKEND_PORT_EXPLICIT="0"
PHPMYADMIN_PORT_EXPLICIT="0"
EXPOSE_BACKEND_EXPLICIT="0"
if [ "${FLUX_FRONTEND_PORT+x}" = "x" ]; then FRONTEND_PORT_EXPLICIT="1"; fi
if [ "${FLUX_BACKEND_PORT+x}" = "x" ]; then BACKEND_PORT_EXPLICIT="1"; fi
if [ "${FLUX_PHPMYADMIN_PORT+x}" = "x" ]; then PHPMYADMIN_PORT_EXPLICIT="1"; fi
if [ "${FLUX_EXPOSE_BACKEND+x}" = "x" ]; then EXPOSE_BACKEND_EXPLICIT="1"; fi

usage() {
  cat <<'EOF'
Usage:
  install-master.sh [action] [options]

Actions:
  doctor                  Run non-destructive host diagnostics and exit
  install                 Install or repair the master stack (default)
  upgrade                 Back up, refresh compose/sql files, pull images and restart
  backup                  Create a tar.gz backup of config files and a MySQL dump when running
  restore                 Restore from --backup-file and restart the stack
  uninstall               Stop and remove stack containers; requires --yes and keeps data files

Options:
  --dir PATH              Install directory, default /opt/flux-3xui-orchestrator
  --stack v4|v6           Compose network stack, default v4
  --frontend-port PORT    Public frontend port, default 5166
  --backend-port PORT     Backend debug port when --expose-backend is enabled, default 6365
  --expose-backend        Publish backend API port for debugging; disabled by default
  --no-expose-backend     Keep backend API internal to Docker network
  --phpmyadmin-port PORT  Expose phpMyAdmin on this host port; disabled by default
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
  FLUX_SECRET_ENCRYPTION_KEY Optional credential encryption key; generated when empty
  FLUX_EXPOSE_BACKEND        Optional backend public exposure flag, default 0
  FLUX_PHPMYADMIN_PORT       Optional phpMyAdmin public port; unset disables public exposure
  FLUX_BACKUP_DIR           Optional backup output directory
  FLUX_BACKUP_FILE          Optional restore archive path
  FLUX_BUILD_ON_PULL_FAILURE Build local images after GHCR pull failure, default 1
  FLUX_DOCTOR_REQUIRE_DOCKER Require Docker daemon during doctor, default 1
  FLUX_DOCTOR_SKIP_PORT_CHECK Skip live port-listening checks during doctor, default 0
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    doctor|install|upgrade|backup|restore|uninstall)
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
      FRONTEND_PORT_EXPLICIT="1"
      shift 2
      ;;
    --backend-port)
      BACKEND_PORT="$2"
      BACKEND_PORT_EXPLICIT="1"
      shift 2
      ;;
    --expose-backend)
      EXPOSE_BACKEND="1"
      EXPOSE_BACKEND_EXPLICIT="1"
      shift
      ;;
    --no-expose-backend)
      EXPOSE_BACKEND="0"
      EXPOSE_BACKEND_EXPLICIT="1"
      shift
      ;;
    --phpmyadmin-port)
      PHPMYADMIN_PORT="$2"
      PHPMYADMIN_PORT_EXPLICIT="1"
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

if [ "$(id -u)" -ne 0 ] && [ "$ACTION" != "doctor" ]; then
  echo "Please run this installer as root." >&2
  exit 2
fi

if [ "$NETWORK_STACK" != "v4" ] && [ "$NETWORK_STACK" != "v6" ]; then
  echo "--stack must be v4 or v6." >&2
  exit 2
fi

if [ "$EXPOSE_BACKEND" != "0" ] && [ "$EXPOSE_BACKEND" != "1" ]; then
  echo "FLUX_EXPOSE_BACKEND must be 0 or 1." >&2
  exit 2
fi

BACKUP_DIR="${BACKUP_DIR:-${INSTALL_DIR}/backups}"
COMPOSE_FILE="docker-compose-${NETWORK_STACK}.yml"
ENV_FILE=".env"
PHPMYADMIN_OVERRIDE_FILE="docker-compose-phpmyadmin.yml"
BACKEND_OVERRIDE_FILE="docker-compose-backend.yml"

detect_os_name() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    echo "${PRETTY_NAME:-${NAME:-unknown}}"
    return
  fi
  uname -s
}

install_packages() {
  local missing=("$@")
  if [ "${#missing[@]}" -eq 0 ]; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates "${missing[@]}"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y ca-certificates "${missing[@]}"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y ca-certificates "${missing[@]}"
  elif command -v microdnf >/dev/null 2>&1; then
    microdnf install -y ca-certificates "${missing[@]}"
    microdnf clean all || true
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache ca-certificates "${missing[@]}"
  else
    echo "Missing package(s): ${missing[*]}. Please install them first." >&2
    exit 2
  fi
}

install_base_packages() {
  local missing=()
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  command -v tar >/dev/null 2>&1 || missing+=("tar")
  install_packages "${missing[@]}"
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

start_docker_service() {
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    systemctl enable --now docker || true
  elif command -v rc-update >/dev/null 2>&1 && command -v rc-service >/dev/null 2>&1; then
    rc-update add docker default >/dev/null 2>&1 || true
    rc-service docker start || true
  elif command -v service >/dev/null 2>&1; then
    service docker start || true
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
  if command -v apk >/dev/null 2>&1; then
    install_packages docker docker-cli-compose
  else
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
  fi
  start_docker_service

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

env_key_exists() {
  local key="$1"
  local file="$2"
  grep -qE "^${key}=" "$file"
}

write_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$file"; then
    awk -v key="$key" -v value="$value" '
      BEGIN { done = 0 }
      $0 ~ "^" key "=" {
        if (done == 0) {
          print key "=" value
          done = 1
        }
        next
      }
      { print }
      END {
        if (done == 0) {
          print key "=" value
        }
      }
    ' "$file" > "$tmp"
  else
    cp "$file" "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > "$file"
  rm -f "$tmp"
  chmod 600 "$file"
}

require_env_values() {
  local file="$1"
  local missing=""
  local key value

  if [ ! -f "$file" ]; then
    echo "Required env file is missing: ${file}" >&2
    exit 2
  fi

  for key in DB_NAME DB_USER DB_PASSWORD JWT_SECRET SECRET_ENCRYPTION_KEY FRONTEND_PORT BACKEND_PORT EXPOSE_BACKEND; do
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
    || ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}' \
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
    PHPMYADMIN_PORT="${PHPMYADMIN_PORT:-}"
    EXPOSE_BACKEND="${EXPOSE_BACKEND:-0}"
  fi
}

compose_cmd() {
  local files=("-f" "$COMPOSE_FILE")
  if [ -f "$BACKEND_OVERRIDE_FILE" ]; then
    files+=("-f" "$BACKEND_OVERRIDE_FILE")
  fi
  if [ -f "$PHPMYADMIN_OVERRIDE_FILE" ]; then
    files+=("-f" "$PHPMYADMIN_OVERRIDE_FILE")
  fi
  docker compose --env-file "$ENV_FILE" "${files[@]}" "$@"
}

ensure_backend_override() {
  local configured_expose
  configured_expose="$(read_env_value EXPOSE_BACKEND "$ENV_FILE")"
  if [ "$configured_expose" = "1" ]; then
    cat > "$BACKEND_OVERRIDE_FILE" <<'YAML'
services:
  backend:
    ports:
      - "${BACKEND_PORT}:6365"
YAML
  else
    rm -f "$BACKEND_OVERRIDE_FILE"
  fi
}

ensure_phpmyadmin_override() {
  local configured_port
  configured_port="$(read_env_value PHPMYADMIN_PORT "$ENV_FILE")"
  if [ -n "$configured_port" ]; then
    cat > "$PHPMYADMIN_OVERRIDE_FILE" <<'YAML'
services:
  phpmyadmin:
    ports:
      - "${PHPMYADMIN_PORT}:80"
YAML
  else
    rm -f "$PHPMYADMIN_OVERRIDE_FILE"
  fi
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
  download_file "${RAW_BASE}/scripts/install-master.sh" "install-master.sh"
  chmod 0755 "install-master.sh"
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    DB_PASSWORD="${DB_PASSWORD:-$(random_hex 24)}"
    JWT_SECRET="${JWT_SECRET:-$(random_hex 32)}"
    SECRET_ENCRYPTION_KEY="${SECRET_ENCRYPTION_KEY:-$(random_hex 32)}"
    umask 077
    cat > "$ENV_FILE" <<ENV
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
SECRET_ENCRYPTION_KEY=${SECRET_ENCRYPTION_KEY}
FRONTEND_PORT=${FRONTEND_PORT}
BACKEND_PORT=${BACKEND_PORT}
PHPMYADMIN_PORT=${PHPMYADMIN_PORT}
EXPOSE_BACKEND=${EXPOSE_BACKEND}
ENV
    chmod 600 "$ENV_FILE"
    echo "Generated ${INSTALL_DIR}/${ENV_FILE}"
  else
    echo "Keeping existing ${INSTALL_DIR}/${ENV_FILE}"
    if [ -z "$(read_env_value SECRET_ENCRYPTION_KEY "$ENV_FILE")" ]; then
      SECRET_ENCRYPTION_KEY="${SECRET_ENCRYPTION_KEY:-$(random_hex 32)}"
      write_env_value SECRET_ENCRYPTION_KEY "$SECRET_ENCRYPTION_KEY" "$ENV_FILE"
      echo "Added SECRET_ENCRYPTION_KEY to existing ${INSTALL_DIR}/${ENV_FILE}"
    fi
    if ! env_key_exists FRONTEND_PORT "$ENV_FILE"; then
      write_env_value FRONTEND_PORT "$FRONTEND_PORT" "$ENV_FILE"
      echo "Added FRONTEND_PORT to existing ${INSTALL_DIR}/${ENV_FILE}"
    fi
    if ! env_key_exists BACKEND_PORT "$ENV_FILE"; then
      write_env_value BACKEND_PORT "$BACKEND_PORT" "$ENV_FILE"
      echo "Added BACKEND_PORT to existing ${INSTALL_DIR}/${ENV_FILE}"
    fi
    if ! env_key_exists EXPOSE_BACKEND "$ENV_FILE"; then
      write_env_value EXPOSE_BACKEND "$EXPOSE_BACKEND" "$ENV_FILE"
      echo "Added EXPOSE_BACKEND to existing ${INSTALL_DIR}/${ENV_FILE}"
    fi
    if ! env_key_exists PHPMYADMIN_PORT "$ENV_FILE"; then
      write_env_value PHPMYADMIN_PORT "$PHPMYADMIN_PORT" "$ENV_FILE"
      echo "Added PHPMYADMIN_PORT to existing ${INSTALL_DIR}/${ENV_FILE}"
    fi
  fi

  if [ "$FRONTEND_PORT_EXPLICIT" = "1" ]; then
    write_env_value FRONTEND_PORT "$FRONTEND_PORT" "$ENV_FILE"
  elif [ "$(read_env_value FRONTEND_PORT "$ENV_FILE")" = "80" ]; then
    write_env_value FRONTEND_PORT "5166" "$ENV_FILE"
    echo "Migrated legacy FRONTEND_PORT=80 to the single-entry default 5166. Set FLUX_FRONTEND_PORT=80 if you intentionally want port 80."
  fi

  if [ "$BACKEND_PORT_EXPLICIT" = "1" ]; then
    write_env_value BACKEND_PORT "$BACKEND_PORT" "$ENV_FILE"
  fi

  if [ "$EXPOSE_BACKEND_EXPLICIT" = "1" ]; then
    write_env_value EXPOSE_BACKEND "$EXPOSE_BACKEND" "$ENV_FILE"
  else
    write_env_value EXPOSE_BACKEND "0" "$ENV_FILE"
  fi

  if [ "$PHPMYADMIN_PORT_EXPLICIT" = "1" ]; then
    write_env_value PHPMYADMIN_PORT "$PHPMYADMIN_PORT" "$ENV_FILE"
  elif [ "${FLUX_PRESERVE_PHPMYADMIN_PORT:-0}" != "1" ] && [ -n "$(read_env_value PHPMYADMIN_PORT "$ENV_FILE")" ]; then
    write_env_value PHPMYADMIN_PORT "" "$ENV_FILE"
    echo "Disabled public phpMyAdmin exposure. Set FLUX_PHPMYADMIN_PORT or --phpmyadmin-port when temporary maintenance access is needed."
  fi
}

validate_port_number() {
  local name="$1"
  local value="$2"
  case "$value" in
    ''|*[!0-9]*)
      echo "${name} must be an integer port, got '${value}'." >&2
      exit 2
      ;;
  esac
  if [ "$value" -lt 1 ] || [ "$value" -gt 65535 ]; then
    echo "${name} must be between 1 and 65535, got '${value}'." >&2
    exit 2
  fi
}

port_owned_by_flux_container() {
  local port="$1"
  local container
  for container in vite-frontend springboot-backend gost-phpmyadmin; do
    if docker port "$container" 2>/dev/null | grep -Eq ":${port}$"; then
      return 0
    fi
  done
  return 1
}

port_is_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "(:|\\.)${port}$" && return 0
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk 'NR>2 {print $4}' | grep -Eq "(:|\\.)${port}$" && return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  return 1
}

preflight_ports() {
  load_existing_env
  local final_frontend final_backend final_phpmyadmin final_expose_backend
  final_frontend="$(read_env_value FRONTEND_PORT "$ENV_FILE")"
  final_backend="$(read_env_value BACKEND_PORT "$ENV_FILE")"
  final_phpmyadmin="$(read_env_value PHPMYADMIN_PORT "$ENV_FILE")"
  final_expose_backend="$(read_env_value EXPOSE_BACKEND "$ENV_FILE")"

  validate_port_number FRONTEND_PORT "$final_frontend"
  validate_port_number BACKEND_PORT "$final_backend"
  if [ -n "$final_phpmyadmin" ]; then
    validate_port_number PHPMYADMIN_PORT "$final_phpmyadmin"
  fi
  if [ "$final_expose_backend" != "0" ] && [ "$final_expose_backend" != "1" ]; then
    echo "EXPOSE_BACKEND must be 0 or 1." >&2
    exit 2
  fi

  if { [ "$final_expose_backend" = "1" ] && [ "$final_frontend" = "$final_backend" ]; } || { [ -n "$final_phpmyadmin" ] && { [ "$final_frontend" = "$final_phpmyadmin" ] || { [ "$final_expose_backend" = "1" ] && [ "$final_backend" = "$final_phpmyadmin" ]; }; }; }; then
    echo "Public FRONTEND_PORT, exposed BACKEND_PORT and PHPMYADMIN_PORT must be different." >&2
    exit 2
  fi

  local label port
  for label in FRONTEND_PORT; do
    case "$label" in
      FRONTEND_PORT) port="$final_frontend" ;;
    esac
    if port_is_listening "$port" && ! port_owned_by_flux_container "$port"; then
      echo "${label}=${port} is already listening on this host. Set a different FLUX_${label} or stop the conflicting service." >&2
      exit 2
    fi
  done
  if [ "$final_expose_backend" = "1" ] && port_is_listening "$final_backend" && ! port_owned_by_flux_container "$final_backend"; then
    echo "BACKEND_PORT=${final_backend} is already listening on this host. Set a different FLUX_BACKEND_PORT or disable FLUX_EXPOSE_BACKEND." >&2
    exit 2
  fi
  if [ -n "$final_phpmyadmin" ] && port_is_listening "$final_phpmyadmin" && ! port_owned_by_flux_container "$final_phpmyadmin"; then
    echo "PHPMYADMIN_PORT=${final_phpmyadmin} is already listening on this host. Set a different FLUX_PHPMYADMIN_PORT or stop the conflicting service." >&2
    exit 2
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
  FINAL_PHPMYADMIN_PORT="$(read_env_value PHPMYADMIN_PORT "$ENV_FILE")"
  FINAL_EXPOSE_BACKEND="$(read_env_value EXPOSE_BACKEND "$ENV_FILE")"
  PANEL_HOST="$(detect_host)"

  cat <<EOF

Flux 3x-ui Orchestrator is running.

Install dir: ${INSTALL_DIR}
Panel URL:   http://${PANEL_HOST}:${FINAL_FRONTEND_PORT}
Agent URL:   http://${PANEL_HOST}:${FINAL_FRONTEND_PORT}
Backend API: $(if [ "$FINAL_EXPOSE_BACKEND" = "1" ]; then printf 'http://%s:%s  (debug only; agents should still use the Panel URL)' "$PANEL_HOST" "$FINAL_BACKEND_PORT"; else printf 'internal only; proxied through Panel URL /api/v1/*'; fi)
phpMyAdmin:  $(if [ -n "$FINAL_PHPMYADMIN_PORT" ]; then printf 'http://%s:%s  (restrict by firewall in production)' "$PANEL_HOST" "$FINAL_PHPMYADMIN_PORT"; else printf 'not publicly exposed; set FLUX_PHPMYADMIN_PORT or --phpmyadmin-port to expose temporarily'; fi)

Default login from gost.sql:
  username: admin_user
  password: admin_user

Change the default password after first login.
EOF
}

doctor_failed=0

doctor_item() {
  local status="$1"
  local label="$2"
  local detail="$3"
  printf '[%s] %s: %s\n' "$status" "$label" "$detail"
  if [ "$status" = "fail" ]; then
    doctor_failed=1
  fi
}

detect_package_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    echo apt
  elif command -v dnf >/dev/null 2>&1; then
    echo dnf
  elif command -v yum >/dev/null 2>&1; then
    echo yum
  elif command -v microdnf >/dev/null 2>&1; then
    echo microdnf
  elif command -v apk >/dev/null 2>&1; then
    echo apk
  else
    echo unknown
  fi
}

detect_service_manager_hint() {
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    echo systemd
  elif command -v rc-service >/dev/null 2>&1 && command -v rc-update >/dev/null 2>&1; then
    echo openrc
  elif command -v service >/dev/null 2>&1; then
    echo service
  else
    echo unknown
  fi
}

doctor_command() {
  local command_name="$1"
  local required="$2"
  if command -v "$command_name" >/dev/null 2>&1; then
    doctor_item ok "$command_name" "$(command -v "$command_name")"
  elif [ "$required" = "1" ]; then
    doctor_item fail "$command_name" "missing"
  else
    doctor_item warn "$command_name" "missing"
  fi
}

doctor_valid_port() {
  local value="$1"
  case "$value" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$value" -ge 1 ] && [ "$value" -le 65535 ]
}

doctor_port() {
  local label="$1"
  local port="$2"
  if ! doctor_valid_port "$port"; then
    doctor_item fail "$label" "invalid port '${port}'"
    return
  fi
  if [ "${FLUX_DOCTOR_SKIP_PORT_CHECK:-0}" = "1" ]; then
    doctor_item warn "$label" "${port} not checked for listeners in this doctor run"
    return
  fi
  if port_is_listening "$port"; then
    if command -v docker >/dev/null 2>&1 && port_owned_by_flux_container "$port"; then
      doctor_item ok "$label" "${port} is already owned by a Flux container"
    else
      doctor_item fail "$label" "${port} is already listening; set FLUX_${label} or stop the conflicting service"
    fi
  else
    doctor_item ok "$label" "${port} is available"
  fi
}

run_master_doctor() {
  local require_docker="${FLUX_DOCTOR_REQUIRE_DOCKER:-1}"
  local frontend_port="${FRONTEND_PORT}"
  local backend_port="${BACKEND_PORT}"
  local phpmyadmin_port="${PHPMYADMIN_PORT}"
  local expose_backend="${EXPOSE_BACKEND}"

  echo "Flux master doctor"
  doctor_item ok "os" "$(detect_os_name)"
  doctor_item ok "arch" "$(uname -m)"
  doctor_item ok "package-manager" "$(detect_package_manager)"
  doctor_item ok "service-manager" "$(detect_service_manager_hint)"

  if [ "$(id -u)" -eq 0 ]; then
    doctor_item ok "root" "running as root"
  else
    doctor_item warn "root" "not root; install/upgrade/restore/uninstall require root"
  fi

  doctor_command curl 1
  doctor_command tar 1
  doctor_command docker "$require_docker"

  if command -v docker >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
      doctor_item ok "docker-compose" "$(docker compose version 2>/dev/null | head -n 1)"
    else
      doctor_item fail "docker-compose" "docker compose plugin is unavailable"
    fi
    if [ "$require_docker" = "1" ]; then
      if docker info >/dev/null 2>&1; then
        doctor_item ok "docker-daemon" "reachable"
      else
        doctor_item fail "docker-daemon" "not reachable; start Docker before installing the master"
      fi
    else
      doctor_item warn "docker-daemon" "not required for this doctor run"
    fi
  fi

  if [ -f "${INSTALL_DIR}/${ENV_FILE}" ]; then
    frontend_port="$(read_env_value FRONTEND_PORT "${INSTALL_DIR}/${ENV_FILE}")"
    backend_port="$(read_env_value BACKEND_PORT "${INSTALL_DIR}/${ENV_FILE}")"
    phpmyadmin_port="$(read_env_value PHPMYADMIN_PORT "${INSTALL_DIR}/${ENV_FILE}")"
    expose_backend="$(read_env_value EXPOSE_BACKEND "${INSTALL_DIR}/${ENV_FILE}")"
    expose_backend="${expose_backend:-0}"
    doctor_item ok "env-file" "found ${INSTALL_DIR}/${ENV_FILE}"
  else
    doctor_item warn "env-file" "not found yet; using requested/default ports"
  fi

  doctor_port FRONTEND_PORT "$frontend_port"
  if [ "$expose_backend" != "0" ] && [ "$expose_backend" != "1" ]; then
    doctor_item fail "EXPOSE_BACKEND" "invalid flag '${expose_backend}', expected 0 or 1"
  fi
  if [ "$expose_backend" = "1" ]; then
    doctor_port BACKEND_PORT "$backend_port"
  else
    doctor_item ok "BACKEND_PORT" "${backend_port} internal only; not published"
  fi
  if [ -n "$phpmyadmin_port" ]; then
    doctor_port PHPMYADMIN_PORT "$phpmyadmin_port"
  else
    doctor_item ok "PHPMYADMIN_PORT" "not publicly exposed"
  fi

  if { [ "$expose_backend" = "1" ] && [ "$frontend_port" = "$backend_port" ]; } || { [ -n "$phpmyadmin_port" ] && { [ "$frontend_port" = "$phpmyadmin_port" ] || { [ "$expose_backend" = "1" ] && [ "$backend_port" = "$phpmyadmin_port" ]; }; }; }; then
    doctor_item fail "port-matrix" "public FRONTEND_PORT, exposed BACKEND_PORT and PHPMYADMIN_PORT must be different"
  else
    if [ "$expose_backend" = "1" ]; then
      doctor_item ok "port-matrix" "frontend=${frontend_port}, backend=${backend_port} exposed, phpmyadmin=${phpmyadmin_port:-disabled}"
    else
      doctor_item ok "port-matrix" "frontend=${frontend_port}, backend=internal, phpmyadmin=${phpmyadmin_port:-disabled}"
    fi
  fi

  if [ "$doctor_failed" -eq 0 ]; then
    echo "Master doctor passed."
    return 0
  fi
  echo "Master doctor found blocking issue(s)." >&2
  return 1
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
  for file in "$ENV_FILE" "docker-compose-v4.yml" "docker-compose-v6.yml" "$BACKEND_OVERRIDE_FILE" "$PHPMYADMIN_OVERRIDE_FILE" "gost.sql"; do
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
  ensure_backend_override
  ensure_phpmyadmin_override

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
  require_env_values "$ENV_FILE"
  ensure_backend_override
  ensure_phpmyadmin_override
  preflight_ports
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

if [ "$ACTION" = "doctor" ]; then
  run_master_doctor
  exit $?
fi

install_base_packages
echo "Detected OS: $(detect_os_name)"
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
