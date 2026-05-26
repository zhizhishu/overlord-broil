#!/usr/bin/env bash
set -euo pipefail

MASTER_URL="${OB_MASTER_URL:-http://127.0.0.1:5166}"
LOGIN_USER="${OB_LOGIN_USER:-admin_user}"
LOGIN_PASSWORD="${OB_LOGIN_PASSWORD:-admin_user}"
SERVER_ID="${OB_SERVER_ID:-}"
SNELL_PORT="${OB_SNELL_PORT:-18390}"
SNELL_VERSION="${OB_SNELL_VERSION:-v4.1.1}"
SNELL_PSK="${OB_SNELL_PSK:-}"
AGENT_BIN="${OB_AGENT_BIN:-/usr/local/bin/overlord-agent.sh}"
AGENT_ENV="${OB_AGENT_ENV:-/etc/overlord-agent.env}"
KEEP_SNELL="${OB_SNELL_KEEP:-0}"
WAIT_SECONDS="${OB_SNELL_WAIT_SECONDS:-180}"
CONNECT_TIMEOUT="${OB_HTTP_CONNECT_TIMEOUT:-10}"
MAX_TIME="${OB_HTTP_MAX_TIME:-60}"
PYTHON_BIN="${OB_TEST_PYTHON_BIN:-}"

TOKEN=""
TMP_DIR=""
RESPONSE_BODY=""
RESPONSE_STATUS=""
NODE_ID=""
TASK_ID=""
SERVICE_NAME=""

notice() {
  echo "$*"
}

detect_python() {
  if [ -n "$PYTHON_BIN" ]; then
    "$PYTHON_BIN" -c 'import json, secrets, string, sys' >/dev/null 2>&1
    return
  fi

  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import json, secrets, string, sys' >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      return
    fi
  done

  echo "python3 or python is required for Snell real smoke tests." >&2
  exit 2
}

