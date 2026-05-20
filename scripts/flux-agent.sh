#!/usr/bin/env bash
set -euo pipefail

PANEL_URL="${FLUX_PANEL_URL:-}"
SERVER_ID="${FLUX_SERVER_ID:-}"
AGENT_TOKEN="${FLUX_AGENT_TOKEN:-}"
WORK_DIR="${FLUX_WORK_DIR:-/var/lib/flux-agent}"
LOCK_FILE="${FLUX_AGENT_LOCK_FILE:-${WORK_DIR}/flux-agent.lock}"
POLL_INTERVAL="${FLUX_POLL_INTERVAL:-20}"
AGENT_VERSION="${FLUX_AGENT_VERSION:-flux-agent/0.2}"
HTTP_RETRIES="${FLUX_HTTP_RETRIES:-4}"
HTTP_BACKOFF_BASE="${FLUX_HTTP_BACKOFF_BASE:-2}"
HTTP_BACKOFF_MAX="${FLUX_HTTP_BACKOFF_MAX:-30}"
HTTP_CONNECT_TIMEOUT="${FLUX_HTTP_CONNECT_TIMEOUT:-10}"
HTTP_MAX_TIME="${FLUX_HTTP_MAX_TIME:-60}"
TASK_TIMEOUT_SECONDS="${FLUX_TASK_TIMEOUT_SECONDS:-7200}"
TASK_TIMEOUT_KILL_SECONDS="${FLUX_TASK_TIMEOUT_KILL_SECONDS:-30}"
RUN_ONCE="${1:-}"
PYTHON_BIN="${FLUX_PYTHON_BIN:-}"
BASH_BIN="${FLUX_BASH_BIN:-}"
FALLBACK_LOCK_DIR=""

log() {
  local level="$1"
  shift
  printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$level" "$*" >&2
}

info() { log info "$*"; }
warn() { log warn "$*"; }
error() { log error "$*"; }

now_ms() {
  "$PYTHON_BIN" - <<'PY'
import time
print(int(time.time() * 1000))
PY
}

detect_python() {
  if [ -n "$PYTHON_BIN" ]; then
    if command -v "$PYTHON_BIN" >/dev/null 2>&1 && "$PYTHON_BIN" -c 'import json, time' >/dev/null 2>&1; then
      return
    fi
    error "FLUX_PYTHON_BIN must point to a working Python interpreter."
    exit 2
  fi

  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import json, time' >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      return
    fi
  done

  error "python3 or python is required for JSON parsing."
  exit 2
}

validate_bash_bin() {
  local candidate="$1"
  [ -n "$candidate" ] || return 1
  "$PYTHON_BIN" - "$candidate" <<'PY'
import subprocess
import sys

try:
    subprocess.run(
        [sys.argv[1], "-c", "exit 0"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )
except Exception:
    sys.exit(1)
PY
}

detect_bash() {
  local candidate=""

  if [ -n "$BASH_BIN" ]; then
    if validate_bash_bin "$BASH_BIN"; then
      return
    fi
    error "FLUX_BASH_BIN must point to a working bash executable."
    exit 2
  fi

  if command -v bash >/dev/null 2>&1; then
    candidate="$(command -v bash)"
    if validate_bash_bin "$candidate"; then
      BASH_BIN="$candidate"
      return
    fi
    if command -v cygpath >/dev/null 2>&1; then
      candidate="$(cygpath -w "$candidate" 2>/dev/null || true)"
      if validate_bash_bin "$candidate"; then
        BASH_BIN="$candidate"
        return
      fi
    fi
  fi

  for candidate in /bin/bash /usr/bin/bash "C:/Program Files/Git/bin/bash.exe" "C:/Program Files/Git/usr/bin/bash.exe"; do
    if validate_bash_bin "$candidate"; then
      BASH_BIN="$candidate"
      return
    fi
  done

  error "bash is required for task execution."
  exit 2
}

require_positive_int() {
  local name="$1"
  local value="$2"
  case "$value" in
    ''|*[!0-9]*)
      error "${name} must be a positive integer."
      exit 2
      ;;
  esac
  if [ "$value" -lt 1 ]; then
    error "${name} must be a positive integer."
    exit 2
  fi
}

