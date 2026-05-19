package com.admin.service.impl;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.admin.common.dto.DeployTaskDto;
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

        StringBuilder script = new StringBuilder();
        script.append("#!/usr/bin/env bash\n");
        script.append("set -euo pipefail\n\n");
        script.append("ACTION=").append(shellQuote(action)).append("\n");
        script.append("SNELL_VERSION=").append(shellQuote(exactVersion)).append("\n");
        script.append("PORT=").append(port).append("\n");
        script.append("PSK=").append(shellQuote(psk)).append("\n");
        script.append("DOWNLOAD_BASE_URL='https://dl.nssurge.com/snell'\n");
        script.append("INSTALL_DIR='/usr/local/bin'\n");
        script.append("BINARY_PATH='/usr/local/bin/snell-server'\n");
        script.append("CONFIG_DIR='/etc/snell'\n");
        script.append("USERS_DIR='/etc/snell/users'\n");
        script.append("MAIN_CONFIG_PATH='/etc/snell/users/snell-main.conf'\n");
        script.append("SERVICE_PATH='/etc/systemd/system/snell.service'\n\n");

        script.append("require_root() {\n");
        script.append("  if [ \"$(id -u)\" -ne 0 ]; then\n");
        script.append("    echo 'Please run this script as root.' >&2\n");
        script.append("    exit 1\n");
        script.append("  fi\n");
        script.append("}\n\n");

        script.append("map_arch() {\n");
        script.append("  local arch\n");
        script.append("  arch=\"$(uname -m)\"\n");
        script.append("  case \"$arch\" in\n");
        script.append("    x86_64|amd64) echo 'amd64' ;;\n");
        script.append("    i386|i686) echo 'i386' ;;\n");
        script.append("    aarch64|arm64) echo 'aarch64' ;;\n");
        script.append("    armv7l|armv7) echo 'armv7l' ;;\n");
        script.append("    *) echo \"Unsupported architecture: $arch\" >&2; exit 1 ;;\n");
        script.append("  esac\n");
        script.append("}\n\n");

        script.append("install_deps() {\n");
        script.append("  if command -v apt-get >/dev/null 2>&1; then\n");
        script.append("    apt-get update\n");
        script.append("    apt-get install -y curl wget unzip\n");
        script.append("  elif command -v yum >/dev/null 2>&1; then\n");
        script.append("    yum install -y curl wget unzip\n");
        script.append("  elif command -v dnf >/dev/null 2>&1; then\n");
        script.append("    dnf install -y curl wget unzip\n");
        script.append("  fi\n");
        script.append("}\n\n");

        script.append("download_snell() {\n");
        script.append("  local arch url tmp\n");
        script.append("  arch=\"$(map_arch)\"\n");
        script.append("  url=\"${DOWNLOAD_BASE_URL}/snell-server-${SNELL_VERSION}-linux-${arch}.zip\"\n");
        script.append("  tmp=\"$(mktemp -d)\"\n");
        script.append("  echo \"Downloading ${url}\"\n");
        script.append("  if command -v curl >/dev/null 2>&1; then\n");
        script.append("    curl -fsSL \"$url\" -o \"$tmp/snell-server.zip\"\n");
        script.append("  else\n");
        script.append("    wget -q \"$url\" -O \"$tmp/snell-server.zip\"\n");
        script.append("  fi\n");
        script.append("  unzip -o \"$tmp/snell-server.zip\" -d \"$tmp\"\n");
        script.append("  install -m 0755 \"$tmp/snell-server\" \"$BINARY_PATH\"\n");
        script.append("  rm -rf \"$tmp\"\n");
        script.append("}\n\n");

        script.append("write_config() {\n");
        script.append("  mkdir -p \"$USERS_DIR\"\n");
        script.append("  cat > \"$MAIN_CONFIG_PATH\" <<SNELL_CONFIG\n");
        script.append("[snell-server]\n");
        script.append("listen = ::0:${PORT}\n");
        script.append("psk = ${PSK}\n");
        script.append("ipv6 = true\n");
        script.append("SNELL_CONFIG\n");
        script.append("  chmod 600 \"$MAIN_CONFIG_PATH\"\n");
        script.append("}\n\n");

        script.append("write_service() {\n");
        script.append("  cat > \"$SERVICE_PATH\" <<SNELL_SERVICE\n");
        script.append("[Unit]\n");
        script.append("Description=Snell Proxy Service\n");
        script.append("After=network.target\n\n");
        script.append("[Service]\n");
        script.append("Type=simple\n");
        script.append("User=nobody\n");
        script.append("Group=nogroup\n");
        script.append("ExecStart=${BINARY_PATH} -c ${MAIN_CONFIG_PATH}\n");
        script.append("Restart=on-failure\n");
        script.append("RestartSec=5\n");
        script.append("LimitNOFILE=1048576\n\n");
        script.append("[Install]\n");
        script.append("WantedBy=multi-user.target\n");
        script.append("SNELL_SERVICE\n");
        script.append("  systemctl daemon-reload\n");
        script.append("}\n\n");

        script.append("install_snell() {\n");
        script.append("  require_root\n");
        script.append("  install_deps\n");
        script.append("  download_snell\n");
        script.append("  write_config\n");
        script.append("  write_service\n");
        script.append("  systemctl enable snell\n");
        script.append("  systemctl restart snell\n");
        script.append("  systemctl --no-pager --full status snell || true\n");
        script.append("}\n\n");

        script.append("uninstall_snell() {\n");
        script.append("  require_root\n");
        script.append("  systemctl stop snell 2>/dev/null || true\n");
        script.append("  systemctl disable snell 2>/dev/null || true\n");
        script.append("  rm -f \"$SERVICE_PATH\" \"$BINARY_PATH\"\n");
        script.append("  systemctl daemon-reload\n");
        script.append("  echo \"Snell removed. Config kept at ${CONFIG_DIR}.\"\n");
        script.append("}\n\n");

        script.append("case \"$ACTION\" in\n");
        script.append("  present) install_snell ;;\n");
        script.append("  absent) uninstall_snell ;;\n");
        script.append("  restarted) require_root; systemctl restart snell; systemctl --no-pager status snell || true ;;\n");
        script.append("  status) systemctl --no-pager status snell || true ;;\n");
        script.append("  *) echo \"Unsupported action: $ACTION\" >&2; exit 1 ;;\n");
        script.append("esac\n");

        return script.toString();
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

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (StrUtil.isNotBlank(value)) {
                return value;
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
}