cleanup() {
  if [ -n "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

json_eval() {
  local expression="$1"
  RESPONSE_BODY="$RESPONSE_BODY" "$PYTHON_BIN" - "$expression" <<'PY'
import json
import os
import sys

data = json.loads(os.environ["RESPONSE_BODY"])
scope = {
    "dict": dict,
    "int": int,
    "isinstance": isinstance,
    "len": len,
    "list": list,
    "next": next,
    "str": str,
}
value = eval(sys.argv[1], {"__builtins__": scope}, {"data": data})
if value is not None:
    print(value)
PY
}

json_assert() {
  local expression="$1"
  RESPONSE_BODY="$RESPONSE_BODY" "$PYTHON_BIN" - "$expression" <<'PY'
import json
import os
import sys

data = json.loads(os.environ["RESPONSE_BODY"])
scope = {
    "all": all,
    "any": any,
    "dict": dict,
    "int": int,
    "isinstance": isinstance,
    "len": len,
    "list": list,
    "str": str,
}
if not eval(sys.argv[1], {"__builtins__": scope}, {"data": data}):
    raise SystemExit(f"JSON assertion failed: {sys.argv[1]}\n{data}")
PY
}

make_psk() {
  "$PYTHON_BIN" - <<'PY'
import secrets
import string

alphabet = string.ascii_letters + string.digits + "_-"
print("".join(secrets.choice(alphabet) for _ in range(32)))
PY
}

make_json_payload() {
  local server_id="$1"
  local name="$2"
  local action="$3"
  local port="$4"
  local psk="$5"
  local version="$6"
  "$PYTHON_BIN" - "$server_id" "$name" "$action" "$port" "$psk" "$version" <<'PY'
import json
import sys

server_id, name, action, port, psk, version = sys.argv[1:]
payload = {
    "serverId": int(server_id),
    "name": name,
    "protocol": "snell",
    "engine": "snell",
    "direction": "inbound",
    "listen": "::0",
    "port": int(port),
    "transport": "tcp",
    "security": "psk",
    "action": action,
    "credentialJson": json.dumps({"psk": psk}, separators=(",", ":")),
    "configJson": json.dumps({"version": version}, separators=(",", ":")),
}
print(json.dumps(payload, separators=(",", ":")))
PY
}

api_post() {
  local path="$1"
  local payload="$2"
  local body_file="${TMP_DIR}/response.json"
  local headers=(-H "Content-Type: application/json")
  if [ -n "$TOKEN" ]; then
    headers+=(-H "Authorization: ${TOKEN}")
  fi

  RESPONSE_STATUS="$(curl --silent --show-error --location \
    --connect-timeout "$CONNECT_TIMEOUT" \
    --max-time "$MAX_TIME" \
    --request POST \
    "${headers[@]}" \
    --data "$payload" \
    --output "$body_file" \
    --write-out "%{http_code}" \
    "${MASTER_URL%/}${path}")"
  RESPONSE_BODY="$(cat "$body_file")"
  if [ "$RESPONSE_STATUS" != "200" ]; then
    echo "Expected HTTP 200 from ${path}, got ${RESPONSE_STATUS}: ${RESPONSE_BODY}" >&2
    exit 1
  fi
}

login() {
  local payload
  payload="$("$PYTHON_BIN" - "$LOGIN_USER" "$LOGIN_PASSWORD" <<'PY'
import json
import sys
print(json.dumps({"username": sys.argv[1], "password": sys.argv[2], "captchaId": ""}, separators=(",", ":")))
PY
)"
  api_post /api/v1/user/login "$payload"
  json_assert 'isinstance(data, dict) and data.get("code") == 0 and isinstance(data.get("data"), dict)'
  TOKEN="$(json_eval 'data["data"].get("token")')"
  if [ -z "$TOKEN" ]; then
    echo "Login response did not include a token." >&2
    exit 1
  fi
  notice "Logged in to master."
}

resolve_server_id() {
  if [ -n "$SERVER_ID" ]; then
    notice "Using server id ${SERVER_ID}."
    return
  fi

  api_post /api/v1/control-server/list '{}'
  SERVER_ID="$(RESPONSE_BODY="$RESPONSE_BODY" "$PYTHON_BIN" - <<'PY'
import json
import os

data = json.loads(os.environ["RESPONSE_BODY"]).get("data")
items = []
if isinstance(data, list):
    items = data
elif isinstance(data, dict):
    for key in ("records", "list", "items", "rows"):
        if isinstance(data.get(key), list):
            items = data[key]
            break
if not items:
    raise SystemExit("No control server found.")
master = next((item for item in items if item.get("role") == "master"), None)
target = master or items[0]
print(target["id"])
PY
)"
  notice "Resolved server id ${SERVER_ID}."
}

run_agent_once() {
  if [ ! -x "$AGENT_BIN" ]; then
    echo "Agent binary not executable: ${AGENT_BIN}" >&2
    exit 1
  fi
  notice "Running controlled agent once."
  (
    if [ -r "$AGENT_ENV" ]; then
      set -a
      # shellcheck disable=SC1090
      . "$AGENT_ENV"
      set +a
    fi
    "$AGENT_BIN" --once
  ) >/tmp/overlord-snell-smoke-agent.log 2>&1 || {
    cat /tmp/overlord-snell-smoke-agent.log >&2
    exit 1
  }
}