if [ -z "$PANEL_URL" ] || [ -z "$SERVER_ID" ] || [ -z "$AGENT_TOKEN" ]; then
  error "FLUX_PANEL_URL, FLUX_SERVER_ID and FLUX_AGENT_TOKEN are required."
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  error "curl is required."
  exit 2
fi

detect_python
detect_bash

require_positive_int "FLUX_POLL_INTERVAL" "$POLL_INTERVAL"
require_positive_int "FLUX_HTTP_RETRIES" "$HTTP_RETRIES"
require_positive_int "FLUX_HTTP_BACKOFF_BASE" "$HTTP_BACKOFF_BASE"
require_positive_int "FLUX_HTTP_BACKOFF_MAX" "$HTTP_BACKOFF_MAX"
require_positive_int "FLUX_HTTP_CONNECT_TIMEOUT" "$HTTP_CONNECT_TIMEOUT"
require_positive_int "FLUX_HTTP_MAX_TIME" "$HTTP_MAX_TIME"
require_positive_int "FLUX_TASK_TIMEOUT_SECONDS" "$TASK_TIMEOUT_SECONDS"
require_positive_int "FLUX_TASK_TIMEOUT_KILL_SECONDS" "$TASK_TIMEOUT_KILL_SECONDS"

mkdir -p "$WORK_DIR"
PANEL_URL="${PANEL_URL%/}"

acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
      warn "another flux-agent instance is already running on this host; exiting"
      exit 0
    fi
    printf '%s\n' "$$" 1>&9
    return
  fi

  local lock_dir="${LOCK_FILE}.d"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    warn "another flux-agent instance is already running on this host; exiting"
    exit 0
  fi
  FALLBACK_LOCK_DIR="$lock_dir"
  printf '%s\n' "$$" > "${lock_dir}/pid"
  trap 'rm -rf "$FALLBACK_LOCK_DIR"' EXIT INT TERM
}

post_json_once() {
  local path="$1"
  local payload="$2"
  curl -fsS \
    --connect-timeout "$HTTP_CONNECT_TIMEOUT" \
    --max-time "$HTTP_MAX_TIME" \
    -H "Content-Type: application/json" \
    -H "X-Agent-Token: ${AGENT_TOKEN}" \
    -X POST "${PANEL_URL}${path}" \
    --data "$payload"
}

post_json() {
  local path="$1"
  local payload="$2"
  local label="${3:-request}"
  local attempt=1
  local delay="$HTTP_BACKOFF_BASE"
  local response=""

  while [ "$attempt" -le "$HTTP_RETRIES" ]; do
    set +e
    response="$(post_json_once "$path" "$payload")"
    local rc=$?
    set -e
    if [ "$rc" -eq 0 ]; then
      printf '%s' "$response"
      return 0
    fi
    if [ "$attempt" -ge "$HTTP_RETRIES" ]; then
      error "${label} failed after ${attempt} attempt(s)"
      return "$rc"
    fi
    warn "${label} failed (attempt ${attempt}/${HTTP_RETRIES}); retrying in ${delay}s"
    sleep "$delay"
    delay=$((delay * 2))
    if [ "$delay" -gt "$HTTP_BACKOFF_MAX" ]; then
      delay="$HTTP_BACKOFF_MAX"
    fi
    attempt=$((attempt + 1))
  done
}

