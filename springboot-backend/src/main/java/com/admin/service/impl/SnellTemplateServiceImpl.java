package com.admin.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.DeployTaskDto;
import com.admin.entity.ProtocolNode;
import com.admin.entity.ProtocolProfile;
import com.admin.service.SnellTemplateService;
import org.springframework.stereotype.Service;

@Service
public class SnellTemplateServiceImpl implements SnellTemplateService {

    @Override
    public String buildScript(DeployTaskDto dto, ProtocolProfile profile) {
        String action = normalizeAction(dto.getAction());
        String versionFamily = firstNotBlank(dto.getVersionFamily(), profile == null ? null : profile.getVersionFamily(), "v4");
        String exactVersion = firstNotBlank(dto.getExactVersion(), "v5".equalsIgnoreCase(versionFamily) ? "v5.0.0" : "v4.1.1");
        Integer port = firstNotNull(dto.getListenPort(), profile == null ? null : profile.getListenPort(), 8388);
        String psk = StrUtil.isBlank(dto.getPsk()) ? IdUtil.simpleUUID().substring(0, 20) : dto.getPsk();
        return buildScript(action, exactVersion, port, psk, null, "Snell Main", "snell.service", "snell-main.conf");
    }

    @Override
    public String buildNodeScript(ProtocolNode node, String action) {
        JSONObject credential = parseObject(node.getCredentialJson());
        JSONObject config = parseObject(node.getConfigJson());
        String version = firstNotBlank(stringValue(config, "version"), "v4.1.1");
        String psk = firstNotBlank(stringValue(credential, "psk"), IdUtil.simpleUUID().substring(0, 20));
        String serviceName = normalizeServiceName(firstNotBlank(node.getServiceName(), "snell-node-" + node.getId()));
        String configName = "node-" + node.getId() + ".conf";
        return buildScript(normalizeAction(action), version, firstNotNull(node.getPort(), 8390), psk,
                node.getId(), firstNotBlank(node.getName(), "Snell " + node.getId()), serviceName, configName);
    }

    private String buildScript(String action, String version, Integer port, String psk,
                               Long nodeId, String nodeName, String serviceName, String configName) {
        StringBuilder script = new StringBuilder();
        script.append("#!/usr/bin/env bash\n");
        script.append("set -euo pipefail\n\n");
        appendVar(script, "ACTION", action);
        appendVar(script, "SNELL_VERSION", version);
        script.append("PORT=").append(port).append("\n");
        appendVar(script, "PSK", psk);
        appendVar(script, "PROTOCOL_NODE_ID", nodeId == null ? "" : String.valueOf(nodeId));
        appendVar(script, "NODE_NAME", firstNotBlank(nodeName, "Snell"));
        appendVar(script, "SERVICE_NAME", normalizeServiceName(serviceName));
        appendVar(script, "CONFIG_NAME", configName);
        script.append("DOWNLOAD_BASE_URL='https://dl.nssurge.com/snell'\n");
        script.append("BINARY_PATH='/usr/local/bin/snell-server'\n");
        script.append("CONFIG_DIR='/etc/snell'\n");
        script.append("USERS_DIR='/etc/snell/users'\n");
        script.append("MAIN_CONFIG_PATH=\"${USERS_DIR}/${CONFIG_NAME}\"\n");
        script.append("SERVICE_BASE=\"${SERVICE_NAME%.service}\"\n");
        script.append("SYSTEMD_SERVICE_PATH=\"/etc/systemd/system/${SERVICE_NAME}\"\n");
        script.append("OPENRC_SERVICE_PATH=\"/etc/init.d/${SERVICE_BASE}\"\n\n");
        script.append(body());
        return script.toString();
    }

