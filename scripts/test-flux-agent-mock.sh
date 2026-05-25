#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PYTHON_BIN="${FLUX_TEST_PYTHON_BIN:-}"

detect_python() {
  if [ -n "$PYTHON_BIN" ]; then
    "$PYTHON_BIN" -c 'import json, pathlib' >/dev/null 2>&1
    return
  fi

  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import json, pathlib' >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      return
    fi
  done

  echo "python3 or python is required for agent mock tests." >&2
  exit 2
}

cleanup_tmp_dir() {
  [ -n "${TMP_DIR:-}" ] || return 0
  [ -d "$TMP_DIR" ] || return 0

  local attempt
  for attempt in 1 2 3 4 5; do
    rm -rf "$TMP_DIR" 2>/dev/null && return 0
    sleep 0.2
  done

  echo "warning: could not remove temporary test directory ${TMP_DIR}; continuing" >&2
  return 0
}

run_case() {
  local label="$1"
  local task_script="$2"
  local timeout_seconds="$3"
  local expected_state="$4"
  local expected_exit_code="$5"
  local expected_timed_out="$6"

  local case_dir="${TMP_DIR}/${label}"
  local server_script="${case_dir}/mock_server.py"
  local ready_file="${case_dir}/ready.txt"
  local reports_file="${case_dir}/reports.jsonl"
  local heartbeats_file="${case_dir}/heartbeats.jsonl"
  local server_pid=""

  mkdir -p "$case_dir"
  cat > "$server_script" <<'PY'
import json
import os
import pathlib
from http.server import BaseHTTPRequestHandler, HTTPServer

reports_path = pathlib.Path(os.environ["REPORTS_FILE"])
heartbeats_path = pathlib.Path(os.environ["HEARTBEATS_FILE"])
ready_path = pathlib.Path(os.environ["READY_FILE"])
task_script = os.environ["TASK_SCRIPT"]
claimed = False

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_POST(self):
        global claimed
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length).decode("utf-8") if length else ""

        if self.path == "/api/v1/control-server/heartbeat":
            with heartbeats_path.open("a", encoding="utf-8") as fh:
                fh.write(body + "\n")
            self._send({"success": True, "data": None})
            return

        if self.path == "/api/v1/agent-task/claim":
            if claimed:
                self._send({"success": True, "data": None})
            else:
                claimed = True
                self._send({"success": True, "data": {
                    "id": 101,
                    "script": task_script,
                    "runtimeProvider": {
                        "key": "snell",
                        "name": "Snell Runtime",
                        "protocol": "snell",
                        "action": "present",
                        "executor": "flux-agent",
                        "stateSource": "agent-report",
                        "agentRequired": True,
                        "masterApiSupported": False,
                        "nanoSupported": True,
                        "capabilities": ["install-snell", "restart-service"],
                        "relatedProviders": ["firewall"],
                    },
                }})
            return

        if self.path == "/api/v1/agent-task/report":
            with reports_path.open("a", encoding="utf-8") as fh:
                fh.write(body + "\n")
            self._send({"success": True, "data": None})
            return

        self.send_response(404)
        self.end_headers()

    def _send(self, payload):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

server = HTTPServer(("127.0.0.1", 0), Handler)
ready_path.write_text(str(server.server_address[1]), encoding="utf-8")
server.serve_forever()
PY

  REPORTS_FILE="$reports_file" HEARTBEATS_FILE="$heartbeats_file" READY_FILE="$ready_file" TASK_SCRIPT="$task_script" "$PYTHON_BIN" "$server_script" &
  server_pid="$!"
  trap 'if [ -n "${server_pid:-}" ]; then kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; fi' RETURN

  local i
  for i in $(seq 1 100); do
    [ -f "$ready_file" ] && break
    sleep 0.1
  done
  if [ ! -f "$ready_file" ]; then
    echo "mock server for ${label} did not become ready." >&2
    exit 1
  fi

  local port
  port="$(cat "$ready_file")"

  FLUX_PANEL_URL="http://127.0.0.1:${port}" \
  FLUX_SERVER_ID="1" \
  FLUX_AGENT_TOKEN="test-agent-token" \
  FLUX_WORK_DIR="${case_dir}/work" \
  FLUX_AGENT_LOCK_FILE="${case_dir}/agent.lock" \
  FLUX_HTTP_RETRIES="1" \
  FLUX_HTTP_CONNECT_TIMEOUT="2" \
  FLUX_HTTP_MAX_TIME="5" \
  FLUX_TASK_TIMEOUT_SECONDS="$timeout_seconds" \
  FLUX_TASK_TIMEOUT_KILL_SECONDS="1" \
    bash "${PROJECT_ROOT}/scripts/flux-agent.sh" --once

  "$PYTHON_BIN" - "$reports_file" "$expected_state" "$expected_exit_code" "$expected_timed_out" <<'PY'
