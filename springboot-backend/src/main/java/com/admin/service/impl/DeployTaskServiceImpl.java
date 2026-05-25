package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.admin.common.dto.AgentTaskClaimDto;
import com.admin.common.dto.AgentTaskReportDto;
import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.DeployTaskStateDto;
import com.admin.common.dto.OrchestrationPlanDto;
import com.admin.common.lang.R;
import com.admin.common.utils.LowMemoryPolicyUtils;
import com.admin.common.utils.MasterSelfProtectionUtils;
import com.admin.common.utils.ProtocolValidationUtils;
import com.admin.common.utils.SecretCryptoUtils;
import com.admin.entity.ControlServer;
import com.admin.entity.DeployTask;
import com.admin.entity.ProtocolProfile;
import com.admin.mapper.DeployTaskMapper;
import com.admin.service.ControlServerService;
import com.admin.service.DeployTaskService;
import com.admin.service.MonitorAlertService;
import com.admin.service.ProtocolNodeService;
import com.admin.service.ProtocolProfileService;
import com.admin.service.ServerForwardRuleService;
import com.admin.service.SnellTemplateService;
import com.admin.service.XuiOrchestrationScriptService;
import com.admin.runtime.RuntimeProviderService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
public class DeployTaskServiceImpl extends ServiceImpl<DeployTaskMapper, DeployTask> implements DeployTaskService {

    private static final int STATUS_ACTIVE = 1;
    private static final String STATE_GENERATED = "generated";
    private static final String STATE_CLAIMED = "claimed";
    private static final String STATE_RUNNING = "running";
    private static final String STATE_SUCCEEDED = "succeeded";
    private static final String STATE_FAILED = "failed";
    private static final String STATE_TIMEOUT = "timeout";

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private ProtocolProfileService protocolProfileService;

    @Resource
    private SnellTemplateService snellTemplateService;

    @Resource
    private XuiOrchestrationScriptService xuiOrchestrationScriptService;

    @Resource
    private ProtocolNodeService protocolNodeService;

    @Resource
    private ServerForwardRuleService serverForwardRuleService;

    @Resource
    private MonitorAlertService monitorAlertService;

    @Resource
    private SecretCryptoUtils secretCryptoUtils;

    @Resource
    private RuntimeProviderService runtimeProviderService;

    @Override
    public R createTask(DeployTaskDto dto) {
        ControlServer server = controlServerService.getById(dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }

        ProtocolProfile profile = null;
        if (dto.getProfileId() != null) {
            profile = protocolProfileService.getById(dto.getProfileId());
            if (profile == null) {
                return R.err("protocol profile not found");
            }
        }

        String protocol = dto.getProtocol().trim().toLowerCase();
        String validationError = validateDeployTask(dto, profile, protocol);
        if (validationError != null) {
            return R.err(validationError);
        }
        if (isNanoCritical(server) && requiresXrayTask(protocol)) {
            return R.err("server memory is below 200 MB; Nano nodes should use Snell or remote port forwarding instead of Xray/3x-ui deployment tasks");
        }
        Integer listenPort = dto.getListenPort() != null ? dto.getListenPort() : profile == null ? null : profile.getListenPort();
        String masterGuardError = MasterSelfProtectionUtils.validateListenPortAndAction(
                server, listenPort, dto.getAction(), "部署任务", "协议监听端口");
        if (masterGuardError != null) {
            return R.err(masterGuardError);
        }
        String script;
        if ("snell".equals(protocol)) {
            script = snellTemplateService.buildScript(dto, profile);
        } else if ("agent-maintenance".equals(protocol)) {
            script = buildAgentMaintenanceScript(dto, server);
        } else {
            script = buildXrayAgentPayload(dto, profile, server);
        }

        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setServerId(server.getId());
        task.setServerName(server.getName());
        task.setProtocol(protocol);
        task.setAction(normalizeTaskAction(protocol, dto.getAction()));
        task.setState(STATE_GENERATED);
        task.setRequestJson(dto.getRequestJson() == null ? JSON.toJSONString(dto) : dto.getRequestJson());
        task.setScript(script);
        task.setStatus(STATUS_ACTIVE);
        task.setCreatedTime(now);
        task.setUpdatedTime(now);

        if (!this.save(task)) {
            return R.err("deploy task create failed");
        }
        runtimeProviderService.applyToTask(task);
        return R.ok(task);
    }

