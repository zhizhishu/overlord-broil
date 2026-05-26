#!/bin/sh
set -eu

REPO="${OB_REPO:-zhizhishu/overlord-broil}"
REF="${OB_REF:-main}"
RAW_BASE="${OB_RAW_BASE:-https://raw.githubusercontent.com/${REPO}/${REF}}"
GITHUB_TOKEN="${OB_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"
INSTALLER="/tmp/overlord-install-master.sh"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run this bootstrap as root." >&2
  exit 2
fi

install_base_packages() {
  if command -v bash >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates bash curl
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y ca-certificates bash curl
  elif command -v yum >/dev/null 2>&1; then
    yum install -y ca-certificates bash curl
  elif command -v microdnf >/dev/null 2>&1; then
    microdnf install -y ca-certificates bash curl
    microdnf clean all || true
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache ca-certificates bash curl
  else
    echo "bash and curl are required. Please install them first." >&2
    exit 2
  fi
}

download_installer() {
  if [ -n "$GITHUB_TOKEN" ]; then
    curl -fsSL --retry 3 -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      "${RAW_BASE}/scripts/install-master.sh" -o "$INSTALLER"
  else
    curl -fsSL --retry 3 "${RAW_BASE}/scripts/install-master.sh" -o "$INSTALLER"
  fi
  chmod 0755 "$INSTALLER"
}

install_base_packages
download_installer
exec bash "$INSTALLER" "$@"