import json
import pathlib
import sys

reports_path = pathlib.Path(sys.argv[1])
expected_state = sys.argv[2]
expected_exit_code = None if sys.argv[3] == "none" else int(sys.argv[3])
expected_timed_out = sys.argv[4].lower() == "true"

reports = [
    json.loads(line)
    for line in reports_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
]
final_reports = [report for report in reports if report.get("state") != "running"]
if not final_reports:
    raise SystemExit("no final report captured")

final = final_reports[-1]
result = json.loads(final.get("resultJson") or "{}")
for report in reports:
    report_result = json.loads(report.get("resultJson") or "{}")
    provider = report_result.get("runtimeProvider") or {}
    if provider.get("key") != "snell":
        raise SystemExit(f"report missing runtimeProvider snell metadata: {report_result}")

if final.get("state") != expected_state:
    raise SystemExit(f"expected state {expected_state}, got {final.get('state')}: {final}")
if expected_exit_code is not None and final.get("exitCode") != expected_exit_code:
    raise SystemExit(f"expected exitCode {expected_exit_code}, got {final.get('exitCode')}: {final}")
if bool(result.get("timedOut")) != expected_timed_out:
    raise SystemExit(f"expected timedOut {expected_timed_out}, got {result.get('timedOut')}: {result}")

print(json.dumps({
    "state": final.get("state"),
    "exitCode": final.get("exitCode"),
    "timedOut": result.get("timedOut"),
    "reports": len(reports),
}, ensure_ascii=False))
PY

  "$PYTHON_BIN" - "$heartbeats_file" <<'PY'
import json
import pathlib
import sys

heartbeats_path = pathlib.Path(sys.argv[1])
heartbeats = [
    json.loads(line)
    for line in heartbeats_path.read_text(encoding="utf-8").splitlines()
    if line.strip()
]
if not heartbeats:
    raise SystemExit("no heartbeat captured")

heartbeat = heartbeats[-1]
if "memoryTotalMb" not in heartbeat:
    raise SystemExit(f"heartbeat missing memoryTotalMb: {heartbeat}")
if "lowMemoryMode" not in heartbeat:
    raise SystemExit(f"heartbeat missing lowMemoryMode: {heartbeat}")
if "lowMemoryProfile" not in heartbeat:
    raise SystemExit(f"heartbeat missing lowMemoryProfile: {heartbeat}")
if heartbeat["memoryTotalMb"] is not None and heartbeat["memoryTotalMb"] < 256:
    if not heartbeat.get("lowMemoryAdvice"):
        raise SystemExit(f"low-memory heartbeat missing advice: {heartbeat}")

print(json.dumps({
    "memoryTotalMb": heartbeat.get("memoryTotalMb"),
    "lowMemoryMode": heartbeat.get("lowMemoryMode"),
    "lowMemoryProfile": heartbeat.get("lowMemoryProfile"),
}, ensure_ascii=False))
PY

  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  server_pid=""
  trap - RETURN
}

detect_python
TMP_DIR="$(mktemp -d)"
trap cleanup_tmp_dir EXIT

FLUX_PANEL_URL="http://127.0.0.1:1" \
FLUX_SERVER_ID="1" \
FLUX_AGENT_TOKEN="test-agent-token" \
FLUX_WORK_DIR="${TMP_DIR}/doctor-work" \
FLUX_AGENT_LOCK_FILE="${TMP_DIR}/doctor.lock" \
  bash "${PROJECT_ROOT}/scripts/flux-agent.sh" --doctor >/dev/null

run_case "success" $'echo hello-agent\nprintf "%s\\n" '\''FLUX_AGENT_RESULT_JSON={"node":"ok"}'\''' "10" "succeeded" "0" "false"
run_case "timeout" $'sleep 5\necho should-not-finish' "1" "failed" "124" "true"

echo "flux-agent mock tests passed"