    @Override
    public R createOrchestrationTask(OrchestrationPlanDto dto) {
        ControlServer server = controlServerService.getById(dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String validationError = validateOrchestration(dto, server);
        if (validationError != null) {
            return R.err(validationError);
        }

        String script = xuiOrchestrationScriptService.buildScript(dto, server);
        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setServerId(server.getId());
        task.setServerName(server.getName());
        task.setProtocol("xui-orchestrator");
        task.setAction("orchestrate");
        task.setState(STATE_GENERATED);
        task.setRequestJson(JSON.toJSONString(dto));
        task.setScript(script);
        task.setStatus(STATUS_ACTIVE);
        task.setCreatedTime(now);
        task.setUpdatedTime(now);

        if (!this.save(task)) {
            return R.err("orchestration task create failed");
        }
        runtimeProviderService.applyToTask(task);
        return R.ok(task);
    }

    private String validateOrchestration(OrchestrationPlanDto dto, ControlServer server) {
        if (dto == null) {
            return "orchestration plan is required";
        }
        if ("acme-http".equalsIgnoreCase(dto.getCertificateMode())
                && (dto.getCertificateDomain() == null || dto.getCertificateDomain().trim().isEmpty())) {
            return "certificate domain is required for acme-http mode";
        }
        if (isNanoCritical(server) && requiresFullXuiStack(dto)) {
            return "server memory is below 200 MB; Nano nodes should use Snell or remote port forwarding instead of full 3x-ui/Xray orchestration";
        }
        if (enabled(dto.getCreateVlessReality())) {
            String realityError = ProtocolValidationUtils.validateReality(dto.getRealitySni(), dto.getRealityDest(), null);
            if (realityError != null) {
                return realityError;
            }
        }
        if (enabled(dto.getInstallSnell()) && dto.getSnellPsk() != null
                && !ProtocolValidationUtils.isValidPsk(dto.getSnellPsk())) {
            return "snell psk is invalid";
        }
        Set<Integer> ports = new HashSet<>();
        String guard = MasterSelfProtectionUtils.validateListenPort(server, dto.getPanelPort(), "面板端口");
        if (guard != null) return guard;
        String duplicate = addPort(ports, dto.getPanelPort(), "panelPort");
        if (duplicate != null) {
            return duplicate;
        }
        if (enabled(dto.getCreateVlessReality())) {
            guard = MasterSelfProtectionUtils.validateListenPort(server, dto.getVlessPort(), "VLESS Reality 端口");
            if (guard != null) return guard;
            duplicate = addPort(ports, dto.getVlessPort(), "vlessPort");
            if (duplicate != null) return duplicate;
        }
        if (enabled(dto.getCreateVmessWs())) {
            guard = MasterSelfProtectionUtils.validateListenPort(server, dto.getVmessPort(), "VMess WS 端口");
            if (guard != null) return guard;
            duplicate = addPort(ports, dto.getVmessPort(), "vmessPort");
            if (duplicate != null) return duplicate;
        }
        if (enabled(dto.getCreateTrojanTls())) {
            guard = MasterSelfProtectionUtils.validateListenPort(server, dto.getTrojanPort(), "Trojan TLS 端口");
            if (guard != null) return guard;
            duplicate = addPort(ports, dto.getTrojanPort(), "trojanPort");
            if (duplicate != null) return duplicate;
        }
        if (enabled(dto.getCreateShadowsocks())) {
            guard = MasterSelfProtectionUtils.validateListenPort(server, dto.getShadowsocksPort(), "Shadowsocks 端口");
            if (guard != null) return guard;
            duplicate = addPort(ports, dto.getShadowsocksPort(), "shadowsocksPort");
            if (duplicate != null) return duplicate;
        }
        if (enabled(dto.getInstallSnell())) {
            guard = MasterSelfProtectionUtils.validateListenPort(server, dto.getSnellPort(), "Snell 端口");
            if (guard != null) return guard;
            duplicate = addPort(ports, dto.getSnellPort(), "snellPort");
            if (duplicate != null) return duplicate;
        }
        if (!enabled(dto.getInstallXui()) && !enabled(dto.getConfigurePanel())
                && !enabled(dto.getCreateVlessReality()) && !enabled(dto.getCreateVmessWs())
                && !enabled(dto.getCreateTrojanTls()) && !enabled(dto.getCreateShadowsocks())
                && !enabled(dto.getInstallSnell())) {
            return "at least one orchestration action is required";
        }
        return null;
    }

    private boolean isNanoCritical(ControlServer server) {
        return server != null
                && LowMemoryPolicyUtils.isNanoCritical(server.getMemoryTotalMb());
    }

    private boolean requiresFullXuiStack(OrchestrationPlanDto dto) {
        return enabled(dto.getInstallXui())
                || enabled(dto.getConfigurePanel())
                || enabled(dto.getCreateVlessReality())
                || enabled(dto.getCreateVmessWs())
                || enabled(dto.getCreateTrojanTls())
                || enabled(dto.getCreateShadowsocks());
    }

    private boolean requiresXrayTask(String protocol) {
        return !"snell".equals(protocol) && !"agent-maintenance".equals(protocol);
    }

    private String validateDeployTask(DeployTaskDto dto, ProtocolProfile profile, String protocol) {
        if ("agent-maintenance".equals(protocol)) {
            String action = dto.getAction() == null || dto.getAction().trim().isEmpty()
                    ? "doctor"
                    : dto.getAction().trim().toLowerCase();
            Set<String> allowedActions = new HashSet<>(Arrays.asList(
                    "doctor", "status", "logs", "restart-agent", "upgrade-agent", "uninstall-agent",
                    "install-diagnose", "cert-diagnose", "firewall-diagnose",
                    "repair-xui", "repair-xray", "repair-snell", "repair-all"));
            return allowedActions.contains(action) ? null : "unsupported agent maintenance action";
        }
        Integer listenPort = dto.getListenPort() != null ? dto.getListenPort() : profile == null ? null : profile.getListenPort();
        if (listenPort != null && !ProtocolValidationUtils.isValidPort(listenPort)) {
            return "listen port is invalid";
        }
        if ("snell".equals(protocol) && dto.getPsk() != null && !ProtocolValidationUtils.isValidPsk(dto.getPsk())) {
            return "snell psk is invalid";
        }
        if (profile != null) {
            String outboundTagError = ProtocolValidationUtils.validateOutboundTags(profile.getConfigJson());
            if (outboundTagError != null) {
                return outboundTagError;
            }
        }
        return null;
    }

    private String addPort(Set<Integer> ports, Integer port, String fieldName) {
        if (port == null) {
            return fieldName + " is required";
        }
        if (!ProtocolValidationUtils.isValidPort(port)) {
            return fieldName + " is invalid";
        }
        if (!ports.add(port)) {
            return "port " + port + " is duplicated in orchestration plan";
        }
        return null;
    }

    private boolean enabled(Boolean value) {
        return value != null && value;
    }

    private String normalizeTaskAction(String protocol, String action) {
        if (action != null && !action.trim().isEmpty()) {
            return action.trim().toLowerCase();
        }
        return "agent-maintenance".equals(protocol) ? "doctor" : "present";
    }

    @Override
    public R getAllTasks() {
        List<DeployTask> tasks = this.list();
        tasks.forEach(runtimeProviderService::applyToTask);
        return R.ok(tasks);
    }

    @Override
    public R getTaskScript(Long id) {
        DeployTask task = this.getById(id);
        if (task == null) {
            return R.err("deploy task not found");
        }
        runtimeProviderService.applyToTask(task);
        return R.ok(task.getScript());
    }

    @Override
    public R updateTaskState(DeployTaskStateDto dto) {
        DeployTask exists = this.getById(dto.getId());
        if (exists == null) {
            return R.err("deploy task not found");
        }
        String state = normalizeTaskState(dto.getState());
        if (state == null) {
            return R.err("unsupported deploy task state");
        }

        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setId(dto.getId());
        task.setState(state);
        task.setResultJson(dto.getResultJson());
        task.setUpdatedTime(now);
        if (STATE_RUNNING.equals(state)) {
            task.setStartedTime(now);
        }
        if (STATE_SUCCEEDED.equals(state) || STATE_FAILED.equals(state) || STATE_TIMEOUT.equals(state)) {
            task.setFinishedTime(now);
        }

        boolean updated = this.updateById(task);
        if (updated) {
            monitorAlertService.handleTaskFailed(exists.getServerId(), exists.getServerName(), exists.getId(),
                    state, dto.getResultJson(), now);
        }
        return updated ? R.ok("deploy task state updated") : R.err("deploy task state update failed");
    }

    @Override
    public R retryTask(Long id) {
        DeployTask exists = this.getById(id);
        if (exists == null) {
            return R.err("deploy task not found");
        }
        String state = exists.getState() == null ? "" : exists.getState().trim().toLowerCase();
        if (!STATE_FAILED.equals(state) && !STATE_TIMEOUT.equals(state)) {
            return R.err("only failed or timeout deploy tasks can be retried");
        }

        long now = System.currentTimeMillis();
        Map<String, Object> retryMeta = new LinkedHashMap<>();
        retryMeta.put("retryFromTaskId", exists.getId());
        retryMeta.put("retryFromState", exists.getState());
        retryMeta.put("retryCreatedAt", now);
        retryMeta.put("originalRequest", parseJsonOrRaw(exists.getRequestJson()));

        DeployTask retry = new DeployTask();
        retry.setServerId(exists.getServerId());
        retry.setServerName(exists.getServerName());
        retry.setProtocol(exists.getProtocol());
        retry.setAction(exists.getAction());
        retry.setState(STATE_GENERATED);
        retry.setRequestJson(JSON.toJSONString(retryMeta));
        retry.setScript(exists.getScript());
        retry.setStatus(STATUS_ACTIVE);
        retry.setCreatedTime(now);
        retry.setUpdatedTime(now);

        if (!this.save(retry)) {
            return R.err("deploy task retry failed");
        }
        runtimeProviderService.applyToTask(retry);
        return R.ok(retry);
    }

    @Override
    public R claimAgentTask(AgentTaskClaimDto dto, String token) {
        ControlServer server = validateAgent(dto.getServerId(), token);
        if (server == null) {
            return R.err(401, "invalid agent token");
        }
        QueryWrapper<DeployTask> query = new QueryWrapper<>();
        query.eq("server_id", server.getId())
                .eq("status", STATUS_ACTIVE)
                .in("state", Arrays.asList(STATE_GENERATED))
                .orderByAsc("id")
                .last("LIMIT 1");
        DeployTask task = this.getOne(query, false);
        if (task == null) {
            return R.ok();
        }

        long now = System.currentTimeMillis();
        DeployTask update = new DeployTask();
        update.setId(task.getId());
        update.setState(STATE_CLAIMED);
        update.setStartedTime(now);
        update.setUpdatedTime(now);
        if (!this.updateById(update)) {
            return R.err("deploy task claim failed");
        }

        Map<String, Object> claimed = new LinkedHashMap<>();
        claimed.put("id", task.getId());
        claimed.put("serverId", task.getServerId());
        claimed.put("serverName", task.getServerName());
        claimed.put("protocol", task.getProtocol());
        claimed.put("action", task.getAction());
        claimed.put("state", STATE_CLAIMED);
        claimed.put("requestJson", task.getRequestJson());
        claimed.put("script", task.getScript());
        claimed.put("runtimeProvider", runtimeProviderService.assign(task.getProtocol(), task.getAction()));
        claimed.put("createdTime", task.getCreatedTime());
        claimed.put("startedTime", now);
        return R.ok(claimed);
    }

    @Override
    public R reportAgentTask(AgentTaskReportDto dto, String token) {
        DeployTask exists = this.getById(dto.getTaskId());
        if (exists == null) {
            return R.err("deploy task not found");
        }
        ControlServer server = validateAgent(exists.getServerId(), token);
        if (server == null) {
            return R.err(401, "invalid agent token");
        }

        String state = normalizeTaskState(dto.getState());
        if (state == null) {
            return R.err("unsupported agent task state");
        }

        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setId(exists.getId());
        task.setState(state);
        task.setResultJson(buildAgentResultJson(dto));
        task.setUpdatedTime(now);
        if (STATE_RUNNING.equals(state) && exists.getStartedTime() == null) {
            task.setStartedTime(now);
        }
        if (STATE_SUCCEEDED.equals(state) || STATE_FAILED.equals(state) || STATE_TIMEOUT.equals(state)) {
            task.setFinishedTime(now);
        }

        boolean updated = this.updateById(task);
        if (updated) {
            monitorAlertService.handleTaskFailed(exists.getServerId(), exists.getServerName(), exists.getId(),
                    state, task.getResultJson(), now);
            applyAgentResultMetadata(exists, task.getResultJson(), state);
        }
        return updated ? R.ok("agent task report accepted") : R.err("agent task report failed");
    }

    @Override
    public R deleteTask(Long id) {
        if (this.getById(id) == null) {
            return R.err("deploy task not found");
        }
        return this.removeById(id) ? R.ok("deploy task deleted") : R.err("deploy task delete failed");
    }

    private ControlServer validateAgent(Long serverId, String token) {
        if (serverId == null || token == null || token.trim().isEmpty()) {
            return null;
        }
        ControlServer server = controlServerService.getById(serverId);
        if (server == null || server.getApiToken() == null || !secretCryptoUtils.decryptIfNeeded(server.getApiToken()).equals(token)) {
            return null;
        }
        return server;
    }

    private String normalizeTaskState(String state) {
        if (state == null) {
            return null;
        }
        String normalized = state.trim().toLowerCase();
        if (STATE_RUNNING.equals(normalized) || STATE_SUCCEEDED.equals(normalized)
                || STATE_FAILED.equals(normalized) || STATE_TIMEOUT.equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private String buildAgentResultJson(AgentTaskReportDto dto) {
        if (dto.getResultJson() != null && !dto.getResultJson().trim().isEmpty()) {
            return dto.getResultJson();
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("exitCode", dto.getExitCode());
        result.put("stdout", truncate(dto.getStdout(), 60000));
        result.put("stderr", truncate(dto.getStderr(), 60000));
        result.put("reportedAt", System.currentTimeMillis());
        return JSON.toJSONString(result);
    }

    private void applyAgentResultMetadata(DeployTask task, String resultJson, String state) {
        if (!STATE_SUCCEEDED.equals(state) || resultJson == null || resultJson.trim().isEmpty()) {
            return;
        }
        try {
            com.alibaba.fastjson2.JSONObject root = JSON.parseObject(resultJson);
            protocolNodeService.applyAgentResultNodes(task, root);
            serverForwardRuleService.applyAgentResultForwardRules(task, root);

            com.alibaba.fastjson2.JSONObject serverMeta = root.getJSONObject("server");
            com.alibaba.fastjson2.JSONObject serviceMeta = root.getJSONObject("services");
            com.alibaba.fastjson2.JSONObject certificateMeta = root.getJSONObject("certificate");
            if (serverMeta == null && serviceMeta == null && certificateMeta == null) {
                return;
            }

            ControlServer update = new ControlServer();
            update.setId(task.getServerId());
            update.setUpdatedTime(System.currentTimeMillis());
            if (serverMeta != null) {
                setIfNotBlank(serverMeta.getString("xuiEndpoint"), update::setXuiEndpoint);
                setIfNotBlank(serverMeta.getString("xuiBasePath"), update::setXuiBasePath);
                setIfNotBlank(serverMeta.getString("xuiApiToken"), value -> update.setXuiApiToken(secretCryptoUtils.encryptIfNeeded(value)));
                setIfNotBlank(serverMeta.getString("xuiUsername"), update::setXuiUsername);
                setIfNotBlank(serverMeta.getString("xuiPassword"), value -> update.setXuiPassword(secretCryptoUtils.encryptIfNeeded(value)));
                setIfNotBlank(serverMeta.getString("xuiTwoFactorCode"), value -> update.setXuiTwoFactorCode(secretCryptoUtils.encryptIfNeeded(value)));
                Integer xuiAllowInsecure = serverMeta.getInteger("xuiAllowInsecure");
                if (xuiAllowInsecure != null) {
                    update.setXuiAllowInsecure(xuiAllowInsecure);
                }
                setIfNotBlank(serverMeta.getString("agentVersion"), update::setAgentVersion);
                setIfNotBlank(serverMeta.getString("xrayVersion"), update::setXrayVersion);
                setIfNotBlank(serverMeta.getString("snellVersion"), update::setSnellVersion);
            }

            if (serviceMeta != null) {
                setIfNotBlank(serviceMeta.getString("xui"), update::setXuiServiceStatus);
                setIfNotBlank(serviceMeta.getString("xray"), update::setXrayServiceStatus);
                setIfNotBlank(serviceMeta.getString("snell"), update::setSnellServiceStatus);
            }

            if (certificateMeta != null) {
                setIfNotBlank(certificateMeta.getString("mode"), update::setCertificateMode);
                setIfNotBlank(certificateMeta.getString("domain"), update::setCertificateDomain);
                setIfNotBlank(certificateMeta.getString("status"), update::setCertificateStatus);
                Long expireAt = certificateMeta.getLong("expireAt");
                if (expireAt != null) {
                    update.setCertificateExpireAt(expireAt);
                }
            }

            update.setLastHeartbeat(System.currentTimeMillis());
            update.setLastError(null);
            update.setStatus(STATUS_ACTIVE);
            controlServerService.updateById(update);
        } catch (Exception ignored) {
            // Result metadata is best-effort; task logs remain the source of truth when parsing fails.
        }
    }

    private void setIfNotBlank(String value, java.util.function.Consumer<String> setter) {
        if (value != null && !value.trim().isEmpty()) {
            setter.accept(value.trim());
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength) + "\n[truncated]";
    }

    private Object parseJsonOrRaw(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        try {
            return JSON.parse(value);
        } catch (Exception ignored) {
            return value;
        }
    }

    private String buildXrayAgentPayload(DeployTaskDto dto, ProtocolProfile profile, ControlServer server) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("serverId", server.getId());
        payload.put("serverName", server.getName());
        payload.put("protocol", dto.getProtocol());
        payload.put("action", dto.getAction() == null ? "present" : dto.getAction());
        payload.put("listenPort", dto.getListenPort() != null ? dto.getListenPort() : profile == null ? null : profile.getListenPort());
        payload.put("profile", profile);
        payload.put("request", dto);

        String json = JSON.toJSONString(payload);
        return "#!/usr/bin/env bash\n"
                + "set -euo pipefail\n"
                + "cat <<'FLUX_XRAY_PAYLOAD'\n"
                + json + "\n"
                + "FLUX_XRAY_PAYLOAD\n"
                + "echo 'Xray/3x-ui agent payload generated. Send it to the flux agent in the next integration step.'\n";
    }

    private String buildAgentMaintenanceScript(DeployTaskDto dto, ControlServer server) {
        String action = dto.getAction() == null || dto.getAction().trim().isEmpty()
                ? "doctor"
                : dto.getAction().trim().toLowerCase();
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("serverId", server.getId());
        request.put("serverName", server.getName());
        request.put("action", action);
        request.put("exactVersion", dto.getExactVersion());
        request.put("requestJson", dto.getRequestJson());
        String requestJson = JSON.toJSONString(request);

        return "#!/usr/bin/env bash\n"
                + "set -euo pipefail\n\n"
                + "ACTION='" + escapeShell(action) + "'\n"
                + "REQUEST_JSON='" + escapeShell(requestJson) + "'\n"
                + "AGENT_BIN='${FLUX_AGENT_BIN:-/usr/local/bin/flux-agent.sh}'\n"
                + "AGENT_ENV='${FLUX_AGENT_ENV:-/etc/flux-agent.env}'\n"
                + "REPO_RAW_URL='${FLUX_REPO_RAW_URL:-https://raw.githubusercontent.com/zhizhishu/flux-3xui-orchestrator/main}'\n"
                + "SOURCE_URL='${FLUX_AGENT_SOURCE_URL:-${REPO_RAW_URL}/scripts/flux-agent.sh}'\n"
                + "LOG_LINES='${FLUX_MAINTENANCE_LOG_LINES:-160}'\n\n"
                + "SERVER_HOST='" + escapeShell(server.getHost()) + "'\n"
                + "XUI_ENDPOINT='" + escapeShell(server.getXuiEndpoint()) + "'\n"
                + "CERTIFICATE_DOMAIN='" + escapeShell(server.getCertificateDomain()) + "'\n"
                + "CERTIFICATE_STATUS='" + escapeShell(server.getCertificateStatus()) + "'\n\n"
                + agentMaintenanceBody();
    }

    private String agentMaintenanceBody() {
        return """
                log() {
                  printf '[flux-maintenance] %s\\n' "$*"
                }

                section() {
                  printf '\\n== %s ==\\n' "$*"
                }

                DIAG_FILE="${TMPDIR:-/tmp}/flux-maintenance-diagnostics-$$.jsonl"
                : > "$DIAG_FILE" 2>/dev/null || true

                first_available_python() {
                  if command -v python3 >/dev/null 2>&1; then
                    command -v python3
                    return
                  fi
                  if command -v python >/dev/null 2>&1; then
                    command -v python
                    return
                  fi
                  return 1
                }

                json_value() {
                  local key="$1"
                  local python_bin
                  python_bin="$(first_available_python 2>/dev/null || true)"
                  [ -n "$python_bin" ] || return 1
                  REQUEST_JSON="$REQUEST_JSON" "$python_bin" - "$key" <<'PY'
                import json
                import os
                import sys

                key = sys.argv[1]
                raw = os.environ.get("REQUEST_JSON") or "{}"

                def parse(value):
                    if not value:
                        return {}
                    try:
                        return json.loads(value)
                    except Exception:
                        return {}

                def pick(root, name):
                    if not isinstance(root, dict):
                        return None
                    if name in root:
                        return root.get(name)
                    for part in ("request", "originalRequest"):
                        child = root.get(part)
                        if isinstance(child, dict) and name in child:
                            return child.get(name)
                    nested = root.get("requestJson")
                    if isinstance(nested, str):
                        return pick(parse(nested), name)
                    return None

                data = parse(raw)
                value = pick(data, key)
                if value is None or value == "":
                    sys.exit(1)
                if isinstance(value, (dict, list)):
                    print(json.dumps(value, ensure_ascii=False))
                else:
                    print(value)
                PY
                }

                diag_item() {
                  local state="$1"
                  local code="$2"
                  local title="$3"
                  local detail="${4:-}"
                  local hint="${5:-}"
                  local python_bin
                  python_bin="$(first_available_python 2>/dev/null || true)"
                  if [ -z "$python_bin" ]; then
                    printf '%s\\t%s\\t%s\\t%s\\t%s\\n' "$state" "$code" "$title" "$detail" "$hint" >> "$DIAG_FILE" 2>/dev/null || true
                    return 0
                  fi
                  FLUX_DIAG_STATE="$state" FLUX_DIAG_CODE="$code" FLUX_DIAG_TITLE="$title" FLUX_DIAG_DETAIL="$detail" FLUX_DIAG_HINT="$hint" "$python_bin" - <<'PY' >> "$DIAG_FILE" 2>/dev/null || true
                import json
                import os

                print(json.dumps({
                    "state": os.environ.get("FLUX_DIAG_STATE", "warning"),
                    "code": os.environ.get("FLUX_DIAG_CODE", "unknown"),
                    "title": os.environ.get("FLUX_DIAG_TITLE", ""),
                    "detail": os.environ.get("FLUX_DIAG_DETAIL", ""),
                    "hint": os.environ.get("FLUX_DIAG_HINT", ""),
                }, ensure_ascii=False, separators=(",", ":")))
                PY
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
                  echo unknown
                }

                service_exists() {
                  local manager="$1"
                  local name="$2"
                  case "$manager" in
                    systemd)
                      systemctl list-unit-files "${name}" --no-legend 2>/dev/null | grep -q . || systemctl status "${name}" >/dev/null 2>&1
                      ;;
                    openrc)
                      [ -x "/etc/init.d/${name%.service}" ] || rc-service "${name%.service}" status >/dev/null 2>&1
                      ;;
                    *)
                      return 1
                      ;;
                  esac
                }

                restart_service() {
                  local manager="$1"
                  local name="$2"
                  case "$manager" in
                    systemd)
                      systemctl daemon-reload || true
                      systemctl enable "$name" >/dev/null 2>&1 || true
                      systemctl restart "$name"
                      systemctl --no-pager --full status "$name" || true
                      ;;
                    openrc)
                      rc-update add "${name%.service}" default >/dev/null 2>&1 || true
                      rc-service "${name%.service}" restart
                      rc-service "${name%.service}" status || true
                      ;;
                    *)
                      echo "systemd or OpenRC is required to repair ${name}." >&2
                      return 1
                      ;;
                  esac
                }

                run_agent_doctor() {
                  if [ -x "$AGENT_BIN" ]; then
                    "$AGENT_BIN" --doctor
                    return
                  fi
                  echo "agent binary not found or not executable: ${AGENT_BIN}" >&2
                  return 1
                }

                flux_agent_status() {
                  local manager
                  manager="$(detect_service_manager)"
                  case "$manager" in
                    systemd)
                      systemctl is-active flux-agent 2>/dev/null || true
                      ;;
                    openrc)
                      if rc-service flux-agent status >/dev/null 2>&1; then
                        echo active
                      else
                        echo inactive
                      fi
                      ;;
                    *)
                      echo unknown
                      ;;
                  esac
                }

                service_status() {
                  local name="$1"
                  local manager
                  manager="$(detect_service_manager)"
                  case "$manager" in
                    systemd)
                      systemctl is-active "$name" 2>/dev/null || true
                      ;;
                    openrc)
                      if rc-service "${name%.service}" status >/dev/null 2>&1; then
                        echo active
                      else
                        echo inactive
                      fi
                      ;;
                    *)
                      echo unknown
                      ;;
                  esac
                }

                tail_agent_logs() {
                  local manager
                  manager="$(detect_service_manager)"
                  echo "== service manager: ${manager}"
                  case "$manager" in
                    systemd)
                      journalctl -u flux-agent.service -n "$LOG_LINES" --no-pager 2>/dev/null || true
                      ;;
                    openrc)
                      tail -n "$LOG_LINES" /var/log/flux-agent.log 2>/dev/null || true
                      tail -n "$LOG_LINES" /var/log/flux-agent.err 2>/dev/null || true
                      ;;
                    *)
                      echo "no systemd/OpenRC logs available"
                      ;;
                  esac
                  echo "== recent task logs"
                  task_files="$(ls -t /var/lib/flux-agent/task-*.out /var/lib/flux-agent/task-*.err 2>/dev/null || true)"
                  if [ -z "$task_files" ]; then
                    echo "no recent task logs"
                    return
                  fi
                  printf '%s\\n' "$task_files" \\
                    | head -n 6 \\
                    | while read -r file; do
                        echo "--- ${file}"
                        tail -n 80 "$file" 2>/dev/null || true
                      done
                }

                schedule_agent_restart() {
                  local manager
                  manager="$(detect_service_manager)"
                  case "$manager" in
                    systemd)
                      nohup sh -c 'sleep 3; systemctl restart flux-agent.service' >/tmp/flux-agent-restart.log 2>&1 &
                      ;;
                    openrc)
                      nohup sh -c 'sleep 3; rc-service flux-agent restart' >/tmp/flux-agent-restart.log 2>&1 &
                      ;;
                    *)
                      echo 'systemd or OpenRC is required to restart the long-running agent service.' >&2
                      return 1
                      ;;
                  esac
                  echo "agent restart scheduled via ${manager}"
                }

                schedule_agent_uninstall() {
                  local manager script
                  manager="$(detect_service_manager)"
                  script="/tmp/flux-agent-uninstall-$$.sh"
                  cat > "$script" <<'UNINSTALL'
                #!/usr/bin/env sh
                sleep 5
                if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
                  systemctl stop flux-agent.service 2>/dev/null || true
                  systemctl disable flux-agent.service 2>/dev/null || true
                  rm -f /etc/systemd/system/flux-agent.service
                  systemctl daemon-reload 2>/dev/null || true
                elif command -v rc-service >/dev/null 2>&1 && command -v rc-update >/dev/null 2>&1; then
                  rc-service flux-agent stop 2>/dev/null || true
                  rc-update del flux-agent default 2>/dev/null || true
                  rm -f /etc/init.d/flux-agent /usr/local/bin/flux-agent-openrc-wrapper.sh
                fi
                rm -f /usr/local/bin/flux-agent.sh /etc/flux-agent.env
                rm -f "$0"
                UNINSTALL
                  chmod 0700 "$script"
                  nohup sh "$script" >/tmp/flux-agent-uninstall.log 2>&1 &
                  echo "agent uninstall scheduled via ${manager}; current task can report before the service is removed"
                }

                upgrade_agent() {
                  local tmp
                  command -v curl >/dev/null 2>&1 || { echo 'curl is required for agent upgrade.' >&2; return 1; }
                  tmp="$(mktemp)"
                  curl -fsSL --retry 3 "$SOURCE_URL" -o "$tmp"
                  bash -n "$tmp"
                  install -m 0755 "$tmp" "$AGENT_BIN"
                  rm -f "$tmp"
                  echo "agent binary updated from ${SOURCE_URL}"
                  schedule_agent_restart
                }

                repair_xui() {
                  local manager
                  manager="$(detect_service_manager)"
                  section "3x-ui repair"
                  if service_exists "$manager" "x-ui.service"; then
                    restart_service "$manager" "x-ui.service"
                  else
                    echo "[fail] 3x-ui service not found. Run one-click orchestration or the 3x-ui installer first."
                    return 1
                  fi
                  if [ -x /usr/local/x-ui/x-ui ]; then
                    /usr/local/x-ui/x-ui setting -show 2>/dev/null || true
                  fi
                }

                repair_xray() {
                  local manager
                  manager="$(detect_service_manager)"
                  section "Xray repair"
                  if [ -x /usr/local/x-ui/bin/xray ]; then
                    /usr/local/x-ui/bin/xray version 2>/dev/null | head -n 1 || true
                  fi
                  if service_exists "$manager" "x-ui.service"; then
                    echo "Restarting x-ui because it owns the embedded Xray runtime."
                    restart_service "$manager" "x-ui.service"
                  elif service_exists "$manager" "xray.service"; then
                    restart_service "$manager" "xray.service"
                  else
                    echo "[fail] Xray service not found. If Xray is embedded in 3x-ui, repair 3x-ui first."
                    return 1
                  fi
                }

                repair_snell() {
                  local manager units unit found
                  manager="$(detect_service_manager)"
                  found=0
                  section "Snell repair"
                  if [ "$manager" = "systemd" ]; then
                    units="$(systemctl list-unit-files 'snell*.service' --no-legend 2>/dev/null | awk '{print $1}' || true)"
                    for unit in $units; do
                      found=1
                      restart_service "$manager" "$unit"
                    done
                  elif [ "$manager" = "openrc" ]; then
                    units="$(ls /etc/init.d/snell* 2>/dev/null | xargs -n1 basename 2>/dev/null || true)"
                    for unit in $units; do
                      found=1
                      restart_service "$manager" "$unit"
                    done
                  fi
                  if [ "$found" -eq 0 ]; then
                    echo "[fail] Snell service not found. Create a Snell node from the master panel first."
                    return 1
                  fi
                }

                diagnose_install() {
                  local manager
                  manager="$(detect_service_manager)"
                  section "Agent install diagnostics"
                  echo "service manager: ${manager}"
                  diag_item ok "agent_service_manager" "服务管理器" "detected ${manager}" "agent 需要 systemd 或 OpenRC 才能长期常驻。"
                  if [ -x "$AGENT_BIN" ]; then
                    echo "[ok] agent binary: ${AGENT_BIN}"
                    diag_item ok "agent_binary" "agent 可执行文件存在" "$AGENT_BIN" ""
                  else
                    echo "[fail] agent binary missing or not executable: ${AGENT_BIN}"
                    diag_item fail "agent_binary_missing" "agent 可执行文件缺失" "$AGENT_BIN" "重新执行被控端安装脚本或一键修复 agent。"
                  fi
                  if [ -r "$AGENT_ENV" ]; then
                    echo "[ok] agent env: ${AGENT_ENV}"
                    diag_item ok "agent_env" "agent 环境文件存在" "$AGENT_ENV" ""
                  else
                    echo "[fail] agent env missing: ${AGENT_ENV}"
                    diag_item fail "agent_env_missing" "agent 环境文件缺失" "$AGENT_ENV" "重新安装 agent，并确认 FLUX_PANEL_URL、FLUX_SERVER_ID、FLUX_AGENT_TOKEN 已写入。"
                  fi
                  if [ -d /var/lib/flux-agent ]; then
                    echo "[ok] work dir: /var/lib/flux-agent"
                    diag_item ok "agent_work_dir" "agent 工作目录存在" "/var/lib/flux-agent" ""
                  else
                    echo "[warn] work dir missing: /var/lib/flux-agent"
                    diag_item warning "agent_work_dir_missing" "agent 工作目录缺失" "/var/lib/flux-agent" "agent 首次运行会创建目录；若任务无法写日志，请检查目录权限。"
                  fi
                  if [ -r "$AGENT_ENV" ]; then
                    grep -E '^(FLUX_PANEL_URL|FLUX_SERVER_ID|FLUX_POLL_INTERVAL)=' "$AGENT_ENV" || true
                    if grep -q '^FLUX_AGENT_TOKEN=' "$AGENT_ENV"; then
                      echo "[ok] agent token: configured"
                      diag_item ok "agent_token" "agent token 已配置" "$AGENT_ENV" ""
                    else
                      echo "[fail] agent token missing"
                      diag_item fail "agent_token_missing" "agent token 缺失" "$AGENT_ENV" "在主控服务器卡片重新查看 Token，并重装/修复被控 agent。"
                    fi
                  fi
                  run_agent_doctor || true
                  section "Agent service status"
                  case "$manager" in
                    systemd)
                      systemctl --no-pager --full status flux-agent.service || true
                      ;;
                    openrc)
                      rc-service flux-agent status || true
                      ;;
                    *)
                      echo "[fail] no running systemd/OpenRC service manager detected"
                      diag_item fail "service_manager_missing" "未检测到 systemd/OpenRC" "$manager" "被控 agent 常驻服务需要 systemd 或 OpenRC；容器测试可忽略。"
                      ;;
                  esac
                }

                public_ip() {
                  command -v curl >/dev/null 2>&1 || return 1
                  curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true
                }

                resolve_domain() {
                  local domain="$1"
                  if command -v getent >/dev/null 2>&1; then
                    getent ahosts "$domain" 2>/dev/null | awk '{print $1}' | sort -u
                    return
                  fi
                  if command -v dig >/dev/null 2>&1; then
                    dig +short A "$domain" 2>/dev/null
                    dig +short AAAA "$domain" 2>/dev/null
                    return
                  fi
                  if command -v nslookup >/dev/null 2>&1; then
                    nslookup "$domain" 2>/dev/null | awk '/Address: / {print $2}'
                  fi
                }

                certificate_domain() {
                  if [ -n "$CERTIFICATE_DOMAIN" ]; then
                    echo "$CERTIFICATE_DOMAIN"
                    return
                  fi
                  json_value certificateDomain 2>/dev/null && return
                  if printf '%s' "$SERVER_HOST" | grep -q '\\.'; then
                    echo "$SERVER_HOST"
                  fi
                }

                diagnose_dns() {
                  local domain ips ip
                  domain="$(certificate_domain || true)"
                  section "DNS diagnostics"
                  if [ -z "$domain" ]; then
                    echo "[warn] DNS 未配置：没有证书域名，也无法从服务器主机名推断域名。"
                    diag_item warning "dns_domain_missing" "DNS 未配置" "没有证书域名，也无法从服务器主机名推断域名。" "ACME HTTP 模式必须填写可公网解析的域名。"
                    return 0
                  fi
                  ips="$(resolve_domain "$domain" | sort -u || true)"
                  if [ -z "$ips" ]; then
                    echo "[fail] DNS 未解析：${domain} 没有解析到 A/AAAA 记录。"
                    diag_item fail "dns_unresolved" "DNS 未解析" "${domain} 没有解析到 A/AAAA 记录。" "到 DNS 服务商添加 A/AAAA 记录，并等待生效后重试证书任务。"
                    return 1
                  fi
                  echo "[ok] DNS records for ${domain}:"
                  printf '%s\\n' "$ips"
                  diag_item ok "dns_resolved" "DNS 已解析" "${domain} -> $(printf '%s' "$ips" | tr '\\n' ' ')" ""
                  ip="$(public_ip || true)"
                  if [ -n "$ip" ]; then
                    echo "detected public ip: ${ip}"
                    if printf '%s\\n' "$ips" | grep -qx "$ip"; then
                      diag_item ok "dns_public_ip_match" "DNS 指向本机公网 IP" "${domain} -> ${ip}" ""
                    else
                      echo "[warn] DNS 解析不指向本机公网 IP；如果使用云 NAT/负载均衡，请确认转发链路。"
                      diag_item warning "dns_public_ip_mismatch" "DNS 未指向本机公网 IP" "resolved=$(printf '%s' "$ips" | tr '\\n' ' '), public=${ip}" "如果使用云 NAT/负载均衡，请确认 80 端口转发到当前被控服务器。"
                    fi
                  else
                    echo "[warn] 无法探测本机公网 IP，跳过 DNS 与公网 IP 对比。"
                    diag_item warning "public_ip_unknown" "无法探测本机公网 IP" "api.ipify.org / ifconfig.me 不可达或 curl 缺失。" "可手动确认域名是否解析到当前服务器公网地址。"
                  fi
                }

                check_port_usage() {
                  local port="$1" listeners
                  section "Port ${port} diagnostics"
                  if command -v ss >/dev/null 2>&1; then
                    listeners="$(ss -ltnup 2>/dev/null | awk -v p=":${port}" '$0 ~ p {print}' || true)"
                  elif command -v netstat >/dev/null 2>&1; then
                    listeners="$(netstat -ltnup 2>/dev/null | awk -v p=":${port}" '$0 ~ p {print}' || true)"
                  elif command -v lsof >/dev/null 2>&1; then
                    listeners="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
                  else
                    echo "[warn] 缺少 ss/netstat/lsof，无法检查端口占用。"
                    diag_item warning "port_check_tool_missing" "无法检查端口占用" "缺少 ss/netstat/lsof。" "安装 iproute2、net-tools 或 lsof 后可获得更准确的端口诊断。"
                    return 0
                  fi
                  if [ -n "$listeners" ]; then
                    printf '%s\\n' "$listeners"
                    diag_item fail "port_${port}_occupied" "${port} 端口被占用" "$listeners" "释放本机 ${port}/tcp，或停止占用服务后再执行 ACME HTTP 证书任务。"
                    return 1
                  fi
                  echo "[ok] TCP/${port} is not listening locally"
                  diag_item ok "port_${port}_free" "${port} 端口本机未占用" "TCP/${port} 未发现监听进程。" ""
                }

                diagnose_firewall() {
                  local firewall_seen
                  firewall_seen=0
                  section "Firewall diagnostics"
                  check_port_usage 80 || true
                  echo "ACME HTTP 需要公网 TCP/80 能访问目标服务器；如果本机检查正常但外部仍失败，通常是云安全组/云防火墙未放行。"
                  diag_item warning "cloud_firewall_check" "云防火墙需确认" "本机只能检查进程和系统防火墙，无法读取云厂商安全组。" "请在云控制台放行 TCP/80，并确认没有上游负载均衡或 NAT 拦截。"
                  if command -v ufw >/dev/null 2>&1; then
                    firewall_seen=1
                    echo "-- ufw"
                    ufw status verbose || true
                    diag_item ok "ufw_present" "检测到 ufw" "已输出 ufw status verbose。" "若 80 不通，请确认 ufw allow 80/tcp。"
                  fi
                  if command -v firewall-cmd >/dev/null 2>&1; then
                    firewall_seen=1
                    echo "-- firewalld"
                    firewall-cmd --state 2>/dev/null || true
                    firewall-cmd --list-all 2>/dev/null || true
                    diag_item ok "firewalld_present" "检测到 firewalld" "已输出 firewalld 状态和规则。" "若 80 不通，请确认 firewall-cmd 已放行 http 或 80/tcp。"
                  fi
                  if command -v nft >/dev/null 2>&1; then
                    firewall_seen=1
                    echo "-- nftables summary"
                    nft list ruleset 2>/dev/null | head -n 120 || true
                    diag_item ok "nftables_present" "检测到 nftables" "已输出前 120 行 nft ruleset。" "请确认 input 链允许 TCP/80。"
                  elif command -v iptables >/dev/null 2>&1; then
                    firewall_seen=1
                    echo "-- iptables summary"
                    iptables -S 2>/dev/null | head -n 120 || true
                    diag_item ok "iptables_present" "检测到 iptables" "已输出前 120 行 iptables 规则。" "请确认 INPUT 链允许 TCP/80。"
                  else
                    echo "[warn] 未发现 ufw/firewalld/nft/iptables 命令，无法读取本机防火墙规则。"
                  fi
                  if [ "$firewall_seen" -eq 0 ]; then
                    diag_item warning "firewall_tool_missing" "无法读取本机防火墙规则" "未发现 ufw/firewalld/nft/iptables 命令。" "如果 80 不通，请手动检查系统防火墙和云安全组。"
                  fi
                }

                diagnose_certificate() {
                  local domain found_cert
                  found_cert=0
                  domain="$(certificate_domain || true)"
                  section "Certificate / ACME diagnostics"
                  echo "stored certificate status: ${CERTIFICATE_STATUS:-unknown}"
                  if [ -z "$domain" ]; then
                    echo "[warn] 证书域名缺失：ACME HTTP 模式必须填写域名。"
                    diag_item warning "certificate_domain_missing" "证书域名缺失" "ACME HTTP 模式必须填写域名。" "在一键编排或服务器配置中填写 certificateDomain。"
                  else
                    echo "certificate domain: ${domain}"
                    diag_item ok "certificate_domain" "证书域名已配置" "$domain" ""
                  fi
                  if [ -n "$domain" ]; then
                    for cert in "/root/.acme.sh/${domain}_ecc/fullchain.cer" "/root/.acme.sh/${domain}/fullchain.cer" "/etc/letsencrypt/live/${domain}/fullchain.pem"; do
                      if [ -f "$cert" ]; then
                        found_cert=1
                        echo "[ok] certificate file: ${cert}"
                        openssl x509 -in "$cert" -noout -subject -issuer -enddate 2>/dev/null || true
                        diag_item ok "certificate_file_found" "证书文件存在" "$cert" ""
                      fi
                    done
                    if [ "$found_cert" -eq 0 ]; then
                      diag_item warning "certificate_file_missing" "未找到本机证书文件" "$domain" "如果这是首次申请证书，该提示可忽略；如果是续期失败，请检查 ACME 日志。"
                    fi
                  fi
                  if command -v acme.sh >/dev/null 2>&1; then
                    diag_item ok "acme_sh_present" "检测到 acme.sh" "$(command -v acme.sh)" ""
                    acme.sh --list || true
                  else
                    diag_item warning "acme_sh_missing" "未检测到 acme.sh" "acme.sh 不在 PATH 中。" "如果使用 acme.sh 申请证书，请确认安装路径和 PATH。"
                  fi
                  if command -v certbot >/dev/null 2>&1; then
                    diag_item ok "certbot_present" "检测到 certbot" "$(command -v certbot)" ""
                    certbot certificates || true
                  else
                    diag_item warning "certbot_missing" "未检测到 certbot" "certbot 不在 PATH 中。" "如果使用 certbot 续期，请确认 certbot 已安装。"
                  fi
                }

                diagnose_acme() {
                  diagnose_dns || true
                  diagnose_firewall || true
                  diagnose_certificate || true
                  echo "结论提示：DNS 未解析、80 端口被占用、系统防火墙未放行、云安全组未放行，都会导致 ACME HTTP 申请或续期失败。"
                }

                emit_result() {
                  local action="$1"
                  local status="$2"
                  local manager
                  local python_bin
                  manager="$(detect_service_manager)"
                  python_bin="$(first_available_python 2>/dev/null || true)"
                  if [ -z "$python_bin" ]; then
                    echo "python3 or python is unavailable; skipping structured maintenance metadata." >&2
                    return 0
                  fi
                  "$python_bin" - "$action" "$status" "$manager" "$(flux_agent_status)" "$(service_status x-ui.service)" "$(service_status snell.service)" "$AGENT_BIN" "$DIAG_FILE" <<'PY' || true
                import json
                import os
                import sys
                import time

                def normalize_state(value):
                    normalized = (value or "").strip().lower()
                    if normalized in ("ok", "success", "succeeded", "pass", "passed"):
                        return "ok"
                    if normalized in ("fail", "failed", "error", "missing", "danger"):
                        return "fail"
                    return "warning"

                def load_diagnostics(path):
                    items = []
                    if not path or not os.path.exists(path):
                        return items
                    try:
                        with open(path, "r", encoding="utf-8", errors="replace") as handle:
                            for line in handle:
                                raw = line.strip()
                                if not raw:
                                    continue
                                try:
                                    item = json.loads(raw)
                                except Exception:
                                    parts = raw.split("\\t")
                                    item = {
                                        "state": parts[0] if len(parts) > 0 else "warning",
                                        "code": parts[1] if len(parts) > 1 else "unknown",
                                        "title": parts[2] if len(parts) > 2 else raw,
                                        "detail": parts[3] if len(parts) > 3 else "",
                                        "hint": parts[4] if len(parts) > 4 else "",
                                    }
                                if not isinstance(item, dict):
                                    continue
                                items.append({
                                    "state": normalize_state(item.get("state")),
                                    "code": str(item.get("code") or "unknown"),
                                    "title": str(item.get("title") or item.get("code") or "diagnostic"),
                                    "detail": str(item.get("detail") or ""),
                                    "hint": str(item.get("hint") or ""),
                                })
                    except Exception as exc:
                        items.append({
                            "state": "warning",
                            "code": "diagnostics_parse_error",
                            "title": "诊断结果解析失败",
                            "detail": str(exc),
                            "hint": "查看原始任务日志确认诊断输出。",
                        })
                    return items

                items = load_diagnostics(sys.argv[8] if len(sys.argv) > 8 else "")
                summary = {
                    "ok": sum(1 for item in items if item.get("state") == "ok"),
                    "warning": sum(1 for item in items if item.get("state") == "warning"),
                    "fail": sum(1 for item in items if item.get("state") == "fail"),
                    "total": len(items),
                }
                payload = {
                    "maintenance": {
                        "action": sys.argv[1],
                        "status": sys.argv[2],
                        "serviceManager": sys.argv[3],
                        "agentServiceStatus": sys.argv[4],
                        "xuiServiceStatus": sys.argv[5],
                        "snellServiceStatus": sys.argv[6],
                        "agentBinary": sys.argv[7],
                        "reportedAt": int(time.time() * 1000),
                    }
                }
                if items:
                    payload["diagnostics"] = {
                        "items": items,
                        "summary": summary,
                    }

                print("FLUX_AGENT_RESULT_JSON=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
                PY
                  rm -f "$DIAG_FILE" 2>/dev/null || true
                }

                case "$ACTION" in
                  doctor|status)
                    run_agent_doctor
                    emit_result "$ACTION" "checked"
                    ;;
                  logs)
                    tail_agent_logs
                    emit_result "$ACTION" "collected"
                    ;;
                  restart-agent)
                    run_agent_doctor || true
                    schedule_agent_restart
                    emit_result "$ACTION" "scheduled"
                    ;;
                  upgrade-agent)
                    upgrade_agent
                    emit_result "$ACTION" "upgraded"
                    ;;
                  uninstall-agent)
                    schedule_agent_uninstall
                    emit_result "$ACTION" "scheduled"
                    ;;
                  install-diagnose)
                    diagnose_install
                    emit_result "$ACTION" "checked"
                    ;;
                  cert-diagnose)
                    diagnose_acme
                    emit_result "$ACTION" "checked"
                    ;;
                  firewall-diagnose)
                    diagnose_firewall
                    emit_result "$ACTION" "checked"
                    ;;
                  repair-xui)
                    repair_xui
                    emit_result "$ACTION" "repaired"
                    ;;
                  repair-xray)
                    repair_xray
                    emit_result "$ACTION" "repaired"
                    ;;
                  repair-snell)
                    repair_snell
                    emit_result "$ACTION" "repaired"
                    ;;
                  repair-all)
                    repair_xui || true
                    repair_xray || true
                    repair_snell || true
                    emit_result "$ACTION" "repaired"
                    ;;
                  *)
                    echo "unsupported agent maintenance action: ${ACTION}" >&2
                    exit 2
                    ;;
                esac
                """;
    }

    private String escapeShell(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("'", "'\"'\"'");
    }
}
