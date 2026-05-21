#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${FLUX_TEST_PYTHON_BIN:-}"

detect_python() {
  if [ -n "$PYTHON_BIN" ]; then
    "$PYTHON_BIN" -c 'import http.server, json' >/dev/null 2>&1
    return
  fi

  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import http.server, json' >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      return
    fi
  done

  echo "python3 or python is required for 3x-ui fixture tests." >&2
  exit 2
}

request() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local body_file="${TMP_DIR}/response.json"
  local status

  if [ -n "$payload" ]; then
    status="$(curl --silent --show-error --request "$method" \
      --header "Content-Type: application/json" \
      --data "$payload" \
      --output "$body_file" \
      --write-out "%{http_code}" \
      "${BASE_URL}${path}")"
  else
    status="$(curl --silent --show-error --request "$method" \
      --output "$body_file" \
      --write-out "%{http_code}" \
      "${BASE_URL}${path}")"
  fi

  RESPONSE_STATUS="$status"
  RESPONSE_BODY="$(cat "$body_file")"
}

assert_status() {
  local expected="$1"
  if [ "$RESPONSE_STATUS" != "$expected" ]; then
    echo "Expected HTTP ${expected}, got ${RESPONSE_STATUS}: ${RESPONSE_BODY}" >&2
    exit 1
  fi
}

assert_json() {
  local expression="$1"
  RESPONSE_BODY="$RESPONSE_BODY" "$PYTHON_BIN" - "$expression" <<'PY'
import json
import os
import sys

data = json.loads(os.environ["RESPONSE_BODY"])
expression = sys.argv[1]
if not eval(expression, {"__builtins__": {"len": len}}, {"data": data}):
    raise SystemExit(f"JSON assertion failed: {expression}\n{data}")
PY
}

cleanup() {
  local exit_code=$?
  if [ -n "${fixture_pid:-}" ]; then
    kill "$fixture_pid" 2>/dev/null || true
    wait "$fixture_pid" 2>/dev/null || true
  fi
  rm -rf "${TMP_DIR:-}"
  return "$exit_code"
}

detect_python
command -v curl >/dev/null 2>&1 || { echo "curl is required for 3x-ui fixture tests." >&2; exit 2; }

TMP_DIR="$(mktemp -d)"
READY_FILE="${TMP_DIR}/ready.txt"
fixture_pid=""
trap cleanup EXIT

"$PYTHON_BIN" "${SCRIPT_DIR}/three-xui-fixture.py" --host 127.0.0.1 --port 0 --ready-file "$READY_FILE" >"${TMP_DIR}/fixture.log" 2>&1 &
fixture_pid="$!"

for _ in $(seq 1 100); do
  [ -f "$READY_FILE" ] && break
  sleep 0.1
done

if [ ! -f "$READY_FILE" ]; then
  echo "3x-ui fixture did not become ready." >&2
  cat "${TMP_DIR}/fixture.log" >&2 || true
  exit 1
fi

BASE_URL="http://$(cat "$READY_FILE")"

request GET /panel/api/server/status
assert_status 200
assert_json 'data["success"] is True and data["obj"]["xray"]["state"] == "running"'

request GET /panel/api/inbounds/list
assert_status 200
assert_json 'data["success"] is True and len(data["obj"]) == 1 and data["obj"][0]["id"] == 1'

request POST /panel/api/inbounds/add '{"remark":"added-by-test","port":12001,"protocol":"vless","settings":{"clients":[]}}'
assert_status 200
assert_json 'data["success"] is True and data["obj"]["id"] == 2 and data["obj"]["port"] == 12001'

request POST /panel/api/inbounds/update/2 '{"remark":"updated-by-test","enable":false}'
assert_status 200
assert_json 'data["success"] is True and data["obj"]["remark"] == "updated-by-test" and data["obj"]["enable"] is False'

request POST /panel/api/inbounds/setEnable/2 '{"enable":true}'
assert_status 200
assert_json 'data["success"] is True and data["obj"]["enable"] is True'

request POST /panel/api/inbounds/addClient '{"id":2,"client":{"id":"client-1","email":"client@example.test","totalGB":1073741824}}'
assert_status 200
assert_json 'data["success"] is True and data["obj"]["email"] == "client@example.test"'

request POST /panel/api/inbounds/updateClient/client-1 '{"client":{"id":"client-1","email":"renamed@example.test","enable":false}}'
assert_status 200
assert_json 'data["success"] is True and data["obj"]["email"] == "renamed@example.test" and data["obj"]["enable"] is False'

request POST /panel/api/inbounds/resetClientTraffic/renamed@example.test
assert_status 200
assert_json 'data["success"] is True'

request POST /panel/xray/update-style '{"style":"fixture"}'
assert_status 200
assert_json 'data["success"] is True and data["obj"]["saved"] is True'

request GET /panel/api/xray/outbounds
assert_status 200
assert_json 'data["success"] is True and data["obj"][0]["tag"] == "direct"'

request POST /panel/api/xray/config '{"log":{"loglevel":"debug"}}'
assert_status 200
assert_json 'data["success"] is True and data["obj"]["log"]["loglevel"] == "debug"'

request GET /panel/api/server/traffic
assert_status 200
assert_json 'data["success"] is True and data["obj"]["up"] >= 0 and data["obj"]["down"] >= 0'

request POST /panel/api/server/restart
assert_status 200
assert_json 'data["success"] is True and data["obj"]["restarted"] is True and data["obj"]["restartCount"] == 1'

request POST /panel/api/inbounds/delClient/2/renamed@example.test
assert_status 200
assert_json 'data["success"] is True'

request POST /panel/api/inbounds/del/2
assert_status 200
assert_json 'data["success"] is True'

request GET /fixture/not-found
assert_status 404
assert_json 'data["success"] is False'

echo "3x-ui fixture tests passed at ${BASE_URL}"
