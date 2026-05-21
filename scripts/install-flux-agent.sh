#!/usr/bin/env bash
set -euo pipefail

PANEL_URL="${FLUX_PANEL_URL:-}"
SERVER_ID="${FLUX_SERVER_ID:-}"
AGENT_TOKEN="${FLUX_AGENT_TOKEN:-}"
POLL_INTERVAL="${FLUX_POLL_INTERVAL:-20}"
HTTP_RETRIES="${FLUX_HTTP_RETRIES:-4}"
HTTP_BACKOFF_BASE="${FLUX_HTTP_BACKOFF_BASE:-2}"
HTTP_BACKOFF_MAX="${FLUX_HTTP_BACKOFF_MAX:-30}"
HTTP_CONNECT_TIMEOUT="${FLUX_HTTP_CONNECT_TIMEOUT:-10}"
HTTP_MAX_TIME="${FLUX_HTTP_MAX_TIME:-60}"
TASK_TIMEOUT_SECONDS="${FLUX_TASK_TIMEOUT_SECONDS:-7200}"
TASK_TIMEOUT_KILL_SECONDS="${FLUX_TASK_TIMEOUT_KILL_SECONDS:-30}"
INSTALL_BIN="${FLUX_AGENT_BIN:-/usr/local/bin/flux-agent.sh}"
ENV_FILE="${FLUX_AGENT_ENV:-/etc/flux-agent.env}"
OPENRC_WRAPPER="${FLUX_AGENT_OPENRC_WRAPPER:-/usr/local/bin/flux-agent-openrc-wrapper.sh}"
SERVICE_MANAGER="${FLUX_SERVICE_MANAGER:-auto}"
SYSTEMD_SERVICE_FILE="${FLUX_AGENT_SYSTEMD_SERVICE:-/etc/systemd/system/flux-agent.service}"
OPENRC_SERVICE_FILE="${FLUX_AGENT_OPENRC_SERVICE:-/etc/init.d/flux-agent}"
REPO_RAW_URL="${FLUX_REPO_RAW_URL:-https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main}"
SOURCE_URL="${FLUX_AGENT_SOURCE_URL:-${REPO_RAW_URL}/scripts/flux-agent.sh}"
SOURCE_SCRIPT="${1:-}"
GITHUB_TOKEN="${FLUX_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"
ACTION="install"

usage() {
  cat <<'EOF'
Usage:
  install-flux-agent.sh [doctor]
  install-flux-agent.sh [path/to/flux-agent.sh]

Actions:
  install                 Install or repair the long-running agent service (default)
  doctor                  Run non-destructive controlled-host diagnostics and exit

Required for install:
  FLUX_PANEL_URL          Master panel URL, for example https://master.example.com
  FLUX_SERVER_ID          Server id from the master panel
  FLUX_AGENT_TOKEN        Agent token from the master panel

Doctor environment:
  FLUX_DOCTOR_REQUIRE_SERVICE_MANAGER  Require systemd/OpenRC during doctor, default 1
  FLUX_DOCTOR_REQUIRE_AGENT_ENV        Require FLUX_PANEL_URL/SERVER_ID/AGENT_TOKEN during doctor, default 1
EOF
}

if [ "$SOURCE_SCRIPT" = "doctor" ]; then
  ACTION="doctor"
  SOURCE_SCRIPT=""
elif [ "$SOURCE_SCRIPT" = "-h" ] || [ "$SOURCE_SCRIPT" = "--help" ]; then
  usage
  exit 0
fi

quote_env_value() {
  case "$1" in
    *$'\n'*|*$'\r'*)
      echo "Environment values cannot contain line breaks." >&2
      exit 2
      ;;
  esac
  printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/`/\\`/g' -e 's/\$/\\$/g')"
}

write_env_line() {
  local key="$1"
  local value="$2"
  printf '%s=%s\n' "$key" "$(quote_env_value "$value")"
}

