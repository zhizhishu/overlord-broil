#!/bin/sh
set -eu

REPO="${FLUX_REPO:-zhizhishu/flux-3xui-orchestrator}"
REF="${FLUX_REF:-main}"
RAW_BASE="${FLUX_RAW_BASE:-https://raw.githubusercontent.com/${REPO}/${REF}}"
GITHUB_TOKEN="${FLUX_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"
INSTALLER="/tmp/flux-install-agent.sh"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this bootstrap as root." >&2
  exit 2
fi

install_base_packages() {
  if command -v bash >/dev/null 2>&1 && command -v curl >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates bash curl python3
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y ca-certificates bash curl python3
  elif command -v yum >/dev/null 2>&1; then
    yum install -y ca-certificates bash curl python3
  elif command -v microdnf >/dev/null 2>&1; then
    microdnf install -y ca-certificates bash curl python3
    microdnf clean all || true
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache ca-certificates bash curl python3
  else
    echo "bash, curl and python3 are required. Please install them first." >&2
    exit 2
  fi
}

download_installer() {
  if [ -n "$GITHUB_TOKEN" ]; then
    curl -fsSL --retry 3 -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      "${RAW_BASE}/scripts/install-flux-agent.sh" -o "$INSTALLER"
  else
    curl -fsSL --retry 3 "${RAW_BASE}/scripts/install-flux-agent.sh" -o "$INSTALLER"
  fi
  chmod 0755 "$INSTALLER"
}

install_base_packages
download_installer
exec bash "$INSTALLER" "$@"
