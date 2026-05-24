package com.admin.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.admin.common.dto.OrchestrationPlanDto;
import com.admin.entity.ControlServer;
import com.admin.service.XuiOrchestrationScriptService;
import org.springframework.stereotype.Service;

@Service
public class XuiOrchestrationScriptServiceImpl implements XuiOrchestrationScriptService {

    @Override
    public String buildScript(OrchestrationPlanDto dto, ControlServer server) {
        String host = firstNotBlank(dto.getPublicHost(), server.getHost(), "127.0.0.1");
        String username = firstNotBlank(dto.getPanelUsername(), "flux_" + IdUtil.simpleUUID().substring(0, 8));
        String password = firstNotBlank(dto.getPanelPassword(), IdUtil.simpleUUID().substring(0, 16));
        String webBasePath = normalizeBasePath(firstNotBlank(dto.getWebBasePath(), "flux-" + IdUtil.simpleUUID().substring(0, 12)));
        String certMode = normalizeCertMode(dto.getCertificateMode());
        String certDomain = firstNotBlank(dto.getCertificateDomain(), host);
        String snellPsk = firstNotBlank(dto.getSnellPsk(), IdUtil.simpleUUID().substring(0, 20));

        StringBuilder script = new StringBuilder();
        script.append("#!/usr/bin/env bash\n");
        script.append("set -euo pipefail\n\n");
        appendVar(script, "FLUX_AGENT_VERSION", "flux-agent/0.2-orchestrator");
        appendVar(script, "INSTALL_XUI", enabled(dto.getInstallXui()) ? "1" : "0");
        appendVar(script, "CONFIGURE_PANEL", enabled(dto.getConfigurePanel()) ? "1" : "0");
        appendVar(script, "XUI_VERSION", firstNotBlank(dto.getXuiVersion(), ""));
        appendVar(script, "PANEL_PORT", String.valueOf(firstNotNull(dto.getPanelPort(), 5168)));
        appendVar(script, "PANEL_USERNAME", username);
        appendVar(script, "PANEL_PASSWORD", password);
        appendVar(script, "WEB_BASE_PATH", webBasePath);
        appendVar(script, "PUBLIC_HOST", host);
        appendVar(script, "LISTEN_IP", firstNotBlank(dto.getListenIp(), "0.0.0.0"));
        appendVar(script, "CERTIFICATE_MODE", certMode);
        appendVar(script, "CERTIFICATE_DOMAIN", certDomain);
        appendVar(script, "ACME_EMAIL", firstNotBlank(dto.getAcmeEmail(), ""));
        appendVar(script, "CREATE_VLESS_REALITY", enabled(dto.getCreateVlessReality()) ? "1" : "0");
        appendVar(script, "CREATE_VMESS_WS", enabled(dto.getCreateVmessWs()) ? "1" : "0");
        appendVar(script, "CREATE_TROJAN_TLS", enabled(dto.getCreateTrojanTls()) ? "1" : "0");
        appendVar(script, "CREATE_SHADOWSOCKS", enabled(dto.getCreateShadowsocks()) ? "1" : "0");
        appendVar(script, "VLESS_PORT", String.valueOf(firstNotNull(dto.getVlessPort(), 443)));
        appendVar(script, "VMESS_PORT", String.valueOf(firstNotNull(dto.getVmessPort(), 2086)));
        appendVar(script, "TROJAN_PORT", String.valueOf(firstNotNull(dto.getTrojanPort(), 8443)));
        appendVar(script, "SHADOWSOCKS_PORT", String.valueOf(firstNotNull(dto.getShadowsocksPort(), 8388)));
        appendVar(script, "REALITY_SNI", firstNotBlank(dto.getRealitySni(), "www.cloudflare.com"));
        appendVar(script, "REALITY_DEST", firstNotBlank(dto.getRealityDest(), "www.cloudflare.com:443"));
        appendVar(script, "WS_PATH", firstNotBlank(dto.getWsPath(), "/ws"));
        appendVar(script, "SS_METHOD", firstNotBlank(dto.getSsMethod(), "2022-blake3-aes-128-gcm"));
        appendVar(script, "INSTALL_SNELL", enabled(dto.getInstallSnell()) ? "1" : "0");
        appendVar(script, "SNELL_PORT", String.valueOf(firstNotNull(dto.getSnellPort(), 8390)));
        appendVar(script, "SNELL_PSK", snellPsk);
        appendVar(script, "SNELL_VERSION", "v4.1.1");
        script.append('\n');
        script.append(body());
        return script.toString();
    }