install_packages() {
  local missing=()
  command -v bash >/dev/null 2>&1 || missing+=("bash")
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  command -v python3 >/dev/null 2>&1 || missing+=("python3")

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
    echo "Missing dependencies: ${missing[*]}. Please install them first." >&2
    exit 2
  fi
}

detect_os_name() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    echo "${PRETTY_NAME:-${NAME:-unknown}}"
    return
  fi
  uname -s
}

detect_service_manager() {
  case "$SERVICE_MANAGER" in
    auto)
      if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
        SERVICE_MANAGER="systemd"
      elif command -v rc-service >/dev/null 2>&1 && command -v rc-update >/dev/null 2>&1; then
        SERVICE_MANAGER="openrc"
      else
        echo "systemd or OpenRC is required for the long-running agent service." >&2
        exit 2
      fi
      ;;
    systemd)
      if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
        echo "FLUX_SERVICE_MANAGER=systemd was requested, but a running systemd host is not available." >&2
        exit 2
      fi
      ;;
    openrc)
      if ! command -v rc-service >/dev/null 2>&1 || ! command -v rc-update >/dev/null 2>&1; then
        echo "FLUX_SERVICE_MANAGER=openrc was requested, but rc-service/rc-update is not available." >&2
        exit 2
      fi
      ;;
    *)
      echo "FLUX_SERVICE_MANAGER must be auto, systemd or openrc." >&2
      exit 2
      ;;
  esac
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
  else
    echo unknown
  fi
}

doctor_agent_env() {
  local require_env="${FLUX_DOCTOR_REQUIRE_AGENT_ENV:-1}"
  local missing=""
  [ -n "$PANEL_URL" ] || missing="${missing} FLUX_PANEL_URL"
  [ -n "$SERVER_ID" ] || missing="${missing} FLUX_SERVER_ID"
  [ -n "$AGENT_TOKEN" ] || missing="${missing} FLUX_AGENT_TOKEN"
  if [ -n "$missing" ]; then
    if [ "$require_env" = "1" ]; then
      doctor_item fail "agent-env" "missing:${missing}"
    else
      doctor_item warn "agent-env" "missing:${missing}"
    fi
  else
    doctor_item ok "agent-env" "panel=${PANEL_URL}, server=${SERVER_ID}, token=provided"
  fi
}

run_agent_installer_doctor() {
  local require_service="${FLUX_DOCTOR_REQUIRE_SERVICE_MANAGER:-1}"
  local manager

  echo "Flux agent installer doctor"
  doctor_item ok "os" "$(detect_os_name)"
  doctor_item ok "arch" "$(uname -m)"
  doctor_item ok "package-manager" "$(detect_package_manager)"
  doctor_command bash 1
  doctor_command curl 1
  doctor_command python3 1

  manager="$(detect_service_manager_hint)"
  if [ "$manager" = "unknown" ] && [ "$require_service" = "1" ]; then
    doctor_item fail "service-manager" "running systemd or OpenRC is required for a persistent agent service"
  elif [ "$manager" = "unknown" ]; then
    doctor_item warn "service-manager" "not available in this environment; acceptable for container syntax/preflight tests"
  else
    doctor_item ok "service-manager" "$manager"
  fi

  if [ "$(id -u)" -eq 0 ]; then
    doctor_item ok "root" "running as root"
  else
    doctor_item warn "root" "not root; install requires root"
  fi

  doctor_agent_env

  if [ "$doctor_failed" -eq 0 ]; then
    echo "Agent installer doctor passed."
    return 0
  fi
  echo "Agent installer doctor found blocking issue(s)." >&2
  return 1
}

if [ "$ACTION" = "doctor" ]; then
  run_agent_installer_doctor
  exit $?
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this installer as root." >&2
  exit 2
fi

if [ -z "$PANEL_URL" ] || [ -z "$SERVER_ID" ] || [ -z "$AGENT_TOKEN" ]; then
  echo "FLUX_PANEL_URL, FLUX_SERVER_ID and FLUX_AGENT_TOKEN are required." >&2
  exit 2
