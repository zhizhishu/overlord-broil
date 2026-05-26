#!/usr/bin/env bash
set -euo pipefail

THREE_XUI_E2E_URL="${THREE_XUI_E2E_URL:-}"
THREE_XUI_E2E_TOKEN="${THREE_XUI_E2E_TOKEN:-}"
THREE_XUI_E2E_BASE_PATH="${THREE_XUI_E2E_BASE_PATH:-}"
THREE_XUI_E2E_WRITE="${THREE_XUI_E2E_WRITE:-0}"
THREE_XUI_E2E_PORT="${THREE_XUI_E2E_PORT:-}"
THREE_XUI_E2E_CONNECT_TIMEOUT="${THREE_XUI_E2E_CONNECT_TIMEOUT:-10}"
THREE_XUI_E2E_MAX_TIME="${THREE_XUI_E2E_MAX_TIME:-30}"
PYTHON_BIN="${FLUX_TEST_PYTHON_BIN:-}"

AUTH_HEADER=()
RESPONSE_STATUS=""
RESPONSE_BODY=""
TMP_DIR=""
CREATED_INBOUND_ID=""

notice() {
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "::notice::$*"
  else
    echo "$*"
  fi
}

detect_python() {
  if [ -n "$PYTHON_BIN" ]; then
    "$PYTHON_BIN" -c 'import json, uuid' >/dev/null 2>&1
    return
  fi

  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import json, uuid' >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      return
    fi
  done

  echo "python3 or python is required for real 3x-ui E2E tests." >&2
  exit 2
}

normalize_url() {
  local value="$1"
  value="${value%/}"
  if [ "${value%/panel}" != "$value" ]; then
    value="${value%/panel}"
  fi
  printf '%s' "$value"
}

normalize_base_path() {
  local value="$1"
  if [ -z "$value" ] || [ "$value" = "/" ]; then
    printf ''
    return
  fi
  value="/${value#/}"
  value="${value%/}"
  if [ "$value" = "/panel" ]; then
    printf ''
    return
  fi
  printf '%s' "$value"
}

endpoint() {
  local path="$1"
  printf '%s%s%s' "$BASE_URL" "$BASE_PATH" "$path"
}

request() {
  local method="$1"
  local path="$2"
  shift 2
  local body_file="${TMP_DIR}/response.json"
  local status

  status="$(curl --silent --show-error --location \
    --connect-timeout "$THREE_XUI_E2E_CONNECT_TIMEOUT" \
    --max-time "$THREE_XUI_E2E_MAX_TIME" \
    --request "$method" \
    "${AUTH_HEADER[@]}" \
    "$@" \
    --output "$body_file" \
    --write-out "%{http_code}" \
    "$(endpoint "$path")")"

  RESPONSE_STATUS="$status"
  RESPONSE_BODY="$(cat "$body_file")"
}

get_json() {
  request GET "$1"
}

post_form() {
  local path="$1"
  shift
  local curl_args=()
  local field
  for field in "$@"; do
    curl_args+=(--data-urlencode "$field")
  done
  request POST "$path" "${curl_args[@]}"
}

assert_status() {
  local expected="$1"
  if [ "$RESPONSE_STATUS" != "$expected" ]; then
    echo "Expected HTTP ${expected}, got ${RESPONSE_STATUS}: ${RESPONSE_BODY}" >&2
    exit 1
  fi
}

json_assert() {
  local expression="$1"
  RESPONSE_BODY="$RESPONSE_BODY" "$PYTHON_BIN" - "$expression" <<'PY'
import json
import os
import sys

data = json.loads(os.environ["RESPONSE_BODY"])
expression = sys.argv[1]
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
if not eval(expression, {"__builtins__": scope}, {"data": data}):
    raise SystemExit(f"JSON assertion failed: {expression}\n{data}")
PY
}

json_value() {
  local expression="$1"
  RESPONSE_BODY="$RESPONSE_BODY" "$PYTHON_BIN" - "$expression" <<'PY'
import json
import os
import sys

data = json.loads(os.environ["RESPONSE_BODY"])
expression = sys.argv[1]
scope = {
    "dict": dict,
    "int": int,
    "isinstance": isinstance,
    "len": len,
    "list": list,
    "str": str,
}
value = eval(expression, {"__builtins__": scope}, {"data": data})
if value is not None:
    print(value)
PY
}

assert_success_envelope() {
  assert_status 200
  json_assert 'isinstance(data, dict) and data.get("success", True) is True'
}

find_created_inbound_id() {
  FLUX_E2E_REMARK="$REMARK" FLUX_E2E_PORT="$THREE_XUI_E2E_PORT" RESPONSE_BODY="$RESPONSE_BODY" "$PYTHON_BIN" - <<'PY'
import json
import os

data = json.loads(os.environ["RESPONSE_BODY"])
target_remark = os.environ["FLUX_E2E_REMARK"]
target_port = int(os.environ["FLUX_E2E_PORT"])
obj = data.get("obj", [])
items = obj.get("inbounds", []) if isinstance(obj, dict) else obj
for item in items if isinstance(items, list) else []:
    try:
        if str(item.get("remark")) == target_remark or int(item.get("port", -1)) == target_port:
            print(item.get("id", ""))
            break
    except Exception:
        continue
PY
}

delete_created_inbound() {
  if [ -z "$CREATED_INBOUND_ID" ]; then
    return
  fi
  curl --silent --show-error --location \
    --connect-timeout "$THREE_XUI_E2E_CONNECT_TIMEOUT" \
    --max-time "$THREE_XUI_E2E_MAX_TIME" \
    --request POST \
    "${AUTH_HEADER[@]}" \
    --output /dev/null \
    "$(endpoint "/panel/api/inbounds/del/${CREATED_INBOUND_ID}")" || true
  CREATED_INBOUND_ID=""
}

