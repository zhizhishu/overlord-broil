#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSION_FILE="${PROJECT_ROOT}/VERSION"
OUTPUT_DIR="${PROJECT_ROOT}/dist/release"
REQUIRE_CLEAN="false"
VERSION=""

usage() {
  cat <<'EOF'
Usage: scripts/build-release-bundle.sh [--version VERSION] [--output-dir DIR] [--require-clean]

Builds a source release bundle for Flux 3x-ui Orchestrator.

The bundle contains tracked project files, docs, installers, compose files,
SQL, workflow definitions and release metadata. It excludes .git, local build
outputs, node_modules, backend target directories and local reference clones.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --require-clean)
      REQUIRE_CLEAN="true"
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
    echo "$1 is required to build the release bundle." >&2
    exit 2
  fi
}

require_command git
require_command tar

if [ -z "$VERSION" ]; then
  if [ ! -f "$VERSION_FILE" ]; then
    echo "VERSION file not found: $VERSION_FILE" >&2
    exit 2
  fi
  VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
fi

if [ -z "$VERSION" ]; then
  echo "Release version is empty." >&2
  exit 2
fi

cd "$PROJECT_ROOT"

if [ "$REQUIRE_CLEAN" = "true" ] && ! git diff --quiet --ignore-submodules --; then
  echo "Working tree has unstaged changes. Commit or stash them before building a clean release bundle." >&2
  exit 1
fi

if [ "$REQUIRE_CLEAN" = "true" ] && ! git diff --cached --quiet --ignore-submodules --; then
  echo "Index has staged changes. Commit or unstage them before building a clean release bundle." >&2
  exit 1
fi

if [ "$REQUIRE_CLEAN" = "true" ] && [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  echo "Working tree has untracked or modified files. Commit, remove or ignore them before building a clean release bundle." >&2
  exit 1
fi

COMMIT="$(git rev-parse --short=12 HEAD)"
BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
BUNDLE_BASENAME="flux-3xui-orchestrator-${VERSION}"
WORK_DIR="$(mktemp -d)"
STAGE_DIR="${WORK_DIR}/${BUNDLE_BASENAME}"
ARCHIVE_NAME="${BUNDLE_BASENAME}.tar.gz"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$OUTPUT_DIR"
git archive --format=tar --prefix="${BUNDLE_BASENAME}/" HEAD | tar -x -C "$WORK_DIR"

cat > "${STAGE_DIR}/RELEASE_MANIFEST.txt" <<EOF
Flux 3x-ui Orchestrator release bundle

Version: ${VERSION}
Git commit: ${COMMIT}
Built at UTC: ${BUILD_TIME}

Primary entrypoints:
- Dockerfile
- docker-compose.yml
- scripts/install-master.sh
- scripts/install-master-bootstrap.sh
- scripts/install-flux-agent.sh
- scripts/install-flux-agent-bootstrap.sh
- docker-compose-v4.yml
- docker-compose-v6.yml
- docker-compose.sqlite.yml
- gost.sql
- README.md
- README.zh-CN.md
- docs/OPERATIONS.md
- docs/RELEASE_NOTES.md

Recommended release gate before publishing:
  bash scripts/release-check.sh --full

Default ports:
- master public entry: 5166
- backend API / agent callback: same flux-master entry, served under /api/v1
- controlled 3x-ui panel default: 5168
- ACME HTTP validation, only when selected: 80

Runtime images:
- ghcr.io/zhizhishu/flux-3xui-orchestrator-master:latest
EOF

tar -czf "$ARCHIVE_PATH" -C "$WORK_DIR" "$BUNDLE_BASENAME"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$OUTPUT_DIR" && sha256sum "$ARCHIVE_NAME" > "${ARCHIVE_NAME}.sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "$OUTPUT_DIR" && shasum -a 256 "$ARCHIVE_NAME" > "${ARCHIVE_NAME}.sha256")
else
  echo "Neither sha256sum nor shasum is available; checksum file was not generated." >&2
fi

echo "Release bundle created:"
echo "  ${ARCHIVE_PATH}"
if [ -f "${ARCHIVE_PATH}.sha256" ]; then
  echo "  ${ARCHIVE_PATH}.sha256"
fi