json_get() {
  local expr="$1"
  "$PYTHON_BIN" -c '
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

build_report_payload() {
  local task_id="$1"
  local state="$2"
  local exit_code="${3:-}"
  local timed_out="${4:-0}"
  local timeout_seconds="${5:-0}"
  local started_at="${6:-}"
  local finished_at="${7:-}"
  local stdout_path="${8:-}"
  local stderr_path="${9:-}"

  "$PYTHON_BIN" - "$task_id" "$state" "$exit_code" "$timed_out" "$timeout_seconds" "$started_at" "$finished_at" "$stdout_path" "$stderr_path" <<'PY'
import json
import sys
from pathlib import Path

task_id = int(sys.argv[1])
state = sys.argv[2]
exit_code = None if sys.argv[3] == "" else int(sys.argv[3])
timed_out = sys.argv[4] == "1"
timeout_seconds = int(sys.argv[5] or "0")
started_at = None if sys.argv[6] == "" else int(sys.argv[6])
finished_at = None if sys.argv[7] == "" else int(sys.argv[7])
stdout_path = Path(sys.argv[8]) if sys.argv[8] else None
stderr_path = Path(sys.argv[9]) if sys.argv[9] else None

def read_limited(path):
    if path is None or not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    return text[-60000:]

stdout_text = read_limited(stdout_path)
stderr_text = read_limited(stderr_path)
marker_prefix = "FLUX_AGENT_RESULT_JSON="
result = None
clean_stdout_lines = []
for line in stdout_text.splitlines():
    if line.startswith(marker_prefix):
        raw = line[len(marker_prefix):]
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {"metadataParseError": raw}
    else:
        clean_stdout_lines.append(line)

if not isinstance(result, dict):
    result = {}

result.setdefault("taskId", task_id)
result.setdefault("state", state)
result.setdefault("exitCode", exit_code)
result.setdefault("timedOut", timed_out)
result.setdefault("timeoutSeconds", timeout_seconds)
result.setdefault("startedAt", started_at)
result.setdefault("finishedAt", finished_at)
if started_at is not None and finished_at is not None:
    result.setdefault("durationSeconds", max(0, (finished_at - started_at) // 1000))
result.setdefault("stdout", "\n".join(clean_stdout_lines)[-60000:])
result.setdefault("stderr", stderr_text[-60000:])
result.setdefault("reportedAt", int(__import__("time").time() * 1000))

print(json.dumps({
    "taskId": task_id,
    "state": state,
    "exitCode": exit_code,
    "stdout": "\n".join(clean_stdout_lines)[-60000:],
    "stderr": stderr_text,
    "resultJson": json.dumps(result, ensure_ascii=False),
}, ensure_ascii=False))
PY
}

report_state() {
  local task_id="$1"
  local state="$2"
  local exit_code="${3:-}"
  local timed_out="${4:-0}"
  local timeout_seconds="${5:-0}"
  local started_at="${6:-}"
  local finished_at="${7:-}"
  local stdout_path="${8:-}"
  local stderr_path="${9:-}"
  local payload

  payload="$(build_report_payload "$task_id" "$state" "$exit_code" "$timed_out" "$timeout_seconds" "$started_at" "$finished_at" "$stdout_path" "$stderr_path")"
  post_json "/api/v1/agent-task/report" "$payload" "agent task report" >/dev/null
}

claim_task() {
  post_json "/api/v1/agent-task/claim" "{\"serverId\":${SERVER_ID}}" "agent task claim"
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
  CERT_TEXT="$cert_text" "$PYTHON_BIN" - "$cert_file" <<'PY' || printf '{}'
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
  "$PYTHON_BIN" - "$SERVER_ID" "$AGENT_VERSION" "$xray_version" "$snell_version" "$cpu" "$mem_usage" "$rx" "$tx" "$xui_service" "$xray_service" "$snell_service" "$last_error" "$cert_json" <<'PY'
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
  post_json "/api/v1/control-server/heartbeat" "$(heartbeat_payload "$last_error")" "agent heartbeat" >/dev/null || true
}

run_bash_with_timeout() {
  local task_file="$1"
  local stdout_file="$2"
  local stderr_file="$3"

  "$PYTHON_BIN" - "$TASK_TIMEOUT_SECONDS" "$TASK_TIMEOUT_KILL_SECONDS" "$BASH_BIN" "$task_file" "$stdout_file" "$stderr_file" <<'PY'
import os
import signal
import subprocess
import sys
import time

timeout_seconds = int(sys.argv[1])
kill_grace_seconds = int(sys.argv[2])
bash_bin = sys.argv[3]
task_file = sys.argv[4]
stdout_file = sys.argv[5]
stderr_file = sys.argv[6]

def terminate_process_tree(proc, force=False):
    if os.name == "nt":
        command = ["taskkill", "/PID", str(proc.pid), "/T"]
        if force:
            command.append("/F")
        try:
            subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            try:
                proc.kill() if force else proc.terminate()
            except ProcessLookupError:
                pass
        return

    sig = signal.SIGKILL if force else signal.SIGTERM
    try:
        os.killpg(proc.pid, sig)
    except ProcessLookupError:
        pass

with open(stdout_file, "wb") as stdout, open(stderr_file, "wb") as stderr:
    popen_kwargs = {}
    if os.name == "nt":
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["start_new_session"] = True

    try:
        proc = subprocess.Popen(
            [bash_bin, task_file],
            stdout=stdout,
            stderr=stderr,
            **popen_kwargs,
        )
    except Exception as exc:
        stderr.write(f"unable to start bash '{bash_bin}': {exc}\n".encode("utf-8", errors="replace"))
        sys.exit(127)

    try:
        return_code = proc.wait(timeout=timeout_seconds)
        sys.exit(return_code)
    except subprocess.TimeoutExpired:
        terminate_process_tree(proc, force=False)
        deadline = time.monotonic() + kill_grace_seconds
        while time.monotonic() < deadline:
            return_code = proc.poll()
            if return_code is not None:
                sys.exit(124)
            time.sleep(0.5)
        terminate_process_tree(proc, force=True)
        proc.wait()
        sys.exit(124)
PY
}

run_task() {
  local response="$1"
  local task_id script task_file stdout_file stderr_file started_at finished_at exit_code timed_out report_error

  task_id="$(printf '%s' "$response" | json_get "data.id" || true)"
  if [ -z "$task_id" ]; then
    warn "claim response did not include a task id"
    return 1
  fi

  script="$(printf '%s' "$response" | json_get "data.script" || true)"
  if [ -z "$script" ]; then
    warn "task ${task_id} did not include a script"
    return 1
  fi

  task_file="${WORK_DIR}/task-${task_id}.sh"
  stdout_file="${WORK_DIR}/task-${task_id}.out"
  stderr_file="${WORK_DIR}/task-${task_id}.err"

  printf '%s\n' "$script" > "$task_file"
  chmod 700 "$task_file"

  started_at="$(now_ms)"
  info "task ${task_id} claimed; timeout=${TASK_TIMEOUT_SECONDS}s"
  if report_state "$task_id" "running" "" "0" "$TASK_TIMEOUT_SECONDS" "$started_at" "$started_at" "$stdout_file" "$stderr_file"; then
    :
  else
    warn "task ${task_id} running state report failed"
  fi

  set +e
  run_bash_with_timeout "$task_file" "$stdout_file" "$stderr_file"
  exit_code=$?
  set -e
  finished_at="$(now_ms)"
  timed_out=0
  if [ "$exit_code" -eq 124 ]; then
    timed_out=1
    warn "task ${task_id} timed out after ${TASK_TIMEOUT_SECONDS}s"
  fi

  if [ "$exit_code" -eq 0 ]; then
    info "task ${task_id} completed successfully"
    if ! report_state "$task_id" "succeeded" "$exit_code" "$timed_out" "$TASK_TIMEOUT_SECONDS" "$started_at" "$finished_at" "$stdout_file" "$stderr_file"; then
      report_error="task ${task_id} succeeded but report delivery failed"
      warn "$report_error"
      send_heartbeat "$report_error"
    else
      send_heartbeat ""
    fi
  else
    warn "task ${task_id} failed with exit code ${exit_code}"
    if ! report_state "$task_id" "failed" "$exit_code" "$timed_out" "$TASK_TIMEOUT_SECONDS" "$started_at" "$finished_at" "$stdout_file" "$stderr_file"; then
      report_error="task ${task_id} failed and report delivery failed"
      warn "$report_error"
      send_heartbeat "$report_error"
    else
      send_heartbeat "task ${task_id} failed with exit code ${exit_code}"
    fi
  fi
}

acquire_lock
info "flux-agent starting with work dir ${WORK_DIR}, poll interval ${POLL_INTERVAL}s, timeout ${TASK_TIMEOUT_SECONDS}s"

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
