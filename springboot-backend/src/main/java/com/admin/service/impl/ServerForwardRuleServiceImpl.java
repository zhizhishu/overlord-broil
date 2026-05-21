package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.ServerForwardRuleDto;
import com.admin.common.dto.ServerForwardRuleQueryDto;
import com.admin.common.lang.R;
import com.admin.common.utils.ProtocolValidationUtils;
import com.admin.entity.ControlServer;
import com.admin.entity.DeployTask;
import com.admin.entity.ServerForwardRule;
import com.admin.mapper.DeployTaskMapper;
import com.admin.mapper.ServerForwardRuleMapper;
import com.admin.service.ControlServerService;
import com.admin.service.ServerForwardRuleService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ServerForwardRuleServiceImpl extends ServiceImpl<ServerForwardRuleMapper, ServerForwardRule> implements ServerForwardRuleService {

    private static final int STATUS_ACTIVE = 1;
    private static final int STATUS_DELETED = 0;

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private DeployTaskMapper deployTaskMapper;

    @Override
    public R createRule(ServerForwardRuleDto dto) {
        ControlServer server = resolveServer(dto == null ? null : dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String validation = validate(dto);
        if (validation != null) {
            return R.err(validation);
        }

        long now = System.currentTimeMillis();
        ServerForwardRule rule = new ServerForwardRule();
        copyDto(dto, rule);
        rule.setServerId(server.getId());
        rule.setServerName(server.getName());
        rule.setName(firstNotBlank(rule.getName(), "forward-" + dto.getListenPort()));
        rule.setProtocol(normalizeProtocol(rule.getProtocol()));
        rule.setListenHost(firstNotBlank(rule.getListenHost(), "0.0.0.0"));
        rule.setEngine("socat");
        rule.setState("pending");
        rule.setStatus(STATUS_ACTIVE);
        rule.setCreatedTime(now);
        rule.setUpdatedTime(now);
        if (!this.save(rule)) {
            return R.err("server forward rule create failed");
        }
        fillService(rule);
        this.updateById(rule);
        DeployTask task = createTask(server, rule, "present");
        return R.ok(result(rule, task));
    }

    @Override
    public R updateRule(ServerForwardRuleDto dto) {
        if (dto == null || dto.getId() == null) {
            return R.err("forward rule id is required");
        }
        ServerForwardRule rule = this.getById(dto.getId());
        if (rule == null) {
            return R.err("forward rule not found");
        }
        ControlServer server = resolveServer(rule.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String validation = validateForUpdate(dto, rule);
        if (validation != null) {
            return R.err(validation);
        }

        copyDto(dto, rule);
        rule.setProtocol(normalizeProtocol(rule.getProtocol()));
        rule.setListenHost(firstNotBlank(rule.getListenHost(), "0.0.0.0"));
        rule.setEngine("socat");
        rule.setState("pending");
        rule.setUpdatedTime(System.currentTimeMillis());
        fillService(rule);
        this.updateById(rule);
        DeployTask task = createTask(server, rule, normalizeAction(dto.getAction(), "present"));
        return R.ok(result(rule, task));
    }

    @Override
    public R listRules(ServerForwardRuleQueryDto dto) {
        QueryWrapper<ServerForwardRule> query = new QueryWrapper<>();
        query.eq("status", STATUS_ACTIVE);
        if (dto.getServerId() != null) {
            query.eq("server_id", dto.getServerId());
        }
        if (!isBlank(dto.getProtocol())) {
            query.eq("protocol", normalizeProtocol(dto.getProtocol()));
        }
        query.orderByDesc("updated_time").orderByDesc("id");
        if (dto.getLimit() != null) {
            query.last("LIMIT " + Math.max(1, Math.min(dto.getLimit(), 500)));
        }
        return R.ok(this.list(query));
    }

    @Override
    public R deleteRule(ServerForwardRuleDto dto) {
        if (dto == null || dto.getId() == null) {
            return R.err("forward rule id is required");
        }
        ServerForwardRule rule = this.getById(dto.getId());
        if (rule == null) {
            return R.err("forward rule not found");
        }
        ControlServer server = resolveServer(rule.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        rule.setState("deleting");
        rule.setUpdatedTime(System.currentTimeMillis());
        this.updateById(rule);
        DeployTask task = createTask(server, rule, "absent");
        return R.ok(result(rule, task));
    }

    @Override
    public R restartRule(ServerForwardRuleDto dto) {
        if (dto == null || dto.getId() == null) {
            return R.err("forward rule id is required");
        }
        ServerForwardRule rule = this.getById(dto.getId());
        if (rule == null) {
            return R.err("forward rule not found");
        }
        ControlServer server = resolveServer(rule.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        DeployTask task = createTask(server, rule, "restarted");
        rule.setState("pending");
        rule.setUpdatedTime(System.currentTimeMillis());
        this.updateById(rule);
        return R.ok(result(rule, task));
    }

    @Override
    public void applyAgentResultForwardRules(DeployTask task, JSONObject result) {
        if (task == null || result == null) {
            return;
        }
        for (Object item : toArray(result.get("forwardRules"))) {
            JSONObject meta = toObject(item);
            if (meta == null) {
                continue;
            }
            Long id = meta.getLong("id");
            ServerForwardRule rule = id == null ? null : this.getById(id);
            if (rule == null) {
                rule = findByService(task.getServerId(), meta.getString("serviceName"));
            }
            if (rule == null) {
                continue;
            }
            long now = System.currentTimeMillis();
            setIfNotBlank(meta.getString("state"), rule::setState);
            setIfNotBlank(meta.getString("serviceName"), rule::setServiceName);
            if (meta.getLong("up") != null) rule.setUp(meta.getLong("up"));
            if (meta.getLong("down") != null) rule.setDown(meta.getLong("down"));
            rule.setLastSync(now);
            rule.setLastError(meta.getString("lastError"));
            rule.setStatus("deleted".equals(rule.getState()) ? STATUS_DELETED : STATUS_ACTIVE);
            rule.setUpdatedTime(now);
            this.updateById(rule);
        }
    }

    private DeployTask createTask(ControlServer server, ServerForwardRule rule, String action) {
        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setServerId(server.getId());
        task.setServerName(server.getName());
        task.setProtocol("server-forward");
        task.setAction(action);
        task.setState("generated");
        task.setRequestJson(JSON.toJSONString(rule));
        task.setScript(buildScript(rule, action));
        task.setStatus(STATUS_ACTIVE);
        task.setCreatedTime(now);
        task.setUpdatedTime(now);
        deployTaskMapper.insert(task);
        return task;
    }

    private String buildScript(ServerForwardRule rule, String action) {
        String service = firstNotBlank(rule.getServiceName(), "flux-forward-" + rule.getId() + ".service");
        StringBuilder script = new StringBuilder();
        script.append("#!/usr/bin/env bash\n");
        script.append("set -euo pipefail\n\n");
        appendVar(script, "ACTION", normalizeAction(action, "present"));
        appendVar(script, "RULE_ID", String.valueOf(rule.getId()));
        appendVar(script, "RULE_NAME", rule.getName());
        appendVar(script, "PROTOCOL", normalizeProtocol(rule.getProtocol()));
        appendVar(script, "LISTEN_HOST", firstNotBlank(rule.getListenHost(), "0.0.0.0"));
        script.append("LISTEN_PORT=").append(rule.getListenPort()).append("\n");
        appendVar(script, "TARGET_HOST", rule.getTargetHost());
        script.append("TARGET_PORT=").append(rule.getTargetPort()).append("\n");
        appendVar(script, "SERVICE_NAME", normalizeService(service));
        script.append("SERVICE_PATH=\"/etc/systemd/system/${SERVICE_NAME}\"\n\n");
        script.append("""
                require_root() {
                  if [ "$(id -u)" -ne 0 ]; then
                    echo 'Please run this script as root.' >&2
                    exit 1
                  fi
                }

                install_deps() {
                  if command -v socat >/dev/null 2>&1; then
                    return
                  fi
                  if command -v apt-get >/dev/null 2>&1; then
                    apt-get update
                    DEBIAN_FRONTEND=noninteractive apt-get install -y socat python3
                  elif command -v yum >/dev/null 2>&1; then
                    yum install -y socat python3
                  elif command -v dnf >/dev/null 2>&1; then
                    dnf install -y socat python3
                  elif command -v apk >/dev/null 2>&1; then
                    apk add socat python3
                  fi
                }

                socat_listen_addr() {
                  local proto="$1"
                  if [ "$proto" = "udp" ]; then
                    printf 'UDP-LISTEN:%s,fork,reuseaddr,bind=%s' "$LISTEN_PORT" "$LISTEN_HOST"
                  else
                    printf 'TCP-LISTEN:%s,fork,reuseaddr,bind=%s' "$LISTEN_PORT" "$LISTEN_HOST"
                  fi
                }

                socat_target_addr() {
                  local proto="$1"
                  if [ "$proto" = "udp" ]; then
                    printf 'UDP:%s:%s' "$TARGET_HOST" "$TARGET_PORT"
                  else
                    printf 'TCP:%s:%s' "$TARGET_HOST" "$TARGET_PORT"
                  fi
                }

                write_service() {
                  local listen target
                  listen="$(socat_listen_addr "$PROTOCOL")"
                  target="$(socat_target_addr "$PROTOCOL")"
                  cat > "$SERVICE_PATH" <<SERVICE
                [Unit]
                Description=Flux server forward ${RULE_NAME}
                After=network-online.target
                Wants=network-online.target

                [Service]
                Type=simple
                ExecStart=/usr/bin/socat -d -d ${listen} ${target}
                Restart=always
                RestartSec=5
                LimitNOFILE=1048576

                [Install]
                WantedBy=multi-user.target
                SERVICE
                  systemctl daemon-reload
                }

                install_rule() {
                  require_root
                  install_deps
                  write_service
                  systemctl enable "$SERVICE_NAME"
                  systemctl restart "$SERVICE_NAME"
                  systemctl --no-pager --full status "$SERVICE_NAME" || true
                }

                remove_rule() {
                  require_root
                  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
                  systemctl disable "$SERVICE_NAME" 2>/dev/null || true
                  rm -f "$SERVICE_PATH"
                  systemctl daemon-reload
                }

                emit_result_marker() {
                  local service_status state
                  service_status="$(systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo not-installed)"
                  state="$service_status"
                  if [ "$ACTION" = "absent" ]; then
                    state='deleted'
                  fi
                  RULE_ID="$RULE_ID" RULE_NAME="$RULE_NAME" PROTOCOL="$PROTOCOL" LISTEN_HOST="$LISTEN_HOST" LISTEN_PORT="$LISTEN_PORT" TARGET_HOST="$TARGET_HOST" TARGET_PORT="$TARGET_PORT" SERVICE_NAME="$SERVICE_NAME" STATE="$state" python3 <<'PY'
                import json
                import os

                rule = {
                    "id": int(os.environ["RULE_ID"]),
                    "name": os.environ.get("RULE_NAME"),
                    "protocol": os.environ.get("PROTOCOL"),
                    "listenHost": os.environ.get("LISTEN_HOST"),
                    "listenPort": int(os.environ.get("LISTEN_PORT", "0")),
                    "targetHost": os.environ.get("TARGET_HOST"),
                    "targetPort": int(os.environ.get("TARGET_PORT", "0")),
                    "engine": "socat",
                    "serviceName": os.environ.get("SERVICE_NAME"),
                    "state": os.environ.get("STATE"),
                }
                print("FLUX_AGENT_RESULT_JSON=" + json.dumps({"forwardRules": [rule]}, ensure_ascii=False, separators=(",", ":")))
                PY
                }

                case "$ACTION" in
                  present) install_rule ;;
                  absent) remove_rule ;;
                  restarted) require_root; systemctl restart "$SERVICE_NAME"; systemctl --no-pager status "$SERVICE_NAME" || true ;;
                  status) systemctl --no-pager status "$SERVICE_NAME" || true ;;
                  *) echo "Unsupported action: $ACTION" >&2; exit 1 ;;
                esac

                emit_result_marker
                """);
        return script.toString();
    }

    private String validate(ServerForwardRuleDto dto) {
        if (dto == null) return "forward rule is required";
        if (dto.getServerId() == null) return "server id is required";
        if (!ProtocolValidationUtils.isValidProtocol(dto.getProtocol())) return "forward protocol is invalid";
        if (!isBlank(dto.getListenHost()) && !ProtocolValidationUtils.isValidHost(dto.getListenHost())) {
            return "listen host is invalid";
        }
        if (isBlank(dto.getTargetHost())) return "target host is required";
        if (!ProtocolValidationUtils.isValidHost(dto.getTargetHost())) return "target host is invalid";
        if (!ProtocolValidationUtils.isValidPort(dto.getListenPort())) return "listen port is invalid";
        if (!ProtocolValidationUtils.isValidPort(dto.getTargetPort())) return "target port is invalid";
        return null;
    }

    private String validateForUpdate(ServerForwardRuleDto dto, ServerForwardRule rule) {
        ServerForwardRuleDto merged = new ServerForwardRuleDto();
        merged.setServerId(rule.getServerId());
        merged.setProtocol(firstNotBlank(dto.getProtocol(), rule.getProtocol()));
        merged.setListenHost(firstNotBlank(dto.getListenHost(), rule.getListenHost()));
        merged.setTargetHost(firstNotBlank(dto.getTargetHost(), rule.getTargetHost()));
        merged.setListenPort(dto.getListenPort() == null ? rule.getListenPort() : dto.getListenPort());
        merged.setTargetPort(dto.getTargetPort() == null ? rule.getTargetPort() : dto.getTargetPort());
        return validate(merged);
    }

    private void copyDto(ServerForwardRuleDto dto, ServerForwardRule rule) {
        if (dto == null) return;
        setIfNotBlank(dto.getName(), rule::setName);
        setIfNotBlank(dto.getProtocol(), value -> rule.setProtocol(normalizeProtocol(value)));
        setIfNotBlank(dto.getListenHost(), rule::setListenHost);
        if (dto.getListenPort() != null) rule.setListenPort(dto.getListenPort());
        setIfNotBlank(dto.getTargetHost(), rule::setTargetHost);
        if (dto.getTargetPort() != null) rule.setTargetPort(dto.getTargetPort());
    }

    private ServerForwardRule findByService(Long serverId, String serviceName) {
        if (serverId == null || isBlank(serviceName)) {
            return null;
        }
        QueryWrapper<ServerForwardRule> query = new QueryWrapper<>();
        query.eq("server_id", serverId).eq("service_name", serviceName).last("LIMIT 1");
        return this.getOne(query, false);
    }

    private void fillService(ServerForwardRule rule) {
        if (isBlank(rule.getServiceName())) {
            rule.setServiceName("flux-forward-" + rule.getId() + ".service");
        }
    }

    private Map<String, Object> result(ServerForwardRule rule, DeployTask task) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("rule", rule);
        data.put("task", task);
        return data;
    }

    private ControlServer resolveServer(Long serverId) {
        return serverId == null ? null : controlServerService.getById(serverId);
    }

    private String normalizeProtocol(String protocol) {
        String value = isBlank(protocol) ? "tcp" : protocol.trim().toLowerCase();
        return "udp".equals(value) ? "udp" : "tcp";
    }

    private String normalizeAction(String action, String fallback) {
        String value = isBlank(action) ? fallback : action.trim().toLowerCase();
        return ("present".equals(value) || "absent".equals(value) || "restarted".equals(value) || "status".equals(value)) ? value : fallback;
    }

    private String normalizeService(String service) {
        String value = firstNotBlank(service, "flux-forward.service");
        return value.endsWith(".service") ? value : value + ".service";
    }

    private void appendVar(StringBuilder script, String key, String value) {
        script.append(key).append('=').append(shellQuote(value == null ? "" : value)).append('\n');
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private JSONArray toArray(Object value) {
        if (value instanceof JSONArray) {
            return (JSONArray) value;
        }
        if (value == null) {
            return new JSONArray();
        }
        try {
            Object parsed = value instanceof String ? JSON.parse((String) value) : JSON.parse(JSON.toJSONString(value));
            return parsed instanceof JSONArray ? (JSONArray) parsed : new JSONArray();
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private JSONObject toObject(Object value) {
        if (value instanceof JSONObject) {
            return (JSONObject) value;
        }
        if (value == null) {
            return null;
        }
        try {
            Object parsed = value instanceof String ? JSON.parse((String) value) : JSON.parse(JSON.toJSONString(value));
            return parsed instanceof JSONObject ? (JSONObject) parsed : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private void setIfNotBlank(String value, java.util.function.Consumer<String> setter) {
        if (!isBlank(value)) {
            setter.accept(value.trim());
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
