package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.admin.common.dto.AgentTaskClaimDto;
import com.admin.common.dto.AgentTaskReportDto;
import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.DeployTaskStateDto;
import com.admin.common.dto.OrchestrationPlanDto;
import com.admin.common.lang.R;
import com.admin.entity.ControlServer;
import com.admin.entity.DeployTask;
import com.admin.entity.ProtocolProfile;
import com.admin.mapper.DeployTaskMapper;
import com.admin.service.ControlServerService;
import com.admin.service.DeployTaskService;
import com.admin.service.ProtocolNodeService;
import com.admin.service.ProtocolProfileService;
import com.admin.service.ServerForwardRuleService;
import com.admin.service.SnellTemplateService;
import com.admin.service.XuiOrchestrationScriptService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
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
        String script = "snell".equals(protocol)
                ? snellTemplateService.buildScript(dto, profile)
                : buildXrayAgentPayload(dto, profile, server);

        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setServerId(server.getId());
        task.setServerName(server.getName());
        task.setProtocol(protocol);
        task.setAction(dto.getAction() == null ? "present" : dto.getAction().trim().toLowerCase());
        task.setState(STATE_GENERATED);
        task.setRequestJson(dto.getRequestJson() == null ? JSON.toJSONString(dto) : dto.getRequestJson());
        task.setScript(script);
        task.setStatus(STATUS_ACTIVE);
        task.setCreatedTime(now);
        task.setUpdatedTime(now);

        return this.save(task) ? R.ok(task) : R.err("deploy task create failed");
    }

    @Override
    public R createOrchestrationTask(OrchestrationPlanDto dto) {
        ControlServer server = controlServerService.getById(dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String validationError = validateOrchestration(dto);
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

        return this.save(task) ? R.ok(task) : R.err("orchestration task create failed");
    }

    private String validateOrchestration(OrchestrationPlanDto dto) {
        if (dto == null) {
            return "orchestration plan is required";
        }
        if ("acme-http".equalsIgnoreCase(dto.getCertificateMode())
                && (dto.getCertificateDomain() == null || dto.getCertificateDomain().trim().isEmpty())) {
            return "certificate domain is required for acme-http mode";
        }
        Set<Integer> ports = new HashSet<>();
        String duplicate = addPort(ports, dto.getPanelPort(), "panelPort");
        if (duplicate != null) {
            return duplicate;
        }
        if (enabled(dto.getCreateVlessReality())) {
            duplicate = addPort(ports, dto.getVlessPort(), "vlessPort");
            if (duplicate != null) return duplicate;
        }
        if (enabled(dto.getCreateVmessWs())) {
            duplicate = addPort(ports, dto.getVmessPort(), "vmessPort");
            if (duplicate != null) return duplicate;
        }
        if (enabled(dto.getCreateTrojanTls())) {
            duplicate = addPort(ports, dto.getTrojanPort(), "trojanPort");
            if (duplicate != null) return duplicate;
        }
        if (enabled(dto.getCreateShadowsocks())) {
            duplicate = addPort(ports, dto.getShadowsocksPort(), "shadowsocksPort");
            if (duplicate != null) return duplicate;
        }
        if (enabled(dto.getInstallSnell())) {
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

    private String addPort(Set<Integer> ports, Integer port, String fieldName) {
        if (port == null) {
            return fieldName + " is required";
        }
        if (!ports.add(port)) {
            return "port " + port + " is duplicated in orchestration plan";
        }
        return null;
    }

    private boolean enabled(Boolean value) {
        return value != null && value;
    }

    @Override
    public R getAllTasks() {
        return R.ok(this.list());
    }

    @Override
    public R getTaskScript(Long id) {
        DeployTask task = this.getById(id);
        if (task == null) {
            return R.err("deploy task not found");
        }
        return R.ok(task.getScript());
    }

    @Override
    public R updateTaskState(DeployTaskStateDto dto) {
        DeployTask exists = this.getById(dto.getId());
        if (exists == null) {
            return R.err("deploy task not found");
        }

        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setId(dto.getId());
        task.setState(dto.getState());
        task.setResultJson(dto.getResultJson());
        task.setUpdatedTime(now);
        if ("running".equals(dto.getState())) {
            task.setStartedTime(now);
        }
        if ("succeeded".equals(dto.getState()) || "failed".equals(dto.getState())) {
            task.setFinishedTime(now);
        }

        return this.updateById(task) ? R.ok("deploy task state updated") : R.err("deploy task state update failed");
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

        String state = normalizeAgentState(dto.getState());
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
        if (STATE_SUCCEEDED.equals(state) || STATE_FAILED.equals(state)) {
            task.setFinishedTime(now);
        }

        boolean updated = this.updateById(task);
        if (updated) {
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
        if (server == null || server.getApiToken() == null || !server.getApiToken().equals(token)) {
            return null;
        }
        return server;
    }

    private String normalizeAgentState(String state) {
        if (state == null) {
            return null;
        }
        String normalized = state.trim().toLowerCase();
        if (STATE_RUNNING.equals(normalized) || STATE_SUCCEEDED.equals(normalized) || STATE_FAILED.equals(normalized)) {
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
                setIfNotBlank(serverMeta.getString("xuiApiToken"), update::setXuiApiToken);
                setIfNotBlank(serverMeta.getString("xuiUsername"), update::setXuiUsername);
                setIfNotBlank(serverMeta.getString("xuiPassword"), update::setXuiPassword);
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
}