    private String body() {
        return """
                XUI_FOLDER='/usr/local/x-ui'
                XUI_SERVICE_DIR='/etc/systemd/system'
                XUI_CLI='/usr/bin/x-ui'
                RESULT_FILE='/tmp/flux-xui-orchestration-result.json'
                CERT_FILE=''
                KEY_FILE=''
                LOCAL_SCHEME='http'
                XUI_ALLOW_INSECURE=0

                log() {
                  printf '[flux-orchestrator] %s\\n' "$*"
                }

                require_root() {
                  if [ "$(id -u)" -ne 0 ]; then
                    echo 'Please run this task as root.' >&2
                    exit 1
                  fi
                }

                require_systemd_host() {
                  if ! command -v systemctl >/dev/null 2>&1 || [ ! -d /run/systemd/system ]; then
                    echo '3x-ui orchestration requires a Linux host with running systemd. Use Debian, Ubuntu, Rocky Linux or Oracle Linux for full 3x-ui install/configure tasks; Alpine/OpenRC is supported only for the Flux agent, Snell node tasks and remote forwarding tasks.' >&2
                    exit 1
                  fi
                }

                detect_os() {
                  if [ -f /etc/os-release ]; then
                    . /etc/os-release
                    OS_ID="${ID:-debian}"
                  else
                    OS_ID='debian'
                  fi
                }

                map_arch() {
                  case "$(uname -m)" in
                    x86_64|x64|amd64) echo 'amd64' ;;
                    i386|i686|x86) echo '386' ;;
                    aarch64|arm64) echo 'arm64' ;;
                    armv7*|armv7|arm) echo 'armv7' ;;
                    armv6*|armv6) echo 'armv6' ;;
                    armv5*|armv5) echo 'armv5' ;;
                    s390x) echo 's390x' ;;
                    *) echo "Unsupported CPU architecture: $(uname -m)" >&2; exit 1 ;;
                  esac
                }

                install_deps() {
                  detect_os
                  case "$OS_ID" in
                    ubuntu|debian|armbian)
                      apt-get update
                      DEBIAN_FRONTEND=noninteractive apt-get install -y -q curl tar ca-certificates openssl python3 unzip procps
                      ;;
                    fedora|amzn|rhel|almalinux|rocky|centos|ol)
                      if command -v dnf >/dev/null 2>&1; then
                        dnf install -y curl tar ca-certificates openssl python3 unzip procps-ng
                      else
                        yum install -y curl tar ca-certificates openssl python3 unzip procps-ng
                      fi
                      ;;
                    arch|manjaro|parch)
                      pacman -Sy --noconfirm curl tar ca-certificates openssl python unzip procps-ng
                      ;;
                    alpine)
                      apk update
                      apk add curl tar ca-certificates openssl python3 unzip procps
                      ;;
                    *)
                      if command -v apt-get >/dev/null 2>&1; then
                        apt-get update
                        DEBIAN_FRONTEND=noninteractive apt-get install -y -q curl tar ca-certificates openssl python3 unzip procps
                      fi
                      ;;
                  esac
                }

                latest_xui_version() {
                  local tag
                  tag="$(curl -fsSL https://api.github.com/repos/MHSanaei/3x-ui/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\\1/' | head -n 1 || true)"
                  if [ -z "$tag" ]; then
                    tag="$(curl -4fsSL https://api.github.com/repos/MHSanaei/3x-ui/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\\1/' | head -n 1 || true)"
                  fi
                  if [ -z "$tag" ]; then
                    echo 'Failed to resolve latest 3x-ui version.' >&2
                    exit 1
                  fi
                  echo "$tag"
                }

                install_xui() {
                  local arch version tarball url work
                  if [ "$INSTALL_XUI" != "1" ]; then
                    if command -v x-ui >/dev/null 2>&1 || [ -x "$XUI_FOLDER/x-ui" ]; then
                      log '3x-ui install step skipped.'
                      return
                    fi
                    echo '3x-ui is not installed and installXui is disabled.' >&2
                    exit 1
                  fi

                  arch="$(map_arch)"
                  version="$XUI_VERSION"
                  if [ -z "$version" ]; then
                    version="$(latest_xui_version)"
                  fi
                  url="https://github.com/MHSanaei/3x-ui/releases/download/${version}/x-ui-linux-${arch}.tar.gz"
                  work="$(mktemp -d)"
                  log "Installing 3x-ui ${version} for ${arch}"
                  curl -4fL "$url" -o "${work}/x-ui-linux-${arch}.tar.gz"
                  tar zxf "${work}/x-ui-linux-${arch}.tar.gz" -C "$work"

                  systemctl stop x-ui 2>/dev/null || true
                  rm -rf "$XUI_FOLDER"
                  mv "${work}/x-ui" "$XUI_FOLDER"
                  chmod +x "$XUI_FOLDER/x-ui" "$XUI_FOLDER/x-ui.sh" || true
                  if [ -f "$XUI_FOLDER/bin/xray-linux-${arch}" ]; then
                    chmod +x "$XUI_FOLDER/bin/xray-linux-${arch}"
                  fi
                  if [ -f "$XUI_FOLDER/bin/xray-linux-arm" ]; then
                    chmod +x "$XUI_FOLDER/bin/xray-linux-arm"
                  fi
                  cp -f "$XUI_FOLDER/x-ui.sh" "$XUI_CLI"
                  chmod +x "$XUI_CLI"
                  mkdir -p /var/log/x-ui

                  if [ -f "$XUI_FOLDER/x-ui.service" ]; then
                    cp -f "$XUI_FOLDER/x-ui.service" "$XUI_SERVICE_DIR/x-ui.service"
                  elif [ -f "$XUI_FOLDER/x-ui.service.debian" ]; then
                    cp -f "$XUI_FOLDER/x-ui.service.debian" "$XUI_SERVICE_DIR/x-ui.service"
                  elif [ -f "$XUI_FOLDER/x-ui.service.rhel" ]; then
                    cp -f "$XUI_FOLDER/x-ui.service.rhel" "$XUI_SERVICE_DIR/x-ui.service"
                  else
                    curl -4fL https://raw.githubusercontent.com/MHSanaei/3x-ui/main/x-ui.service.debian -o "$XUI_SERVICE_DIR/x-ui.service"
                  fi
                  chown root:root "$XUI_SERVICE_DIR/x-ui.service"
                  chmod 644 "$XUI_SERVICE_DIR/x-ui.service"
                  systemctl daemon-reload
                  systemctl enable x-ui
                  systemctl start x-ui
                  rm -rf "$work"
                }

                configure_xui_panel() {
                  local clean_base
                  clean_base="${WEB_BASE_PATH#/}"
                  if [ "$CONFIGURE_PANEL" = "1" ]; then
                    log "Configuring 3x-ui panel on port ${PANEL_PORT}/${clean_base}"
                    "$XUI_FOLDER/x-ui" setting -username "$PANEL_USERNAME" -password "$PANEL_PASSWORD" -port "$PANEL_PORT" -webBasePath "$clean_base" -listenIP "$LISTEN_IP"
                    systemctl restart x-ui
                  fi
                }

                setup_self_signed_cert() {
                  local cert_dir cn
                  cert_dir="/root/cert/flux-panel"
                  cn="${CERTIFICATE_DOMAIN:-$PUBLIC_HOST}"
                  mkdir -p "$cert_dir"
                  CERT_FILE="${cert_dir}/fullchain.pem"
                  KEY_FILE="${cert_dir}/privkey.pem"
                  if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
                    log "Generating self-signed certificate for ${cn}"
                    openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \\
                      -subj "/CN=${cn}" \\
                      -keyout "$KEY_FILE" \\
                      -out "$CERT_FILE"
                    chmod 600 "$KEY_FILE"
                    chmod 644 "$CERT_FILE"
                  fi
                  "$XUI_FOLDER/x-ui" cert -webCert "$CERT_FILE" -webCertKey "$KEY_FILE" || true
                  LOCAL_SCHEME='https'
                  XUI_ALLOW_INSECURE=1
                  systemctl restart x-ui
                }

                setup_acme_cert() {
                  local cert_dir domain reload_cmd
                  domain="$CERTIFICATE_DOMAIN"
                  if [ -z "$domain" ]; then
                    echo 'certificateDomain is required for acme-http mode.' >&2
                    exit 1
                  fi
                  if ! command -v ~/.acme.sh/acme.sh >/dev/null 2>&1; then
                    curl -fsSL https://get.acme.sh | sh
                  fi
                  if [ -n "$ACME_EMAIL" ]; then
                    ~/.acme.sh/acme.sh --register-account -m "$ACME_EMAIL" || true
                  fi
                  cert_dir="/root/cert/${domain}"
                  mkdir -p "$cert_dir"
                  systemctl stop x-ui 2>/dev/null || true
                  ~/.acme.sh/acme.sh --set-default-ca --server letsencrypt --force
                  ~/.acme.sh/acme.sh --issue -d "$domain" --listen-v6 --standalone --httpport 80 --force
                  reload_cmd='systemctl restart x-ui'
                  ~/.acme.sh/acme.sh --installcert -d "$domain" \\
                    --key-file "${cert_dir}/privkey.pem" \\
                    --fullchain-file "${cert_dir}/fullchain.pem" \\
                    --reloadcmd "$reload_cmd"
                  CERT_FILE="${cert_dir}/fullchain.pem"
                  KEY_FILE="${cert_dir}/privkey.pem"
                  chmod 600 "$KEY_FILE" 2>/dev/null || true
                  chmod 644 "$CERT_FILE" 2>/dev/null || true
                  "$XUI_FOLDER/x-ui" cert -webCert "$CERT_FILE" -webCertKey "$KEY_FILE"
                  LOCAL_SCHEME='https'
                  XUI_ALLOW_INSECURE=0
                  systemctl start x-ui
                  systemctl restart x-ui
                }

                setup_certificate() {
                  case "$CERTIFICATE_MODE" in
                    self-signed) setup_self_signed_cert ;;
                    acme-http) setup_acme_cert ;;
                    none) ;;
                    *) echo "Unsupported certificate mode: $CERTIFICATE_MODE" >&2; exit 1 ;;
                  esac

                  if [ "$CREATE_TROJAN_TLS" = "1" ] && { [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; }; then
                    setup_self_signed_cert
                  fi
                }

                find_xray_bin() {
                  local arch candidate
                  arch="$(map_arch)"
                  for candidate in \\
                    "$XUI_FOLDER/bin/xray-linux-${arch}" \\
                    "$XUI_FOLDER/bin/xray-linux-arm" \\
                    "$XUI_FOLDER/bin/xray" \\
                    "$(command -v xray 2>/dev/null || true)"; do
                    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
                      echo "$candidate"
                      return 0
                    fi
                  done
                  return 1
                }

                generate_reality_private_key() {
                  local xray_bin output key
                  xray_bin="$(find_xray_bin)"
                  output="$("$xray_bin" x25519 2>/dev/null || true)"
                  key="$(printf '%s\\n' "$output" | awk -F': ' '/Private key:/ {print $2; exit}')"
                  if [ -z "$key" ]; then
                    echo 'Failed to generate Reality private key through xray x25519.' >&2
                    exit 1
                  fi
                  echo "$key"
                }

                snell_expected_sha() {
                  case "$1:$2" in
                    v4.1.1:amd64) echo 'cc2271b79c7506888b34e651e8741b3aa7fc7d5f60aa65ef8bb096f3313a193b' ;;
                    v4.1.1:i386) echo '09579fceebf69ff291453b8e252a9f74c7ca82246ec8572a6e2376008df25ae1' ;;
                    v4.1.1:aarch64) echo '38d4cdc03dcdb3608af8594df83e1795265167fafc5d802f815148908902d758' ;;
                    v4.1.1:armv7l) echo 'd00b98ed803be4039f0f0630b810932cd3d3d87ee3e6ed224106fdc63347d8e6' ;;
                    *) return 1 ;;
                  esac
                }

                map_snell_arch() {
                  case "$(uname -m)" in
                    x86_64|amd64) echo 'amd64' ;;
                    i386|i686) echo 'i386' ;;
                    aarch64|arm64) echo 'aarch64' ;;
                    armv7l|armv7) echo 'armv7l' ;;
                    *) return 1 ;;
                  esac
                }

                wait_for_panel() {
                  local base attempt
                  base="${LOCAL_SCHEME}://127.0.0.1:${PANEL_PORT}/${WEB_BASE_PATH#/}"
                  for attempt in $(seq 1 40); do
                    if curl -kfsS "${base}/panel/api/server/status" -H "Authorization: Bearer ${API_TOKEN}" >/dev/null 2>&1; then
                      return 0
                    fi
                    sleep 2
                  done
                  echo "3x-ui panel did not become ready at ${base}" >&2
                  exit 1
                }

                install_snell() {
                  local arch url tmp binary config_dir config_path service_path expected_sha actual_sha
                  arch="$(map_snell_arch)" || { echo "Unsupported Snell architecture: $(uname -m)" >&2; return 1; }
                  expected_sha="$(snell_expected_sha "$SNELL_VERSION" "$arch")" || {
                    echo "Unsupported Snell version/architecture checksum: ${SNELL_VERSION}/${arch}" >&2
                    return 1
                  }
                  url="https://dl.nssurge.com/snell/snell-server-${SNELL_VERSION}-linux-${arch}.zip"
                  tmp="$(mktemp -d)"
                  binary='/usr/local/bin/snell-server'
                  config_dir='/etc/snell/users'
                  config_path="${config_dir}/snell-main.conf"
                  service_path='/etc/systemd/system/snell.service'
                  log "Installing Snell ${SNELL_VERSION} on ${SNELL_PORT}"
                  curl -fsSL "$url" -o "${tmp}/snell.zip"
                  actual_sha="$(sha256_file "${tmp}/snell.zip")"
                  if [ "$actual_sha" != "$expected_sha" ]; then
                    echo "Snell checksum verification failed for ${url}" >&2
                    echo "Expected: ${expected_sha}" >&2
                    echo "Actual:   ${actual_sha}" >&2
                    return 1
                  fi
                  log "Verified Snell ${SNELL_VERSION} ${arch} sha256 ${actual_sha}"
                  unzip -o "${tmp}/snell.zip" -d "$tmp"
                  install -m 0755 "${tmp}/snell-server" "$binary"
                  mkdir -p "$config_dir"
                  cat > "$config_path" <<SNELL_CONFIG
                [snell-server]
                listen = ::0:${SNELL_PORT}
                psk = ${SNELL_PSK}
                ipv6 = true
                SNELL_CONFIG
                  chmod 600 "$config_path"
                  cat > "$service_path" <<SNELL_SERVICE
                [Unit]
                Description=Snell Proxy Service
                After=network.target

                [Service]
                Type=simple
                User=nobody
                ExecStart=${binary} -c ${config_path}
                Restart=on-failure
                RestartSec=5
                LimitNOFILE=1048576

                [Install]
                WantedBy=multi-user.target
                SNELL_SERVICE
                  systemctl daemon-reload
                  systemctl enable snell
                  systemctl restart snell
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
                  return 1
                }

                create_inbounds() {
                  local reality_private_key panel_base
                  reality_private_key=''
                  if [ "$CREATE_VLESS_REALITY" = "1" ]; then
                    reality_private_key="$(generate_reality_private_key)"
                  fi
                  panel_base="${LOCAL_SCHEME}://127.0.0.1:${PANEL_PORT}/${WEB_BASE_PATH#/}"
                  PANEL_BASE="$panel_base" REALITY_PRIVATE_KEY="$reality_private_key" CERT_FILE="$CERT_FILE" KEY_FILE="$KEY_FILE" python3 <<'PY'
                import json
                import os
                import ssl
                import time
                import urllib.parse
                import urllib.request
                import uuid

                base = os.environ["PANEL_BASE"].rstrip("/")
                api_token = os.environ["API_TOKEN"]
                cert_file = os.environ.get("CERT_FILE", "")
                key_file = os.environ.get("KEY_FILE", "")
                created = []
                ctx = ssl._create_unverified_context()

                def enabled(name):
                    return os.environ.get(name) == "1"

                def as_int(name, default):
                    try:
                        return int(os.environ.get(name, default))
                    except ValueError:
                        return default

                def post_inbound(name, payload):
                    data = urllib.parse.urlencode(payload).encode()
                    req = urllib.request.Request(
                        base + "/panel/api/inbounds/add",
                        data=data,
                        headers={
                            "Authorization": "Bearer " + api_token,
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                        method="POST",
                    )
                    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
                        body = resp.read().decode()
                    try:
                        response = json.loads(body)
                    except json.JSONDecodeError:
                        response = {}
                    try:
                        stream = json.loads(payload.get("streamSettings") or "{}")
                    except json.JSONDecodeError:
                        stream = {}
                    remote_id = response.get("obj", {}).get("id") if isinstance(response.get("obj"), dict) else None
                    created.append({
                        "name": name,
                        "engine": "xray",
                        "direction": "inbound",
                        "port": payload["port"],
                        "protocol": payload["protocol"],
                        "transport": stream.get("network"),
                        "security": stream.get("security"),
                        "remoteId": str(remote_id) if remote_id else "",
                        "response": body[:1200],
                    })

                sniffing = json.dumps({"enabled": True, "destOverride": ["http", "tls", "quic", "fakedns"]})
                now = int(time.time())

                if enabled("CREATE_VLESS_REALITY"):
                    client_id = str(uuid.uuid4())
                    settings = {
                        "clients": [{
                            "id": client_id,
                            "flow": "xtls-rprx-vision",
                            "email": "vless-%s@flux.local" % now,
                            "limitIp": 0,
                            "totalGB": 0,
                            "expiryTime": 0,
                            "enable": True,
                            "tgId": "",
                            "subId": "",
                            "comment": "created by flux orchestrator",
                            "reset": 0,
                        }],
                        "decryption": "none",
                        "fallbacks": [],
                    }
                    stream = {
                        "network": "tcp",
                        "security": "reality",
                        "realitySettings": {
                            "show": False,
                            "dest": os.environ["REALITY_DEST"],
                            "xver": 0,
                            "serverNames": [os.environ["REALITY_SNI"]],
                            "privateKey": os.environ["REALITY_PRIVATE_KEY"],
                            "shortIds": [uuid.uuid4().hex[:8]],
                        },
                    }
                    post_inbound("VLESS Reality", {
                        "up": 0,
                        "down": 0,
                        "total": 0,
                        "remark": "flux-vless-reality",
                        "enable": "true",
                        "expiryTime": 0,
                        "listen": "",
                        "port": as_int("VLESS_PORT", 443),
                        "protocol": "vless",
                        "settings": json.dumps(settings, separators=(",", ":")),
                        "streamSettings": json.dumps(stream, separators=(",", ":")),
                        "sniffing": sniffing,
                    })

                if enabled("CREATE_VMESS_WS"):
                    settings = {
                        "clients": [{
                            "id": str(uuid.uuid4()),
                            "alterId": 0,
                            "email": "vmess-%s@flux.local" % now,
                            "limitIp": 0,
                            "totalGB": 0,
                            "expiryTime": 0,
                            "enable": True,
                            "tgId": "",
                            "subId": "",
                            "comment": "created by flux orchestrator",
                            "reset": 0,
                        }],
                        "disableInsecureEncryption": False,
                    }
                    stream = {
                        "network": "ws",
                        "security": "none",
                        "wsSettings": {"path": os.environ.get("WS_PATH", "/ws"), "headers": {}},
                    }
                    post_inbound("VMess WebSocket", {
                        "up": 0,
                        "down": 0,
                        "total": 0,
                        "remark": "flux-vmess-ws",
                        "enable": "true",
                        "expiryTime": 0,
                        "listen": "",
                        "port": as_int("VMESS_PORT", 2086),
                        "protocol": "vmess",
                        "settings": json.dumps(settings, separators=(",", ":")),
                        "streamSettings": json.dumps(stream, separators=(",", ":")),
                        "sniffing": sniffing,
                    })

                if enabled("CREATE_TROJAN_TLS"):
                    settings = {
                        "clients": [{
                            "password": uuid.uuid4().hex,
                            "email": "trojan-%s@flux.local" % now,
                            "limitIp": 0,
                            "totalGB": 0,
                            "expiryTime": 0,
                            "enable": True,
                            "tgId": "",
                            "subId": "",
                            "comment": "created by flux orchestrator",
                            "reset": 0,
                        }],
                        "fallbacks": [],
                    }
                    tls_settings = {"serverName": os.environ.get("CERTIFICATE_DOMAIN") or os.environ.get("PUBLIC_HOST")}
                    if cert_file and key_file:
                        tls_settings["certificates"] = [{"certificateFile": cert_file, "keyFile": key_file}]
                    stream = {"network": "tcp", "security": "tls", "tlsSettings": tls_settings}
                    post_inbound("Trojan TLS", {
                        "up": 0,
                        "down": 0,
                        "total": 0,
                        "remark": "flux-trojan-tls",
                        "enable": "true",
                        "expiryTime": 0,
                        "listen": "",
                        "port": as_int("TROJAN_PORT", 8443),
                        "protocol": "trojan",
                        "settings": json.dumps(settings, separators=(",", ":")),
                        "streamSettings": json.dumps(stream, separators=(",", ":")),
                        "sniffing": sniffing,
                    })

                if enabled("CREATE_SHADOWSOCKS"):
                    settings = {
                        "method": os.environ.get("SS_METHOD", "2022-blake3-aes-128-gcm"),
                        "password": uuid.uuid4().hex,
                        "network": "tcp,udp",
                    }
                    stream = {"network": "tcp", "security": "none"}
                    post_inbound("Shadowsocks", {
                        "up": 0,
                        "down": 0,
                        "total": 0,
                        "remark": "flux-shadowsocks",
                        "enable": "true",
                        "expiryTime": 0,
                        "listen": "",
                        "port": as_int("SHADOWSOCKS_PORT", 8388),
                        "protocol": "shadowsocks",
                        "settings": json.dumps(settings, separators=(",", ":")),
                        "streamSettings": json.dumps(stream, separators=(",", ":")),
                        "sniffing": sniffing,
                    })

                with open(os.environ["RESULT_FILE"], "w", encoding="utf-8") as fh:
                    json.dump({"inbounds": created}, fh, ensure_ascii=False)
                print(json.dumps({"createdInbounds": created}, ensure_ascii=False, indent=2))
                PY
                }

                build_result_marker() {
                  local xray_bin xray_version snell_version endpoint base_path api_token
                  local xui_service_status xray_service_status snell_service_status cert_status cert_expire_at now_ts
                  local snell_arch snell_download_url snell_checksum_sha
                  xray_version=''
                  snell_version=''
                  snell_arch="$(map_snell_arch 2>/dev/null || true)"
                  snell_download_url=''
                  snell_checksum_sha=''
                  if [ -n "$snell_arch" ]; then
                    snell_download_url="https://dl.nssurge.com/snell/snell-server-${SNELL_VERSION}-linux-${snell_arch}.zip"
                    snell_checksum_sha="$(snell_expected_sha "$SNELL_VERSION" "$snell_arch" 2>/dev/null || true)"
                  fi
                  if xray_bin="$(find_xray_bin 2>/dev/null)"; then
                    xray_version="$("$xray_bin" version 2>/dev/null | head -n 1 || true)"
                  fi
                  if command -v snell-server >/dev/null 2>&1; then
                    snell_version="$(snell-server -v 2>&1 | head -n 1 || true)"
                  fi
                  xui_service_status="$(systemctl is-active x-ui 2>/dev/null || echo unknown)"
                  snell_service_status="$(systemctl is-active snell 2>/dev/null || echo not-installed)"
                  if pgrep -fa '[x]ray' >/dev/null 2>&1; then
                    xray_service_status='active'
                  else
                    xray_service_status='inactive'
                  fi

                  cert_status='none'
                  cert_expire_at=''
                  if [ "$CERTIFICATE_MODE" != "none" ]; then
                    cert_status='missing'
                    if [ -n "$CERT_FILE" ] && [ -f "$CERT_FILE" ]; then
                      cert_expire_at="$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | sed 's/^notAfter=//' | python3 -c 'import datetime, email.utils, sys; raw=sys.stdin.read().strip(); dt=email.utils.parsedate_to_datetime(raw); print(int(dt.timestamp()*1000))' 2>/dev/null || true)"
                      if [ -n "$cert_expire_at" ]; then
                        now_ts="$(python3 -c 'import time; print(int(time.time()*1000))')"
                        if [ "$cert_expire_at" -le "$now_ts" ]; then
                          cert_status='expired'
                        elif [ "$cert_expire_at" -le $((now_ts + 2592000000)) ]; then
                          cert_status='expiring'
                        else
                          cert_status='valid'
                        fi
                      else
                        cert_status='unreadable'
                      fi
                    fi
                  fi
                  base_path="/${WEB_BASE_PATH#/}"
                  endpoint="${LOCAL_SCHEME}://${PUBLIC_HOST}:${PANEL_PORT}"
                  api_token="$API_TOKEN"
                  XUI_ENDPOINT="$endpoint" XUI_BASE_PATH="$base_path" XUI_API_TOKEN="$api_token" XUI_USERNAME="$PANEL_USERNAME" XUI_PASSWORD="$PANEL_PASSWORD" XUI_ALLOW_INSECURE="$XUI_ALLOW_INSECURE" XRAY_VERSION="$xray_version" SNELL_RUNTIME_VERSION="$snell_version" XUI_SERVICE_STATUS="$xui_service_status" XRAY_SERVICE_STATUS="$xray_service_status" SNELL_SERVICE_STATUS="$snell_service_status" CERT_STATUS="$cert_status" CERT_EXPIRE_AT="$cert_expire_at" INSTALL_SNELL="$INSTALL_SNELL" SNELL_PORT="$SNELL_PORT" SNELL_PSK="$SNELL_PSK" SNELL_VERSION="$SNELL_VERSION" SNELL_DOWNLOAD_URL="$snell_download_url" SNELL_CHECKSUM_SHA256="$snell_checksum_sha" python3 <<'PY'
                import json
                import os

                result = {}
                path = os.environ.get("RESULT_FILE")
                if path and os.path.exists(path):
                    with open(path, "r", encoding="utf-8") as fh:
                        result = json.load(fh)
                result["server"] = {
                    "xuiEndpoint": os.environ.get("XUI_ENDPOINT"),
                    "xuiBasePath": os.environ.get("XUI_BASE_PATH"),
                    "xuiApiToken": os.environ.get("XUI_API_TOKEN"),
                    "xuiUsername": os.environ.get("XUI_USERNAME"),
                    "xuiPassword": os.environ.get("XUI_PASSWORD"),
                    "xuiAllowInsecure": int(os.environ.get("XUI_ALLOW_INSECURE", "0")),
                    "xrayVersion": os.environ.get("XRAY_VERSION"),
                    "snellVersion": os.environ.get("SNELL_RUNTIME_VERSION"),
                    "agentVersion": os.environ.get("FLUX_AGENT_VERSION"),
                }
                result["certificate"] = {
                    "mode": os.environ.get("CERTIFICATE_MODE"),
                    "domain": os.environ.get("CERTIFICATE_DOMAIN"),
                    "certFile": os.environ.get("CERT_FILE"),
                    "keyFile": os.environ.get("KEY_FILE"),
                    "status": os.environ.get("CERT_STATUS"),
                    "expireAt": int(os.environ["CERT_EXPIRE_AT"]) if os.environ.get("CERT_EXPIRE_AT") else None,
                }
                result["services"] = {
                    "xui": os.environ.get("XUI_SERVICE_STATUS"),
                    "xray": os.environ.get("XRAY_SERVICE_STATUS"),
                    "snell": os.environ.get("SNELL_SERVICE_STATUS"),
                }
                result.setdefault("protocolNodes", [])
                if os.environ.get("INSTALL_SNELL") == "1":
                    snell_port = int(os.environ.get("SNELL_PORT") or "8390")
                    result["protocolNodes"].append({
                        "name": "flux-snell",
                        "protocol": "snell",
                        "engine": "snell",
                        "direction": "inbound",
                        "listen": "::0",
                        "port": snell_port,
                        "transport": "tcp",
                        "security": "psk",
                        "credential": {"psk": os.environ.get("SNELL_PSK")},
                        "config": {
                            "configPath": "/etc/snell/users/snell-main.conf",
                            "version": os.environ.get("SNELL_VERSION"),
                            "downloadUrl": os.environ.get("SNELL_DOWNLOAD_URL"),
                            "checksumSha256": os.environ.get("SNELL_CHECKSUM_SHA256"),
                        },
                        "remoteId": "snell.service",
                        "serviceName": "snell.service",
                        "state": os.environ.get("SNELL_SERVICE_STATUS"),
                    })
                print("FLUX_AGENT_RESULT_JSON=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")))
                PY
                }

                require_root
                require_systemd_host
                install_deps
                install_xui
                configure_xui_panel
                setup_certificate
                API_TOKEN="$("$XUI_FOLDER/x-ui" setting -getApiToken true | awk '/apiToken:/ {print $2; exit}')"
                if [ -z "$API_TOKEN" ]; then
                  echo 'Failed to get or create 3x-ui API token.' >&2
                  exit 1
                fi
                export API_TOKEN RESULT_FILE CERTIFICATE_DOMAIN PUBLIC_HOST REALITY_DEST REALITY_SNI WS_PATH SS_METHOD
                export CREATE_VLESS_REALITY CREATE_VMESS_WS CREATE_TROJAN_TLS CREATE_SHADOWSOCKS
                export VLESS_PORT VMESS_PORT TROJAN_PORT SHADOWSOCKS_PORT
                export FLUX_AGENT_VERSION CERTIFICATE_MODE SNELL_VERSION
                wait_for_panel
                create_inbounds
                if [ "$INSTALL_SNELL" = "1" ]; then
                  install_snell
                fi
                systemctl restart x-ui
                build_result_marker
                log 'Orchestration task finished.'
                """;
    }

    private void appendVar(StringBuilder script, String key, String value) {
        script.append(key).append('=').append(shellQuote(value == null ? "" : value)).append('\n');
    }

    private boolean enabled(Boolean value) {
        return value == null || value;
    }

    private String normalizeCertMode(String mode) {
        if (StrUtil.isBlank(mode)) {
            return "self-signed";
        }
        String normalized = mode.trim().toLowerCase();
        if ("none".equals(normalized) || "self-signed".equals(normalized) || "acme-http".equals(normalized)) {
            return normalized;
        }
        return "self-signed";
    }

    private String normalizeBasePath(String value) {
        String path = StrUtil.isBlank(value) ? "flux-" + IdUtil.simpleUUID().substring(0, 12) : value.trim();
        while (path.startsWith("/")) {
            path = path.substring(1);
        }
        while (path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return StrUtil.isBlank(path) ? "flux-" + IdUtil.simpleUUID().substring(0, 12) : path;
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

    private Integer firstNotNull(Integer value, Integer fallback) {
        return value == null ? fallback : value;
    }
}
