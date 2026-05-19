#!/usr/bin/env bash
set -euo pipefail

PANEL_URL="${FLUX_PANEL_URL:-}"
SERVER_ID="${FLUX_SERVER_ID:-}"
AGENT_TOKEN="${FLUX_AGENT_TOKEN:-}"
WORK_DIR="${FLUX_WORK_DIR:-/var/lib/flux-agent}"
POLL_INTERVAL="${FLUX_POLL_INTERVAL:-20}"
RUN_ONCE="${1:-}"

if [ -z "$PANEL_URL" ] || [ -z "$SERVER_ID" ] || [ -z "$AGENT_TOKEN" ]; then
  echo "FLUX_PANEL_URL, FLUX_SERVER_ID and FLUX_AGENT_TOKEN are required." >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for JSON parsing." >&2
  exit 2
fi

mkdir -p "$WORK_DIR"
PANEL_URL="${PANEL_URL%/}"

post_json() {
  local path="$1"
  local payload="$2"
  curl -fsS \
    -H "Content-Type: application/json" \
    -H "X-Agent-Token: ${AGENT_TOKEN}" \
    -X POST "${PANEL_URL}${path}" \
    --data "$payload"
}

json_get() {
  local expr="$1"
  python3 -c '
import json
import sys

expr = sys.argv[1]
data = json.load(sys.stdin)
value = data
for part in expr.split("."):
    if not part:
        continue
    if isinstance(value, dict):
        value = value.get(part)
    else:
        value = None
        break
if value is None:
    sys.exit(1)
if isinstance(value, (dict, list)):
    print(json.dumps(value, ensure_ascii=False))
else:
    print(value)
' "$expr"
}

json_payload() {
  python3 - "$@" <<'PY'
import json
import sys
from pathlib import Path

task_id = int(sys.argv[1])
state = sys.argv[2]
exit_code = None if sys.argv[3] == "" else int(sys.argv[3])
stdout_path = Path(sys.argv[4]) if sys.argv[4] else None
stderr_path = Path(sys.argv[5]) if sys.argv[5] else None

def read_limited(path):
    if path is None or not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    return text[-60000:]

print(json.dumps({
    "taskId": task_id,
    "state": state,
    "exitCode": exit_code,
    "stdout": read_limited(stdout_path),
    "stderr": read_limited(stderr_path),
}, ensure_ascii=False))
PY
}

report_state() {
  local task_id="$1"
  local state="$2"
  local exit_code="${3:-}"
  local stdout_path="${4:-}"
  local stderr_path="${5:-}"
  local payload
  payload="$(json_payload "$task_id" "$state" "$exit_code" "$stdout_path" "$stderr_path")"
  post_json "/api/v1/agent-task/report" "$payload" >/dev/null
}

claim_task() {
  post_json "/api/v1/agent-task/claim" "{\"serverId\":${SERVER_ID}}"
}

run_task() {
  local response="$1"
  local task_id script task_file stdout_file stderr_file exit_code

  task_id="$(printf '%s' "$response" | json_get "data.id" || true)"
  if [ -z "$task_id" ]; then
    return 1
  fi

  script="$(printf '%s' "$response" | json_get "data.script")"
  task_file="${WORK_DIR}/task-${task_id}.sh"
  stdout_file="${WORK_DIR}/task-${task_id}.out"
  stderr_file="${WORK_DIR}/task-${task_id}.err"

  printf '%s\n' "$script" > "$task_file"
  chmod 700 "$task_file"

  report_state "$task_id" "running"
  set +e
  bash "$task_file" >"$stdout_file" 2>"$stderr_file"
  exit_code=$?
  set -e

  if [ "$exit_code" -eq 0 ]; then
    report_state "$task_id" "succeeded" "$exit_code" "$stdout_file" "$stderr_file"
  else
    report_state "$task_id" "failed" "$exit_code" "$stdout_file" "$stderr_file"
  fi
}

while true; do
  response="$(claim_task || true)"
  if [ -n "$response" ]; then
    run_task "$response" || true
  fi

  if [ "$RUN_ONCE" = "--once" ]; then
    break
  fi
  sleep "$POLL_INTERVAL"
done