cleanup() {
  local exit_code=$?
  delete_created_inbound
  if [ -n "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
  exit "$exit_code"
}

run_read_only_contract() {
  echo "Checking real 3x-ui status endpoint..."
  get_json /panel/api/server/status
  assert_success_envelope
  json_assert 'isinstance(data.get("obj"), dict)'

  echo "Checking real 3x-ui inbound list endpoint..."
  get_json /panel/api/inbounds/list
  assert_success_envelope
  json_assert 'isinstance(data.get("obj"), list)'

  echo "Checking real 3x-ui Xray config endpoint..."
  get_json /panel/api/server/getConfigJson
  assert_success_envelope
  json_assert '"obj" in data'
}

run_write_contract() {
  if [ -z "$THREE_XUI_E2E_PORT" ]; then
    echo "THREE_XUI_E2E_PORT is required when THREE_XUI_E2E_WRITE=1." >&2
    exit 2
  fi
  case "$THREE_XUI_E2E_PORT" in
    *[!0-9]*)
      echo "THREE_XUI_E2E_PORT must be numeric." >&2
      exit 2
      ;;
  esac
  if [ "$THREE_XUI_E2E_PORT" -lt 1 ] || [ "$THREE_XUI_E2E_PORT" -gt 65535 ]; then
    echo "THREE_XUI_E2E_PORT must be between 1 and 65535." >&2
    exit 2
  fi

  local client_id
  local client_email
  local settings
  local stream_settings
  local sniffing

  REMARK="flux-e2e-$(date +%Y%m%d%H%M%S)-${RANDOM}"
  client_id="$("$PYTHON_BIN" -c 'import uuid; print(uuid.uuid4())')"
  client_email="${REMARK}@example.test"
  settings="{\"clients\":[{\"id\":\"${client_id}\",\"flow\":\"\",\"email\":\"${client_email}\",\"limitIp\":0,\"totalGB\":0,\"expiryTime\":0,\"enable\":true,\"tgId\":\"\",\"subId\":\"\"}],\"decryption\":\"none\",\"fallbacks\":[]}"
  stream_settings='{"network":"tcp","security":"none","tcpSettings":{"acceptProxyProtocol":false,"header":{"type":"none"}}}'
  sniffing='{"enabled":false,"destOverride":["http","tls","quic","fakedns"],"metadataOnly":false,"routeOnly":false}'

  echo "Creating temporary real 3x-ui inbound on port ${THREE_XUI_E2E_PORT}..."
  post_form /panel/api/inbounds/add \
    "enable=true" \
    "remark=${REMARK}" \
    "listen=" \
    "port=${THREE_XUI_E2E_PORT}" \
    "protocol=vless" \
    "settings=${settings}" \
    "streamSettings=${stream_settings}" \
    "sniffing=${sniffing}"
  assert_success_envelope
  CREATED_INBOUND_ID="$(json_value 'data.get("obj", {}).get("id", "") if isinstance(data.get("obj"), dict) else ""')"

  get_json /panel/api/inbounds/list
  assert_success_envelope
  if [ -z "$CREATED_INBOUND_ID" ]; then
    CREATED_INBOUND_ID="$(find_created_inbound_id)"
  fi
  if [ -z "$CREATED_INBOUND_ID" ]; then
    echo "Temporary inbound was created but could not be found for cleanup." >&2
    exit 1
  fi
  json_assert 'isinstance(data.get("obj"), list)'

  echo "Toggling temporary real 3x-ui inbound ${CREATED_INBOUND_ID}..."
  post_form "/panel/api/inbounds/setEnable/${CREATED_INBOUND_ID}" "enable=false"
  assert_success_envelope
  post_form "/panel/api/inbounds/setEnable/${CREATED_INBOUND_ID}" "enable=true"
  assert_success_envelope

  echo "Deleting temporary real 3x-ui inbound ${CREATED_INBOUND_ID}..."
  post_form "/panel/api/inbounds/del/${CREATED_INBOUND_ID}"
  assert_success_envelope
  CREATED_INBOUND_ID=""
}

if [ -z "$THREE_XUI_E2E_URL" ] || [ -z "$THREE_XUI_E2E_TOKEN" ]; then
  notice "Real 3x-ui E2E skipped: set THREE_XUI_E2E_URL and THREE_XUI_E2E_TOKEN to enable it."
  exit 0
fi

detect_python
command -v curl >/dev/null 2>&1 || { echo "curl is required for real 3x-ui E2E tests." >&2; exit 2; }

if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  echo "::add-mask::${THREE_XUI_E2E_TOKEN}"
fi

BASE_URL="$(normalize_url "$THREE_XUI_E2E_URL")"
BASE_PATH="$(normalize_base_path "$THREE_XUI_E2E_BASE_PATH")"
AUTH_HEADER=(--header "Authorization: Bearer ${THREE_XUI_E2E_TOKEN}")
TMP_DIR="$(mktemp -d)"
trap cleanup EXIT

run_read_only_contract

if [ "$THREE_XUI_E2E_WRITE" = "1" ] || [ "$THREE_XUI_E2E_WRITE" = "true" ]; then
  run_write_contract
else
  echo "Write contract skipped. Set THREE_XUI_E2E_WRITE=1 and THREE_XUI_E2E_PORT to create/delete a temporary inbound."
fi

echo "Real 3x-ui E2E contract passed for ${BASE_URL}${BASE_PATH}"