fi

install_packages
detect_service_manager
echo "Detected OS: $(detect_os_name)"
echo "Using service manager: ${SERVICE_MANAGER}"

download_agent() {
  if [ -n "$GITHUB_TOKEN" ]; then
    curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" "$SOURCE_URL" -o "$INSTALL_BIN"
  else
    curl -fsSL "$SOURCE_URL" -o "$INSTALL_BIN"
  fi
}

if [ -n "$SOURCE_SCRIPT" ]; then
  if [ ! -f "$SOURCE_SCRIPT" ]; then
    echo "flux-agent.sh not found at ${SOURCE_SCRIPT}" >&2
    exit 2
  fi
  install -m 0755 "$SOURCE_SCRIPT" "$INSTALL_BIN"
else
  download_agent
  chmod 0755 "$INSTALL_BIN"
fi

{
  write_env_line "FLUX_PANEL_URL" "$PANEL_URL"
  write_env_line "FLUX_SERVER_ID" "$SERVER_ID"
  write_env_line "FLUX_AGENT_TOKEN" "$AGENT_TOKEN"
  write_env_line "FLUX_POLL_INTERVAL" "$POLL_INTERVAL"
  write_env_line "FLUX_WORK_DIR" "/var/lib/flux-agent"
  write_env_line "FLUX_HTTP_RETRIES" "$HTTP_RETRIES"
  write_env_line "FLUX_HTTP_BACKOFF_BASE" "$HTTP_BACKOFF_BASE"
  write_env_line "FLUX_HTTP_BACKOFF_MAX" "$HTTP_BACKOFF_MAX"
  write_env_line "FLUX_HTTP_CONNECT_TIMEOUT" "$HTTP_CONNECT_TIMEOUT"
  write_env_line "FLUX_HTTP_MAX_TIME" "$HTTP_MAX_TIME"
  write_env_line "FLUX_TASK_TIMEOUT_SECONDS" "$TASK_TIMEOUT_SECONDS"
  write_env_line "FLUX_TASK_TIMEOUT_KILL_SECONDS" "$TASK_TIMEOUT_KILL_SECONDS"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"

install_systemd_service() {
  cat > "$SYSTEMD_SERVICE_FILE" <<SERVICE
[Unit]
Description=Flux 3x-ui Orchestrator Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=${INSTALL_BIN}
Restart=always
RestartSec=8
User=root
WorkingDirectory=/var/lib/flux-agent

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable flux-agent
  systemctl restart flux-agent
  systemctl --no-pager status flux-agent || true
}

install_openrc_service() {
  cat > "$OPENRC_WRAPPER" <<WRAPPER
#!/usr/bin/env sh
set -a
. "${ENV_FILE}"
set +a
exec "${INSTALL_BIN}"
WRAPPER
  chmod 0755 "$OPENRC_WRAPPER"

  cat > "$OPENRC_SERVICE_FILE" <<SERVICE
#!/sbin/openrc-run
name="Flux 3x-ui Orchestrator Agent"
description="Flux 3x-ui Orchestrator Agent"
command="${OPENRC_WRAPPER}"
command_background="yes"
pidfile="/run/flux-agent.pid"
output_log="/var/log/flux-agent.log"
error_log="/var/log/flux-agent.err"
directory="/var/lib/flux-agent"

depend() {
  need net
  after firewall
}

start_pre() {
  checkpath --directory --mode 0755 /var/lib/flux-agent
}
SERVICE

  chmod 0755 "$OPENRC_SERVICE_FILE"
  rc-update add flux-agent default
  rc-service flux-agent restart
  rc-service flux-agent status || true
}

mkdir -p /var/lib/flux-agent
case "$SERVICE_MANAGER" in
  systemd) install_systemd_service ;;
  openrc) install_openrc_service ;;
esac
