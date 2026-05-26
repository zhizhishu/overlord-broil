#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCHEMA_FILE="${PROJECT_ROOT}/springboot-backend/src/main/resources/schema-sqlite.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "SQLite schema not found: ${SCHEMA_FILE}" >&2
  exit 2
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

docker run --rm \
  -v "${SCHEMA_FILE}:/schema-sqlite.sql:ro" \
  -v "${TMP_DIR}:/work" \
  -w /work \
  python:3.12-alpine \
  python - <<'PY'
import sqlite3
from pathlib import Path

schema = Path("/schema-sqlite.sql").read_text(encoding="utf-8")
db_path = Path("/work/flux-master.sqlite")

conn = sqlite3.connect(db_path)
try:
    conn.executescript(schema)
    conn.executescript(schema)
    tables = {
        row[0]
        for row in conn.execute(
            "select name from sqlite_master where type='table' and name not like 'sqlite_%'"
        )
    }
    required = {
        "forward",
        "node",
        "control_server",
        "protocol_profile",
        "protocol_node",
        "server_forward_rule",
        "deploy_task",
        "monitor_alert",
        "three_xui_traffic_snapshot",
        "speed_limit",
        "statistics_flow",
        "tunnel",
        "user",
        "user_tunnel",
        "vite_config",
    }
    missing = sorted(required - tables)
    if missing:
        raise SystemExit(f"missing tables: {', '.join(missing)}")
    user_count = conn.execute("select count(*) from user where user = 'admin_user'").fetchone()[0]
    vite_count = conn.execute("select count(*) from vite_config where name = 'app_name'").fetchone()[0]
    if user_count != 1:
        raise SystemExit(f"expected one default admin_user row, got {user_count}")
    if vite_count != 1:
        raise SystemExit(f"expected one app_name config row, got {vite_count}")
finally:
    conn.close()
PY

echo "SQLite schema smoke test passed"
