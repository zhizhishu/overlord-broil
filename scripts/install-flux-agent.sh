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
SERVICE_FILE="${FLUX_AGENT_SERVICE:-/etc/systemd/system/flux-agent.service}"
REPO_RAW_URL="${FLUX_REPO_RAW_URL:-https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main}"
SOURCE_URL="${FLUX_AGENT_SOURCE_URL:-${REPO_RAW_URL}/scripts/flux-agent.sh}"
SOURCE_SCRIPT="${1:-}"
GITHUB_TOKEN="${FLUX_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"

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
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache ca-certificates "${missing[@]}"
  else
    echo "Missing dependencies: ${missing[*]}. Please install them first." >&2
    exit 2
  fi
}

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this installer as root." >&2
  exit 2
fi

if [ -z "$PANEL_URL" ] || [ -z "$SERVER_ID" ] || [ -z "$AGENT_TOKEN" ]; then
  echo "FLUX_PANEL_URL, FLUX_SERVER_ID and FLUX_AGENT_TOKEN are required." >&2
  exit 2
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd is required for the long-running agent service." >&2
  exit 2
fi

install_packages

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

cat > "$SERVICE_FILE" <<SERVICE
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

mkdir -p /var/lib/flux-agent
systemctl daemon-reload
systemctl enable flux-agent
systemctl restart flux-agent
systemctl --no-pager status flux-agent || true