    private String body() {
        return """
                require_root() {
                  if [ "$(id -u)" -ne 0 ]; then
                    echo 'Please run this script as root.' >&2
                    exit 1
                  fi
                }

                map_arch() {
                  local arch
                  arch="$(uname -m)"
                  case "$arch" in
                    x86_64|amd64) echo 'amd64' ;;
                    i386|i686) echo 'i386' ;;
                    aarch64|arm64) echo 'aarch64' ;;
                    armv7l|armv7) echo 'armv7l' ;;
                    *) echo "Unsupported architecture: $arch" >&2; return 1 ;;
                  esac
                }

                install_deps() {
                  if command -v apt-get >/dev/null 2>&1; then
                    apt-get update
                    DEBIAN_FRONTEND=noninteractive apt-get install -y curl wget unzip python3 openssl
                  elif command -v yum >/dev/null 2>&1; then
                    yum install -y curl wget unzip python3 openssl
                  elif command -v dnf >/dev/null 2>&1; then
                    dnf install -y curl wget unzip python3 openssl
                  elif command -v apk >/dev/null 2>&1; then
                    apk add --no-cache curl wget unzip python3 openssl
                  fi
                }

                detect_service_manager() {
                  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
                    echo systemd
                    return
                  fi
                  if command -v rc-service >/dev/null 2>&1 && command -v rc-update >/dev/null 2>&1; then
                    echo openrc
                    return
                  fi
                  echo 'systemd or OpenRC is required for persistent Snell services.' >&2
                  exit 1
                }

                service_status() {
                  local manager="$1"
                  if [ "$manager" = "systemd" ]; then
                    systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo not-installed
                  else
                    if rc-service "$SERVICE_BASE" status >/dev/null 2>&1; then
                      echo active
                    else
                      echo inactive
                    fi
                  fi
                }

                snell_expected_sha() {
                  case "$1:$2" in
                    v4.1.1:amd64) echo 'cc2271b79c7506888b34e651e8741b3aa7fc7d5f60aa65ef8bb096f3313a193b' ;;
                    v4.1.1:i386) echo '09579fceebf69ff291453b8e252a9f74c7ca82246ec8572a6e2376008df25ae1' ;;
                    v4.1.1:aarch64) echo '38d4cdc03dcdb3608af8594df83e1795265167fafc5d802f815148908902d758' ;;
                    v4.1.1:armv7l) echo 'd00b98ed803be4039f0f0630b810932cd3d3d87ee3e6ed224106fdc63347d8e6' ;;
                    v5.0.0:amd64) echo '893a7be4fc5e695b97acb80af9a4a99b99867f8cb476784725a3f89fa23940e1' ;;
                    v5.0.0:i386) echo '1f0fa72074bc1445c680662af80813bc1f68af1377a6d8f41939c8f3caf89e88' ;;
                    v5.0.0:aarch64) echo '76709032a8d1043fa6f01e1fbbb727148d77534a83293d73564a5692c3967292' ;;
                    v5.0.0:armv7l) echo 'a0504cebd2f5b83fe589dea7f7176b681a13f5778d1a10d8d49cf061997c1564' ;;
                    *) return 1 ;;
                  esac
                }

                download_snell() {
                  local arch url tmp expected_sha actual_sha
                  arch="$(map_arch)"
                  url="${DOWNLOAD_BASE_URL}/snell-server-${SNELL_VERSION}-linux-${arch}.zip"
                  expected_sha="$(snell_expected_sha "$SNELL_VERSION" "$arch")" || {
                    echo "Unsupported Snell version/architecture checksum: ${SNELL_VERSION}/${arch}" >&2
                    exit 1
                  }
                  tmp="$(mktemp -d)"
                  echo "Downloading ${url}"
                  if command -v curl >/dev/null 2>&1; then
                    curl -fsSL "$url" -o "$tmp/snell-server.zip"
                  else
                    wget -q "$url" -O "$tmp/snell-server.zip"
                  fi
                  actual_sha="$(sha256_file "$tmp/snell-server.zip")"
                  if [ "$actual_sha" != "$expected_sha" ]; then
                    echo "Snell checksum verification failed for ${url}" >&2
                    echo "Expected: ${expected_sha}" >&2
                    echo "Actual:   ${actual_sha}" >&2
                    exit 1
                  fi
                  echo "Verified Snell ${SNELL_VERSION} ${arch} sha256 ${actual_sha}"
                  unzip -o "$tmp/snell-server.zip" -d "$tmp"
                  install -m 0755 "$tmp/snell-server" "$BINARY_PATH"
                  rm -rf "$tmp"
                }

                sha256_file() {
                  if command -v sha256sum >/dev/null 2>&1; then
                    sha256sum "$1" | awk '{print $1}'
                    return
                  fi
                  if command -v openssl >/dev/null 2>&1; then
                    openssl dgst -sha256 "$1" | awk '{print $2}'
                    return
                  fi
                  echo 'sha256sum or openssl is required for Snell checksum verification.' >&2
                  exit 1
                }

                write_config() {
                  mkdir -p "$USERS_DIR"
                  cat > "$MAIN_CONFIG_PATH" <<SNELL_CONFIG
                [snell-server]
                listen = ::0:${PORT}
                psk = ${PSK}
                ipv6 = true
                SNELL_CONFIG
                  if id -u nobody >/dev/null 2>&1; then
                    chown nobody "$MAIN_CONFIG_PATH"
                  fi
                  chmod 600 "$MAIN_CONFIG_PATH"
                }

                assert_service_active() {
                  local manager="$1"
                  if [ "$manager" = "systemd" ]; then
                    sleep 1
                    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
                      systemctl --no-pager --full status "$SERVICE_NAME" || true
                      echo "Snell service ${SERVICE_NAME} is not active after ${ACTION}." >&2
                      exit 1
                    fi
                  else
                    if ! rc-service "$SERVICE_BASE" status >/dev/null 2>&1; then
                      rc-service "$SERVICE_BASE" status || true
                      echo "Snell service ${SERVICE_BASE} is not active after ${ACTION}." >&2
                      exit 1
                    fi
                  fi
                }

                write_systemd_service() {
                  cat > "$SYSTEMD_SERVICE_PATH" <<SNELL_SERVICE
                [Unit]
                Description=Snell Proxy Node ${NODE_NAME}
                After=network.target

                [Service]
                Type=simple
                User=nobody
                ExecStart=${BINARY_PATH} -c ${MAIN_CONFIG_PATH}
                Restart=on-failure
                RestartSec=5
                LimitNOFILE=1048576

                [Install]
                WantedBy=multi-user.target
                SNELL_SERVICE
                  systemctl daemon-reload
                }

                write_openrc_service() {
                  cat > "$OPENRC_SERVICE_PATH" <<SNELL_SERVICE
                #!/sbin/openrc-run
                name="Snell Proxy Node ${NODE_NAME}"
                description="Snell Proxy Node ${NODE_NAME}"
                command="${BINARY_PATH}"
                command_args="-c ${MAIN_CONFIG_PATH}"
                command_background="yes"
                command_user="nobody"
                pidfile="/run/${SERVICE_BASE}.pid"
                output_log="/var/log/${SERVICE_BASE}.log"
                error_log="/var/log/${SERVICE_BASE}.err"

                depend() {
                  need net
                  after firewall
                }
                SNELL_SERVICE
                  chmod 0755 "$OPENRC_SERVICE_PATH"
                }

                install_snell() {
                  local manager
                  require_root
                  install_deps
                  download_snell
                  write_config
                  manager="$(detect_service_manager)"
                  if [ "$manager" = "systemd" ]; then
                    write_systemd_service
                    systemctl enable "$SERVICE_NAME"
                    systemctl restart "$SERVICE_NAME"
                  else
                    write_openrc_service
                    rc-update add "$SERVICE_BASE" default
                    rc-service "$SERVICE_BASE" restart
                  fi
                  assert_service_active "$manager"
                }

                uninstall_snell() {
                  local manager
                  require_root
                  manager="$(detect_service_manager)"
                  if [ "$manager" = "systemd" ]; then
                    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
                    systemctl disable "$SERVICE_NAME" 2>/dev/null || true
                    rm -f "$SYSTEMD_SERVICE_PATH"
                    systemctl daemon-reload
                  else
                    rc-service "$SERVICE_BASE" stop 2>/dev/null || true
                    rc-update del "$SERVICE_BASE" default 2>/dev/null || true
                    rm -f "$OPENRC_SERVICE_PATH"
                  fi
                  rm -f "$MAIN_CONFIG_PATH"
                  echo "Snell node removed. Config path was ${MAIN_CONFIG_PATH}."
                }

                restart_snell() {
                  local manager
                  require_root
                  manager="$(detect_service_manager)"
                  if [ "$manager" = "systemd" ]; then
                    systemctl restart "$SERVICE_NAME"
                  else
                    rc-service "$SERVICE_BASE" restart
                  fi
                  assert_service_active "$manager"
                }

                show_snell_status() {
                  local manager
                  manager="$(detect_service_manager)"
                  if [ "$manager" = "systemd" ]; then
                    systemctl --no-pager status "$SERVICE_NAME" || true
                  else
                    rc-service "$SERVICE_BASE" status || true
                  fi
                }

                emit_result_marker() {
                  local manager service_status snell_version node_state arch download_url checksum_sha
                  manager="$(detect_service_manager)"
                  service_status="$(service_status "$manager")"
                  snell_version=''
                  if command -v snell-server >/dev/null 2>&1; then
                    snell_version="$(snell-server -v 2>&1 | head -n 1 || true)"
                  fi
                  arch="$(map_arch 2>/dev/null || true)"
                  download_url=''
                  checksum_sha=''
                  if [ -n "$arch" ]; then
                    download_url="${DOWNLOAD_BASE_URL}/snell-server-${SNELL_VERSION}-linux-${arch}.zip"
                    checksum_sha="$(snell_expected_sha "$SNELL_VERSION" "$arch" 2>/dev/null || true)"
                  fi
                  node_state="$service_status"
                  if [ "$ACTION" = "absent" ]; then
                    node_state='deleted'
                  fi
                  OB_NODE_ID="$PROTOCOL_NODE_ID" NODE_NAME="$NODE_NAME" SERVICE_NAME="$SERVICE_NAME" MAIN_CONFIG_PATH="$MAIN_CONFIG_PATH" PORT="$PORT" PSK="$PSK" SNELL_VERSION="$SNELL_VERSION" SNELL_RUNTIME_VERSION="$snell_version" SNELL_DOWNLOAD_URL="$download_url" SNELL_CHECKSUM_SHA256="$checksum_sha" NODE_STATE="$node_state" python3 <<'PY'
                import json
                import os

                node_id = os.environ.get("OB_NODE_ID") or None
                node = {
                    "name": os.environ.get("NODE_NAME"),
                    "protocol": "snell",
                    "engine": "snell",
                    "direction": "inbound",
                    "listen": "::0",
                    "port": int(os.environ.get("PORT", "0")),
                    "transport": "tcp",
                    "security": "psk",
                    "credential": {"psk": os.environ.get("PSK")},
                    "config": {
                        "configPath": os.environ.get("MAIN_CONFIG_PATH"),
                        "version": os.environ.get("SNELL_VERSION"),
                        "downloadUrl": os.environ.get("SNELL_DOWNLOAD_URL"),
                        "checksumSha256": os.environ.get("SNELL_CHECKSUM_SHA256"),
                    },
                    "remoteId": os.environ.get("SERVICE_NAME"),
                    "serviceName": os.environ.get("SERVICE_NAME"),
                    "state": os.environ.get("NODE_STATE"),
                }
                if node_id:
                    node["id"] = int(node_id)
                result = {
                    "protocolNodes": [node],
                    "server": {"snellVersion": os.environ.get("SNELL_RUNTIME_VERSION")},
                    "services": {"snell": os.environ.get("NODE_STATE")},
                }
                print("OB_AGENT_RESULT_JSON=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")))
                PY
                }

                case "$ACTION" in
                  present) install_snell ;;
                  absent) uninstall_snell ;;
                  restarted) restart_snell ;;
                  status) show_snell_status ;;
                  *) echo "Unsupported action: $ACTION" >&2; exit 1 ;;
                esac

                emit_result_marker
                """;
    }

    private String normalizeAction(String action) {
        if (StrUtil.isBlank(action)) {
            return "present";
        }
        String normalized = action.trim().toLowerCase();
        if ("present".equals(normalized) || "absent".equals(normalized) || "restarted".equals(normalized) || "status".equals(normalized)) {
            return normalized;
        }
        return "present";
    }

    private String normalizeServiceName(String value) {
        String service = StrUtil.isBlank(value) ? "snell.service" : value.trim();
        return service.endsWith(".service") ? service : service + ".service";
    }

    private void appendVar(StringBuilder script, String key, String value) {
        script.append(key).append('=').append(shellQuote(value == null ? "" : value)).append('\n');
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (StrUtil.isNotBlank(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private Integer firstNotNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private JSONObject parseObject(String value) {
        if (StrUtil.isBlank(value)) {
            return new JSONObject();
        }
        try {
            return JSON.parseObject(value);
        } catch (Exception ignored) {
            return new JSONObject();
        }
    }

    private String stringValue(JSONObject object, String key) {
        Object value = object == null ? null : object.get(key);
        return value == null ? null : String.valueOf(value);
    }
}
