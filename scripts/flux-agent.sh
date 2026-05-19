#!/usr/bin/env bash
set -euo pipefail

PANEL_URL="${FLUX_PANEL_URL:-}"
SERVER_ID="${FLUX_SERVER_ID:-}"
AGENT_TOKEN="${FLUX_AGENT_TOKEN:-}"
WORK_DIR="${FLUX_WORK_DIR:-/var/lib/flux-agent}"
POLL_INTERVAL="${FLUX_POLL_INTERVAL:-20}"
AGENT_VERSION="${FLUX_AGENT_VERSION:-flux-agent/0.2}"
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

stdout_text = read_limited(stdout_path)
stderr_text = read_limited(stderr_path)
marker_prefix = "FLUX_AGENT_RESULT_JSON="
result_json = None
clean_stdout_lines = []
for line in stdout_text.splitlines():
    if line.startswith(marker_prefix):
        raw = line[len(marker_prefix):]
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {"metadataParseError": raw}
        result["exitCode"] = exit_code
        result["stdout"] = "\n".join(clean_stdout_lines)[-60000:]
        result["stderr"] = stderr_text[-60000:]
        result_json = json.dumps(result, ensure_ascii=False)
    else:
        clean_stdout_lines.append(line)

print(json.dumps({
    "taskId": task_id,
    "state": state,
    "exitCode": exit_code,
    "stdout": "\n".join(clean_stdout_lines)[-60000:],
    "stderr": stderr_text,
    "resultJson": result_json,
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

command_output() {
  local cmd="$1"
  sh -c "$cmd" 2>/dev/null | head -n 1 || true
}

memory_usage() {
  awk '
    /^MemTotal:/ { total=$2 }
    /^MemAvailable:/ { available=$2 }
    END {
      if (total > 0) {
        printf "%.2f", ((total - available) * 100 / total)
      }
    }
  ' /proc/meminfo 2>/dev/null || true
}

cpu_usage() {
  awk '
    /^cpu / {
      idle=$5
      total=0
      for (i=2; i<=NF; i++) total += $i
      if (total > 0) {
        printf "%.2f", ((total - idle) * 100 / total)
      }
    }
  ' /proc/stat 2>/dev/null || true
}

net_bytes() {
  awk '
    NR > 2 {
      gsub(":", "", $1)
      rx += $2
      tx += $10
    }
    END {
      printf "%d %d", rx, tx
    }
  ' /proc/net/dev 2>/dev/null || printf "0 0"
}

service_status() {
  local service="$1"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl is-active "$service" 2>/dev/null || true
  fi
}

xray_status() {
  if pgrep -fa '[x]ray' >/dev/null 2>&1; then
    echo active
  else
    echo inactive
  fi
}

certificate_json() {
  local cert_file=""
  for candidate in /root/cert/flux-panel/fullchain.pem /root/cert/*/fullchain.pem /etc/letsencrypt/live/*/fullchain.pem; do
    if [ -f "$candidate" ]; then
      cert_file="$candidate"
      break
    fi
  done

  if [ -z "$cert_file" ]; then
    printf '{}'
    return
  fi

  local cert_text
  cert_text="$(openssl x509 -noout -subject -enddate -in "$cert_file" 2>/dev/null || true)"
  CERT_TEXT="$cert_text" python3 - "$cert_file" <<'PY' || printf '{}'
import datetime
import email.utils
import json
import os
import re
import sys
import time

cert_file = sys.argv[1]
text = os.environ.get("CERT_TEXT", "")
subject = ""
expires = ""
for line in text.splitlines():
    if line.startswith("subject="):
        subject = line
    if line.startswith("notAfter="):
        expires = line.split("=", 1)[1].strip()

domain = None
match = re.search(r"CN\\s*=\\s*([^,/]+)", subject)
if match:
    domain = match.group(1).strip()

expire_at = None
status = "unreadable"
if expires:
    try:
        expire_at = int(email.utils.parsedate_to_datetime(expires).timestamp() * 1000)
        now = int(time.time() * 1000)
        if expire_at <= now:
            status = "expired"
        elif expire_at <= now + 30 * 24 * 60 * 60 * 1000:
            status = "expiring"
        else:
            status = "valid"
    except Exception:
        status = "unreadable"

print(json.dumps({
    "certificateDomain": domain,
    "certificateStatus": status,
    "certificateExpireAt": expire_at,
    "certificateFile": cert_file,
}, ensure_ascii=False))
PY
}

heartbeat_payload() {
  local last_error="$1"
  local xray_version snell_version cpu mem_usage net rx tx xui_service xray_service snell_service cert_json
  xray_version="$(command_output 'for f in /usr/local/x-ui/bin/xray-linux-* /usr/local/x-ui/bin/xray $(command -v xray 2>/dev/null); do [ -x "$f" ] && "$f" version && exit 0; done')"
  snell_version="$(command_output 'command -v snell-server >/dev/null 2>&1 && snell-server -v')"
  cpu="$(cpu_usage)"
  mem_usage="$(memory_usage)"
  net="$(net_bytes)"
  rx="${net%% *}"
  tx="${net##* }"
  xui_service="$(service_status x-ui)"
  xray_service="$(xray_status)"
  snell_service="$(service_status snell)"
  cert_json="$(certificate_json)"
  python3 - "$SERVER_ID" "$AGENT_VERSION" "$xray_version" "$snell_version" "$cpu" "$mem_usage" "$rx" "$tx" "$xui_service" "$xray_service" "$snell_service" "$last_error" "$cert_json" <<'PY'
import json
import sys

def as_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0

payload = {
    "serverId": int(sys.argv[1]),
    "agentVersion": sys.argv[2],
    "xrayVersion": sys.argv[3] or None,
    "snellVersion": sys.argv[4] or None,
    "cpuUsage": as_float(sys.argv[5]),
    "memoryUsage": as_float(sys.argv[6]),
    "downloadTraffic": as_int(sys.argv[7]),
    "uploadTraffic": as_int(sys.argv[8]),
    "xuiServiceStatus": sys.argv[9] or None,
    "xrayServiceStatus": sys.argv[10] or None,
    "snellServiceStatus": sys.argv[11] or None,
    "lastError": sys.argv[12] or None,
}
try:
    cert = json.loads(sys.argv[13] or "{}")
except json.JSONDecodeError:
    cert = {}
for key in ("certificateDomain", "certificateStatus", "certificateExpireAt"):
    if cert.get(key) is not None:
        payload[key] = cert[key]
print(json.dumps(payload, ensure_ascii=False))
PY
}

send_heartbeat() {
  local last_error="${1:-}"
  post_json "/api/v1/control-server/heartbeat" "$(heartbeat_payload "$last_error")" >/dev/null || true
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
    send_heartbeat ""
  else
    report_state "$task_id" "failed" "$exit_code" "$stdout_file" "$stderr_file"
    send_heartbeat "task ${task_id} failed with exit code ${exit_code}"
  fi
}

while true; do
  send_heartbeat ""
  response="$(claim_task || true)"
  if [ -n "$response" ]; then
    run_task "$response" || true
  fi

  if [ "$RUN_ONCE" = "--once" ]; then
    break
  fi
  sleep "$POLL_INTERVAL"
done
