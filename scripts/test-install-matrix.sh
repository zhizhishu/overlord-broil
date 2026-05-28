#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGES=(
  "debian:12-slim"
  "ubuntu:24.04"
  "alpine:3.20"
  "rockylinux:9"
  "oraclelinux:9-slim"
)
CUSTOM_IMAGES=()

usage() {
  cat <<'EOF'
Usage: scripts/test-install-matrix.sh [--image IMAGE]...

Runs non-destructive installer diagnostics in Linux containers. The matrix
validates the current checkout on Debian, Ubuntu, Alpine, Rocky Linux and
Oracle Linux style userspaces without starting Docker, systemd, OpenRC or the node service.

Set OB_INSTALL_MATRIX_SKIP_PULL=true to skip docker pull.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --image)
      CUSTOM_IMAGES+=("${2:?missing value for --image}")
      shift 2
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

if [ "${#CUSTOM_IMAGES[@]}" -gt 0 ]; then
  IMAGES=("${CUSTOM_IMAGES[@]}")
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is required for install matrix tests." >&2
    exit 2
  fi
}

container_script='
set -eu

install_rpm_deps() {
  installer="$1"
  packages="ca-certificates"
  command -v bash >/dev/null 2>&1 || packages="$packages bash"
  command -v curl >/dev/null 2>&1 || packages="$packages curl"
  command -v python3 >/dev/null 2>&1 || packages="$packages python3"
  command -v tar >/dev/null 2>&1 || packages="$packages tar"
  $installer install -y $packages
}

install_deps() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates bash curl python3 tar
  elif command -v dnf >/dev/null 2>&1; then
    install_rpm_deps dnf
  elif command -v yum >/dev/null 2>&1; then
    install_rpm_deps yum
  elif command -v microdnf >/dev/null 2>&1; then
    install_rpm_deps microdnf
    microdnf clean all || true
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache ca-certificates bash curl python3 tar iproute2
  else
    echo "No supported package manager in test image." >&2
    exit 2
  fi
}

install_deps
cd /workspace

bash -n scripts/install-master.sh scripts/install-agent.sh scripts/overlord-agent.sh
sh -n scripts/install-master-bootstrap.sh scripts/install-agent-bootstrap.sh

OB_DOCTOR_REQUIRE_DOCKER=0 \
OB_DOCTOR_SKIP_PORT_CHECK=1 \
OB_FRONTEND_PORT=18080 \
OB_BACKEND_PORT=16365 \
OB_EXPOSE_BACKEND=0 \
  bash scripts/install-master.sh doctor

OB_DOCTOR_REQUIRE_SERVICE_MANAGER=0 \
OB_DOCTOR_REQUIRE_AGENT_ENV=0 \
  bash scripts/install-agent.sh doctor

OB_MASTER_URL=http://127.0.0.1:18080 \
OB_SERVER_ID=1 \
OB_AGENT_TOKEN=test-token \
OB_WORK_DIR=/tmp/overlord-agent-work \
OB_AGENT_LOCK_FILE=/tmp/overlord-agent.lock \
OB_POLL_INTERVAL=1 \
OB_HTTP_RETRIES=1 \
OB_HTTP_CONNECT_TIMEOUT=1 \
OB_HTTP_MAX_TIME=1 \
  bash scripts/overlord-agent.sh --doctor
'

require_command docker

for image in "${IMAGES[@]}"; do
  echo
  echo "==> Install matrix: ${image}"
  if [ "${OB_INSTALL_MATRIX_SKIP_PULL:-false}" != "true" ]; then
    docker pull "$image"
  fi
  docker run --rm \
    -v "${PROJECT_ROOT}:/workspace:ro" \
    "$image" \
    sh -c "$container_script"
done

echo
echo "Install matrix diagnostics passed."