wait_for_task() {
  local deadline state
  deadline=$((SECONDS + WAIT_SECONDS))
  state=""
  while [ "$SECONDS" -le "$deadline" ]; do
    api_post /api/v1/deploy-task/list '{}'
    state="$(RESPONSE_BODY="$RESPONSE_BODY" TASK_ID="$TASK_ID" "$PYTHON_BIN" - <<'PY'
import json
import os

target = str(os.environ["TASK_ID"])
data = json.loads(os.environ["RESPONSE_BODY"]).get("data")
items = []
if isinstance(data, list):
    items = data
elif isinstance(data, dict):
    for key in ("records", "list", "items", "rows"):
        if isinstance(data.get(key), list):
            items = data[key]
            break
for item in items:
    if str(item.get("id")) == target:
        print(item.get("state") or "")
        break
PY
)"
    case "$state" in
      succeeded|failed|timeout)
        notice "Deploy task ${TASK_ID} state: ${state}."
        [ "$state" = "succeeded" ] || exit 1
        return
        ;;
    esac
    sleep 3
  done
  echo "Timed out waiting for deploy task ${TASK_ID}; last state=${state:-unknown}." >&2
  exit 1
}

verify_snell_present() {
  notice "Verifying Snell service ${SERVICE_NAME} and port ${SNELL_PORT}."
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    systemctl is-active "$SERVICE_NAME" >/dev/null
  elif command -v rc-service >/dev/null 2>&1; then
    rc-service "${SERVICE_NAME%.service}" status >/dev/null
  else
    echo "No systemd/OpenRC service manager available for verification." >&2
    exit 1
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -lntup | grep -q ":${SNELL_PORT}\\b"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -lntup | grep -q ":${SNELL_PORT}\\b"
  else
    echo "ss or netstat is required for port verification." >&2
    exit 1
  fi
}

delete_node() {
  if [ -z "$NODE_ID" ]; then
    return
  fi
  notice "Deleting temporary Snell node ${NODE_ID}."
  api_post /api/v1/protocol-node/delete "{\"id\":${NODE_ID}}"
  json_assert 'isinstance(data, dict) and data.get("code") == 0'
  TASK_ID="$(json_eval 'data["data"].get("task", {}).get("id")')"
  if [ -n "$TASK_ID" ]; then
    run_agent_once
    wait_for_task
  fi
}

main() {
  detect_python
  TMP_DIR="$(mktemp -d)"
  trap cleanup EXIT

  case "$SNELL_PORT" in
    *[!0-9]*|"")
      echo "OB_SNELL_PORT must be numeric." >&2
      exit 2
      ;;
  esac
  if [ "$SNELL_PORT" -lt 1 ] || [ "$SNELL_PORT" -gt 65535 ]; then
    echo "OB_SNELL_PORT must be between 1 and 65535." >&2
    exit 2
  fi
  if [ -z "$SNELL_PSK" ]; then
    SNELL_PSK="$(make_psk)"
  fi

  login
  resolve_server_id

  local name payload
  name="ob-snell-smoke-$(date +%Y%m%d%H%M%S)"
  payload="$(make_json_payload "$SERVER_ID" "$name" present "$SNELL_PORT" "$SNELL_PSK" "$SNELL_VERSION")"
  notice "Creating temporary Snell node on port ${SNELL_PORT}."
  api_post /api/v1/protocol-node/create "$payload"
  json_assert 'isinstance(data, dict) and data.get("code") == 0 and isinstance(data.get("data"), dict)'
  NODE_ID="$(json_eval 'data["data"].get("node", {}).get("id")')"
  TASK_ID="$(json_eval 'data["data"].get("task", {}).get("id")')"
  SERVICE_NAME="$(json_eval 'data["data"].get("node", {}).get("serviceName")')"
  if [ -z "$NODE_ID" ] || [ -z "$TASK_ID" ] || [ -z "$SERVICE_NAME" ]; then
    echo "Snell create response did not include node/task/service metadata." >&2
    exit 1
  fi

  run_agent_once
  wait_for_task
  verify_snell_present
  api_post /api/v1/deploy-task/runtime-state/overview '{}'
  json_assert 'isinstance(data, dict) and data.get("code") == 0'

  if [ "$KEEP_SNELL" = "1" ]; then
    notice "Snell real smoke passed; temporary node kept by OB_SNELL_KEEP=1."
  else
    delete_node
    notice "Snell real smoke passed and temporary node was removed."
  fi
}

main "$@"
