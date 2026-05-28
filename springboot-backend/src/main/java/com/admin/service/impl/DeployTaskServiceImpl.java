package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.AgentTaskClaimDto;
import com.admin.common.dto.AgentTaskReportDto;
import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.DeployTaskStateDto;
import com.admin.common.dto.DeploymentPlanDto;
import com.admin.common.lang.R;
import com.admin.common.utils.LowMemoryPolicyUtils;
import com.admin.common.utils.MasterSelfProtectionUtils;
import com.admin.common.utils.ProtocolValidationUtils;
import com.admin.common.utils.SecretCryptoUtils;
import com.admin.common.utils.JwtUtil;
import com.admin.entity.ControlServer;
import com.admin.entity.DeployTask;
import com.admin.entity.ProtocolProfile;
import com.admin.mapper.DeployTaskMapper;
import com.admin.service.ControlServerService;
import com.admin.service.DeployTaskService;
import com.admin.service.MonitorAlertService;
import com.admin.service.OperationAuditLogService;
import com.admin.service.ProtocolNodeService;
import com.admin.service.ProtocolProfileService;
import com.admin.service.ServerForwardRuleService;
import com.admin.service.SnellTemplateService;
import com.admin.service.XrayRuntimeDeploymentPlanScriptService;
import com.admin.runtime.RuntimeProviderAssignment;
import com.admin.runtime.RuntimeProviderAction;
import com.admin.runtime.RuntimeProviderDescriptor;
import com.admin.runtime.RuntimeProviderService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import java.util.ArrayList;
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
    private XrayRuntimeDeploymentPlanScriptService xrayRuntimeDeploymentPlanScriptService;

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

    @Resource
    private OperationAuditLogService operationAuditLogService;

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
                auditRejectedTask(server, safeProtocol(dto.getProtocol()), dto.getAction(), "protocol profile not found");
                return R.err("protocol profile not found");
            }
        }

        String protocol = dto.getProtocol().trim().toLowerCase();
        String validationError = validateDeployTask(dto, profile, protocol);
        if (validationError != null) {
            auditRejectedTask(server, protocol, dto.getAction(), validationError);
            return R.err(validationError);
        }
        if (isNanoCritical(server) && requiresXrayTask(protocol)) {
            String reason = "server memory is below 200 MB; Nano nodes should use Snell or remote port forwarding instead of full protocol-node deployment tasks";
            auditRejectedTask(server, protocol, dto.getAction(), reason);
            return R.err("server memory is below 200 MB; Nano nodes should use Snell or remote port forwarding instead of full protocol-node deployment tasks");
        }
        Integer listenPort = dto.getListenPort() != null ? dto.getListenPort() : profile == null ? null : profile.getListenPort();
        String masterGuardError = MasterSelfProtectionUtils.validateListenPortAndAction(
                server, listenPort, dto.getAction(), "部署任务", "协议监听端口");
        if (masterGuardError != null) {
            auditRejectedTask(server, protocol, dto.getAction(), masterGuardError);
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
        auditMasterTaskEvent("deploy_task.created", task,
                "requested", "Created deploy task #" + task.getId(), taskDetail(task, "created"));
        return R.ok(taskResponse(task));
    }

    @Override
    public R createDeploymentPlanTask(DeploymentPlanDto dto) {
        ControlServer server = controlServerService.getById(dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String validationError = validateDeploymentPlan(dto, server);
        if (validationError != null) {
            auditRejectedTask(server, RuntimeProviderService.XRAY_DEPLOYMENT_PLAN_PROTOCOL, "deploy-plan", validationError);
            return R.err(validationError);
        }

        String script = xrayRuntimeDeploymentPlanScriptService.buildScript(dto, server);
        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setServerId(server.getId());
        task.setServerName(server.getName());
        task.setProtocol(RuntimeProviderService.XRAY_DEPLOYMENT_PLAN_PROTOCOL);
        task.setAction("deploy-plan");
        task.setState(STATE_GENERATED);
        task.setRequestJson(JSON.toJSONString(dto));
        task.setScript(script);
        task.setStatus(STATUS_ACTIVE);
        task.setCreatedTime(now);
        task.setUpdatedTime(now);

        if (!this.save(task)) {
            return R.err("deployment plan task create failed");
        }
        runtimeProviderService.applyToTask(task);
        auditMasterTaskEvent("deploy_task.plan_created", task,
                "requested", "Created deployment plan task #" + task.getId(), taskDetail(task, "deployment-plan"));
        return R.ok(taskResponse(task));
    }

    private String validateDeploymentPlan(DeploymentPlanDto dto, ControlServer server) {
        if (dto == null) {
            return "deployment plan is required";
        }
        if ("acme-http".equalsIgnoreCase(dto.getCertificateMode())
                && (dto.getCertificateDomain() == null || dto.getCertificateDomain().trim().isEmpty())) {
            return "certificate domain is required for acme-http mode";
        }
        if (isNanoCritical(server) && requiresFullXrayRuntimeStack(dto)) {
            return "server memory is below 200 MB; Nano nodes should use Snell or remote port forwarding instead of full protocol-node deployment";
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
        String guard = MasterSelfProtectionUtils.validateListenPort(server, dto.getRuntimePort(), "节点服务端口");
        if (guard != null) return guard;
        String duplicate = addPort(ports, dto.getRuntimePort(), "runtimePort");
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
        if (!enabled(dto.getInstallXrayRuntime()) && !enabled(dto.getConfigureRuntime())
                && !enabled(dto.getCreateVlessReality()) && !enabled(dto.getCreateVmessWs())
                && !enabled(dto.getCreateTrojanTls()) && !enabled(dto.getCreateShadowsocks())
                && !enabled(dto.getInstallSnell())) {
            return "at least one deployment plan action is required";
        }
        return null;
    }

    private boolean isNanoCritical(ControlServer server) {
        return server != null
                && LowMemoryPolicyUtils.isNanoCritical(server.getMemoryTotalMb());
    }

    private boolean requiresFullXrayRuntimeStack(DeploymentPlanDto dto) {
        return enabled(dto.getInstallXrayRuntime())
                || enabled(dto.getConfigureRuntime())
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
            RuntimeProviderAction actionDescriptor = runtimeProviderService.getAgentMaintenanceAction(action);
            if (actionDescriptor == null) {
                return "unsupported agent maintenance action";
            }
            if (actionDescriptor.isDanger() && !isDangerActionConfirmed(dto.getRequestJson(), action)) {
                return "dangerous agent maintenance action requires dangerConfirmed=true and confirmAction=" + action;
            }
            return null;
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
            return "port " + port + " is duplicated in deployment plan";
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
        List<Map<String, Object>> summaries = new ArrayList<>();
        for (DeployTask task : tasks) {
            summaries.add(taskResponse(task));
        }
        return R.ok(summaries);
    }

    @Override
    public R getRuntimeStateOverview() {
        long now = System.currentTimeMillis();
        List<ControlServer> servers = controlServerService.list();
        Map<Long, ControlServer> serverMap = new LinkedHashMap<>();
        Map<String, Map<String, Object>> latestByServerProvider = new LinkedHashMap<>();

        for (ControlServer server : servers) {
            if (server == null || server.getId() == null) {
                continue;
            }
            serverMap.put(server.getId(), server);
            seedServerProviderRuntimeStates(latestByServerProvider, server, now);
        }

        QueryWrapper<DeployTask> query = new QueryWrapper<>();
        query.eq("status", STATUS_ACTIVE)
                .isNotNull("result_json")
                .orderByDesc("updated_time")
                .orderByDesc("id");
        List<DeployTask> tasks = this.list(query);
        for (DeployTask task : tasks) {
            JSONObject runtimeState = extractRuntimeState(task);
            if (runtimeState == null || runtimeState.isEmpty()) {
                continue;
            }
            String providerKey = runtimeState.getString("providerKey");
            if (!notBlank(providerKey)) {
                RuntimeProviderAssignment assignment = runtimeProviderService.assign(task.getProtocol(), task.getAction());
                providerKey = assignment == null ? "unknown" : assignment.getKey();
            }
            String key = seedKey(task.getServerId(), providerKey);
            Map<String, Object> current = latestByServerProvider.get(key);
            if (current != null && "task".equals(current.get("source"))) {
                continue;
            }
            latestByServerProvider.put(key, runtimeOverviewItem(task, runtimeState, providerKey, serverMap.get(task.getServerId())));
        }

        List<Map<String, Object>> items = new ArrayList<>(latestByServerProvider.values());
        Map<String, Integer> counts = countRuntimeOverview(items);
        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("generatedAt", now);
        overview.put("servers", serverMap.size());
        overview.put("services", runtimeProviderService.listProviders().size());
        overview.putAll(counts);
        overview.put("items", items);
        return R.ok(overview);
    }

    private void seedServerProviderRuntimeStates(Map<String, Map<String, Object>> items,
                                                 ControlServer server,
                                                 long now) {
        JSONObject xrayRuntimeServices = new JSONObject();
        if (notBlank(server.getXrayRuntimeServiceStatus())) {
            xrayRuntimeServices.put("xrayRuntime", server.getXrayRuntimeServiceStatus());
        }
        if (notBlank(server.getXrayServiceStatus())) {
            xrayRuntimeServices.put("xray", server.getXrayServiceStatus());
        }
        String xrayRuntimeStatus = providerServiceStatus("xrayRuntime", xrayRuntimeServices);
        putSeedRuntimeState(items, server, "xrayRuntime", xrayRuntimeStatus, "control_server.services", xrayRuntimeServices, null, null, now);

        JSONObject snellServices = new JSONObject();
        if (notBlank(server.getSnellServiceStatus())) {
            snellServices.put("snell", server.getSnellServiceStatus());
        }
        putSeedRuntimeState(items, server, "snell", server.getSnellServiceStatus(), "control_server.services",
                snellServices, null, null, now);

        String certificateStatus = notBlank(server.getCertificateStatus()) ? server.getCertificateStatus() : null;
        putSeedRuntimeState(items, server, "certificate", certificateStatus, "control_server.certificate",
                null, certificateStatus, server.getCertificateDomain(), now);
    }

    private void putSeedRuntimeState(Map<String, Map<String, Object>> items,
                                     ControlServer server,
                                     String providerKey,
                                     String status,
                                     String statusSource,
                                     JSONObject serviceStatuses,
                                     String certificateStatus,
                                     String certificateDomain,
                                     long now) {
        RuntimeProviderDescriptor provider = runtimeProviderService.getProvider(providerKey);
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("serverId", server.getId());
        item.put("serverName", server.getName());
        item.put("serviceKey", providerKey);
        item.put("serviceName", provider == null ? providerKey : provider.getName());
        item.put("status", notBlank(status) ? status : heartbeatStatus(server, now));
        item.put("statusSource", notBlank(status) ? statusSource : "control_server.heartbeat");
        item.put("stateUpdatedAt", server.getLastHeartbeat() == null ? server.getUpdatedTime() : server.getLastHeartbeat());
        item.put("lastHeartbeat", server.getLastHeartbeat());
        item.put("lastError", server.getLastError());
        item.put("source", "heartbeat");
        if (serviceStatuses != null && !serviceStatuses.isEmpty()) {
            item.put("serviceStatuses", serviceStatuses);
        }
        if (notBlank(certificateStatus)) {
            item.put("certificateStatus", certificateStatus);
        }
        if (notBlank(certificateDomain)) {
            item.put("certificateDomain", certificateDomain);
        }
        if (server.getCertificateExpireAt() != null) {
            item.put("certificateExpireAt", server.getCertificateExpireAt());
        }
        items.put(seedKey(server.getId(), providerKey), item);
    }

    private Map<String, Object> runtimeOverviewItem(DeployTask task,
                                                    JSONObject runtimeState,
                                                    String providerKey,
                                                    ControlServer server) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("serverId", task.getServerId());
        item.put("serverName", notBlank(task.getServerName()) ? task.getServerName() : server == null ? null : server.getName());
        item.put("serviceKey", providerKey);
        String serviceName = runtimeState.getString("serviceName");
        item.put("serviceName", notBlank(serviceName) ? serviceName : runtimeState.getString("providerName"));
        item.put("status", runtimeState.getString("status"));
        item.put("statusSource", runtimeState.getString("statusSource"));
        item.put("protocol", runtimeState.getString("protocol"));
        item.put("action", runtimeState.getString("action"));
        item.put("taskState", runtimeState.getString("taskState"));
        item.put("taskId", task.getId());
        item.put("sourceTaskId", runtimeState.getLong("sourceTaskId"));
        item.put("taskUpdatedAt", task.getUpdatedTime());
        item.put("stateUpdatedAt", runtimeState.getLong("updatedAt"));
        item.put("source", "task");
        putIfPresent(item, "resourceType", runtimeState.getString("resourceType"));
        putIfPresent(item, "resourceId", runtimeState.get("resourceId"));
        putIfPresent(item, "danger", runtimeState.getBoolean("danger"));

        JSONObject serviceStatuses = runtimeState.getJSONObject("serviceStatuses");
        if (serviceStatuses != null && !serviceStatuses.isEmpty()) {
            item.put("serviceStatuses", serviceStatuses);
        }
        putIfPresent(item, "nodeCount", runtimeState.getInteger("nodeCount"));
        putIfPresent(item, "forwardRuleCount", runtimeState.getInteger("forwardRuleCount"));
        putIfPresent(item, "certificateStatus", runtimeState.getString("certificateStatus"));
        putIfPresent(item, "certificateDomain", runtimeState.getString("certificateDomain"));
        JSONObject diagnosticSummary = runtimeState.getJSONObject("diagnosticSummary");
        if (diagnosticSummary != null && !diagnosticSummary.isEmpty()) {
            item.put("diagnosticSummary", diagnosticSummary);
        }
        return item;
    }

    private JSONObject extractRuntimeState(DeployTask task) {
        if (task == null || task.getResultJson() == null || task.getResultJson().trim().isEmpty()) {
            return null;
        }
        try {
            JSONObject root = JSON.parseObject(task.getResultJson());
            JSONObject runtimeState = root.getJSONObject("runtimeState");
            if (runtimeState != null) {
                return runtimeState;
            }
            String nestedResult = root.getString("resultJson");
            if (notBlank(nestedResult)) {
                JSONObject nested = JSON.parseObject(nestedResult);
                return nested.getJSONObject("runtimeState");
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private boolean isDangerActionConfirmed(String requestJson, String action) {
        if (!notBlank(requestJson) || !notBlank(action)) {
            return false;
        }
        try {
            JSONObject request = JSON.parseObject(requestJson);
            if (request == null || !request.getBooleanValue("dangerConfirmed")) {
                return false;
            }
            String confirmAction = request.getString("confirmAction");
            if (!notBlank(confirmAction)) {
                confirmAction = request.getString("confirmText");
            }
            return action.trim().equalsIgnoreCase(confirmAction == null ? null : confirmAction.trim());
        } catch (Exception ignored) {
            return false;
        }
    }

    private Map<String, Integer> countRuntimeOverview(List<Map<String, Object>> items) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("healthy", 0);
        counts.put("warning", 0);
        counts.put("failed", 0);
        counts.put("unknown", 0);
        for (Map<String, Object> item : items) {
            String bucket = runtimeHealth(item == null ? null : String.valueOf(item.get("status")));
            counts.put(bucket, counts.get(bucket) + 1);
        }
        return counts;
    }

    private String runtimeHealth(String status) {
        if (!notBlank(status)) {
            return "unknown";
        }
        String normalized = status.trim().toLowerCase();
        if (Arrays.asList("active", "valid", "running", "healthy", "ok", "success", "succeeded", "synced").contains(normalized)) {
            return "healthy";
        }
        if (Arrays.asList("mixed", "warning", "expiring", "unknown", "not-installed", "pending", "generated", "claimed", "stale").contains(normalized)) {
            return "warning";
        }
        if (Arrays.asList("failed", "fail", "error", "danger", "missing", "timeout", "inactive", "expired", "unreadable", "offline").contains(normalized)) {
            return "failed";
        }
        return "unknown";
    }

    private String heartbeatStatus(ControlServer server, long now) {
        if (server == null || server.getLastHeartbeat() == null) {
            return "unknown";
        }
        if (now - server.getLastHeartbeat() > 90000) {
            return "stale";
        }
        return notBlank(server.getLastError()) ? "warning" : "healthy";
    }

    private String seedKey(Object serverId, String providerKey) {
        return String.valueOf(serverId) + ":" + (providerKey == null ? "unknown" : providerKey);
    }

    private void putIfPresent(Map<String, Object> item, String key, Object value) {
        if (value != null) {
            item.put(key, value);
        }
    }

    @Override
    public R getTaskScript(Long id) {
        DeployTask task = this.getById(id);
        if (task == null) {
            return R.err("deploy task not found");
        }
        return R.err(410, "task scripts are only delivered to the controlled agent");
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
        String previousState = exists.getState();
        String sanitizedResultJson = sanitizeAgentResultJson(dto.getResultJson());
        DeployTask task = new DeployTask();
        task.setId(dto.getId());
        task.setState(state);
        task.setResultJson(sanitizedResultJson);
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
                    state, sanitizedResultJson, now);
            exists.setState(state);
            exists.setResultJson(sanitizedResultJson);
            runtimeProviderService.applyToTask(exists);
            Map<String, Object> detail = taskDetail(exists, "state-updated");
            detail.put("previousState", previousState);
            detail.put("requestedState", state);
            auditMasterTaskEvent("deploy_task.state_updated", exists,
                    "updated", "Updated deploy task #" + exists.getId() + " state to " + state, detail);
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
        Map<String, Object> detail = taskDetail(retry, "retried");
        detail.put("retryFromTaskId", exists.getId());
        detail.put("retryFromState", exists.getState());
        auditMasterTaskEvent("deploy_task.retried", retry,
                "requested", "Retried deploy task #" + exists.getId() + " as #" + retry.getId(), detail);
        return R.ok(taskResponse(retry));
    }

    @Override
    public R claimAgentTask(AgentTaskClaimDto dto, String token) {
        ControlServer server = validateAgent(dto.getServerId(), token);
        if (server == null) {
            return R.err(401, "invalid agent token");
        }
        for (int attempt = 0; attempt < 3; attempt++) {
            QueryWrapper<DeployTask> query = new QueryWrapper<>();
            query.eq("server_id", server.getId())
                    .eq("status", STATUS_ACTIVE)
                    .eq("state", STATE_GENERATED)
                    .orderByAsc("id")
                    .last("LIMIT 1");
            DeployTask task = this.getOne(query, false);
            if (task == null) {
                return R.ok();
            }

            long now = System.currentTimeMillis();
            if (markTaskClaimed(task.getId(), server.getId(), now)) {
                runtimeProviderService.applyToTask(task);
                auditTaskEvent("agent_task.claimed", "agent", String.valueOf(server.getId()), server.getName(), task,
                        "claimed", "Agent claimed task #" + task.getId(), taskDetail(task, "claimed"));
                return R.ok(claimedTaskPayload(task, now));
            }
        }
        return R.ok();
    }

    private boolean markTaskClaimed(Long taskId, Long serverId, long now) {
        DeployTask update = new DeployTask();
        update.setState(STATE_CLAIMED);
        update.setStartedTime(now);
        update.setUpdatedTime(now);
        UpdateWrapper<DeployTask> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", taskId)
                .eq("server_id", serverId)
                .eq("status", STATUS_ACTIVE)
                .eq("state", STATE_GENERATED);
        return this.update(update, wrapper);
    }

    private Map<String, Object> claimedTaskPayload(DeployTask task, long now) {
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
        return claimed;
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
        String agentResultJson = buildAgentResultJson(dto, exists, state);
        task.setResultJson(sanitizeAgentResultJson(agentResultJson));
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
            applyAgentResultMetadata(exists, agentResultJson, state);
            auditTaskEvent("agent_task.reported", "agent", String.valueOf(server.getId()), server.getName(), exists,
                    state, "Agent reported task #" + exists.getId() + " as " + state,
                    agentReportDetail(exists, dto, state, task.getResultJson()));
        }
        return updated ? R.ok("agent task report accepted") : R.err("agent task report failed");
    }

    private void auditRejectedTask(ControlServer server, String protocol, String action, String reason) {
        if (server == null) {
            return;
        }
        DeployTask draft = new DeployTask();
        draft.setServerId(server.getId());
        draft.setServerName(server.getName());
        draft.setProtocol(protocol);
        draft.setAction(normalizeTaskAction(protocol, action));

        Map<String, Object> detail = taskDetail(draft, "rejected");
        detail.put("reason", reason);
        auditMasterTaskEvent("deploy_task.rejected", draft,
                "rejected", "Rejected " + protocol + " task: " + reason, detail);
    }

    private void auditMasterTaskEvent(String eventType,
                                      DeployTask task,
                                      String outcome,
                                      String summary,
                                      Map<String, Object> detail) {
        AuditActor actor = currentMasterActor();
        auditTaskEvent(eventType, actor.type, actor.id, actor.name, task, outcome, summary, detail);
    }

    private void auditTaskEvent(String eventType,
                                String actorType,
                                String actorId,
                                String actorName,
                                DeployTask task,
                                String outcome,
                                String summary,
                                Map<String, Object> detail) {
        if (operationAuditLogService == null || task == null) {
            return;
        }
        RuntimeProviderAssignment provider = task.getRuntimeProvider();
        if (provider == null && runtimeProviderService != null) {
            provider = runtimeProviderService.assign(task.getProtocol(), task.getAction());
        }
        boolean danger = isDangerAuditTask(task);
        operationAuditLogService.recordTaskEvent(eventType, actorType, actorId, actorName, task, provider,
                danger, outcome, summary, detail);
    }

    private AuditActor currentMasterActor() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes == null) {
                return AuditActor.unknownMaster();
            }
            HttpServletRequest request = attributes.getRequest();
            String token = normalizeAuthorizationToken(request.getHeader("Authorization"));
            if (token == null || token.isEmpty()) {
                return AuditActor.unknownMaster();
            }
            Long userId = JwtUtil.getUserIdFromToken(token);
            String name = JwtUtil.getNameFromToken(token);
            String id = userId == null ? "unknown" : String.valueOf(userId);
            if (name == null || name.trim().isEmpty()) {
                name = "user#" + id;
            }
            return new AuditActor("master-user", id, name);
        } catch (Exception ex) {
            return AuditActor.unknownMaster();
        }
    }

    private String normalizeAuthorizationToken(String token) {
        if (token == null) {
            return null;
        }
        String trimmed = token.trim();
        if (trimmed.toLowerCase().startsWith("bearer ")) {
            return trimmed.substring(7).trim();
        }
        return trimmed;
    }

    private boolean isDangerAuditTask(DeployTask task) {
        return task != null
                && runtimeProviderService != null
                && "agent-maintenance".equals(task.getProtocol())
                && runtimeProviderService.isDangerAgentMaintenanceAction(task.getAction());
    }

    private Map<String, Object> taskDetail(DeployTask task, String phase) {
        Map<String, Object> detail = new LinkedHashMap<>();
        if (task == null) {
            return detail;
        }
        detail.put("phase", phase);
        detail.put("taskId", task.getId());
        detail.put("serverId", task.getServerId());
        detail.put("serverName", task.getServerName());
        detail.put("protocol", task.getProtocol());
        detail.put("action", task.getAction());
        detail.put("state", task.getState());
        detail.put("danger", isDangerAuditTask(task));
        return detail;
    }

    private Map<String, Object> taskResponse(DeployTask task) {
        Map<String, Object> item = new LinkedHashMap<>();
        if (task == null) {
            return item;
        }
        item.put("id", task.getId());
        item.put("serverId", task.getServerId());
        item.put("serverName", task.getServerName());
        item.put("protocol", task.getProtocol());
        item.put("action", task.getAction());
        item.put("state", task.getState());
        item.put("status", task.getStatus());
        item.put("createdTime", task.getCreatedTime());
        item.put("updatedTime", task.getUpdatedTime());
        item.put("startedTime", task.getStartedTime());
        item.put("finishedTime", task.getFinishedTime());
        item.put("hasScript", notBlank(task.getScript()));
        item.put("requestSummary", summarizeJson(task.getRequestJson()));
        item.put("resultSummary", summarizeJson(task.getResultJson()));
        return item;
    }

    private Object summarizeJson(String value) {
        if (!notBlank(value)) {
            return null;
        }
        String sanitized = sanitizeAgentResultJson(value);
        try {
            JSONObject object = JSON.parseObject(sanitized);
            Map<String, Object> summary = new LinkedHashMap<>();
            for (String key : object.keySet()) {
                if (isInternalSummaryKey(key)) {
                    continue;
                }
                Object child = object.get(key);
                if (child == null || child instanceof String || child instanceof Number || child instanceof Boolean) {
                    summary.put(key, child);
                }
                if (summary.size() >= 12) {
                    break;
                }
            }
            return summary;
        } catch (Exception ignored) {
            return sanitized.length() > 500 ? sanitized.substring(0, 500) + "..." : sanitized;
        }
    }

    private boolean isInternalSummaryKey(String key) {
        if (key == null) {
            return false;
        }
        String normalized = key.replaceAll("[^A-Za-z0-9]", "").toLowerCase();
        return normalized.equals("runtimeprovider")
                || normalized.equals("rawresultjson")
                || normalized.equals("requestjson")
                || normalized.equals("resultjson")
                || normalized.equals("script");
    }

    private String safeProtocol(String protocol) {
        return protocol == null || protocol.trim().isEmpty() ? "unknown" : protocol.trim().toLowerCase();
    }

    private static class AuditActor {
        private final String type;
        private final String id;
        private final String name;

        private AuditActor(String type, String id, String name) {
            this.type = type;
            this.id = id;
            this.name = name;
        }

        private static AuditActor unknownMaster() {
            return new AuditActor("master-unknown", "unknown", "Unknown master user");
        }
    }

    private Map<String, Object> agentReportDetail(DeployTask task, AgentTaskReportDto dto, String state, String resultJson) {
        Map<String, Object> detail = taskDetail(task, "reported");
        detail.put("reportedState", state);
        detail.put("exitCode", dto.getExitCode());
        detail.put("stdoutLength", dto.getStdout() == null ? 0 : dto.getStdout().length());
        detail.put("stderrLength", dto.getStderr() == null ? 0 : dto.getStderr().length());
        detail.put("resultJsonLength", resultJson == null ? 0 : resultJson.length());
        return detail;
    }

    @Override
    public R deleteTask(Long id) {
        DeployTask exists = this.getById(id);
        if (exists == null) {
            return R.err("deploy task not found");
        }
        runtimeProviderService.applyToTask(exists);
        boolean deleted = this.removeById(id);
        if (deleted) {
            auditMasterTaskEvent("deploy_task.deleted", exists,
                    "deleted", "Deleted deploy task #" + exists.getId(), taskDetail(exists, "deleted"));
        }
        return deleted ? R.ok("deploy task deleted") : R.err("deploy task delete failed");
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

    private String buildAgentResultJson(AgentTaskReportDto dto, DeployTask task, String state) {
        String resultJson;
        if (dto.getResultJson() != null && !dto.getResultJson().trim().isEmpty()) {
            resultJson = dto.getResultJson();
        } else {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("exitCode", dto.getExitCode());
            result.put("stdout", truncate(dto.getStdout(), 60000));
            result.put("stderr", truncate(dto.getStderr(), 60000));
            result.put("reportedAt", System.currentTimeMillis());
            resultJson = JSON.toJSONString(result);
        }
        return attachRuntimeMetadata(resultJson, task, state);
    }

    private String sanitizeAgentResultJson(String resultJson) {
        if (resultJson == null || resultJson.trim().isEmpty()) {
            return resultJson;
        }
        try {
            JSONObject root = JSON.parseObject(resultJson);
            redactServerSecret(root.getJSONObject("server"), "xrayRuntimeApiToken", "xrayRuntimeApiTokenConfigured");
            redactServerSecret(root.getJSONObject("server"), "xrayRuntimePassword", "xrayRuntimePasswordConfigured");
            redactServerSecret(root.getJSONObject("server"), "xrayRuntimeTwoFactorCode", "xrayRuntimeTwoFactorConfigured");
            root.remove("serverSecrets");
            redactSensitiveValues(root);
            return JSON.toJSONString(root);
        } catch (Exception ignored) {
            return sanitizeTextForDisplay(resultJson);
        }
    }

    private void redactSensitiveValues(Object value) {
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject) value;
            for (String key : new ArrayList<>(object.keySet())) {
                Object child = object.get(key);
                if (isSensitiveKey(key)) {
                    object.put(key, redactValue(child));
                } else {
                    redactSensitiveValues(child);
                }
            }
            return;
        }
        if (value instanceof JSONArray) {
            JSONArray array = (JSONArray) value;
            for (Object child : array) {
                redactSensitiveValues(child);
            }
        }
    }

    private boolean isSensitiveKey(String key) {
        if (key == null) {
            return false;
        }
        String normalized = key.toLowerCase();
        return normalized.contains("token")
                || normalized.contains("password")
                || normalized.contains("passwd")
                || normalized.contains("secret")
                || normalized.contains("privatekey")
                || normalized.contains("private_key")
                || normalized.equals("psk")
                || normalized.equals("script")
                || normalized.equals("stdout")
                || normalized.equals("stderr")
                || normalized.equals("requestjson")
                || normalized.equals("rawresultjson");
    }

    private Object redactValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String) {
            String text = (String) value;
            return text.isEmpty() ? text : "[redacted:" + text.length() + "]";
        }
        return "[redacted]";
    }

    private String sanitizeScriptForDisplay(String script) {
        return sanitizeTextForDisplay(script);
    }

    private String sanitizeTextForDisplay(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        String sanitized = text;
        sanitized = sanitized.replaceAll("(?im)^([A-Z0-9_]*(TOKEN|PASSWORD|PASSWD|SECRET|PRIVATE_KEY|PRIVATEKEY|PSK)[A-Z0-9_]*=).*$", "$1'[redacted]'");
        sanitized = sanitized.replaceAll("(?i)(Bearer\\s+)[A-Za-z0-9._~+\\-/]+=*", "$1[redacted]");
        sanitized = sanitized.replaceAll("(?i)(psk\\s*=\\s*)[^\\s,;]+", "$1[redacted]");
        sanitized = sanitized.replaceAll("(?i)(privateKey\\\"?\\s*[:=]\\s*\\\"?)[^\\\"\\s,;}]+", "$1[redacted]");
        return sanitized;
    }

    private void redactServerSecret(JSONObject serverMeta, String secretKey, String configuredKey) {
        if (serverMeta == null || !serverMeta.containsKey(secretKey)) {
            return;
        }
        if (notBlank(serverMeta.getString(secretKey))) {
            serverMeta.put(configuredKey, true);
        }
        serverMeta.remove(secretKey);
    }

    private String attachRuntimeMetadata(String resultJson, DeployTask task, String taskState) {
        if (task == null) {
            return resultJson;
        }
        RuntimeProviderAssignment provider = runtimeProviderService.assign(task.getProtocol(), task.getAction());
        if (provider == null) {
            return resultJson;
        }
        JSONObject result;
        try {
            result = JSON.parseObject(resultJson);
        } catch (Exception ignored) {
            result = new JSONObject();
            result.put("rawResultJson", resultJson);
            result.put("reportedAt", System.currentTimeMillis());
        }
        result.put("runtimeProvider", provider);
        Object runtimeStateValue = result.get("runtimeState");
        if (!(runtimeStateValue instanceof JSONObject)) {
            result.put("runtimeState", buildRuntimeState(result, task, provider, taskState));
        } else {
            enrichRuntimeStateTrace((JSONObject) runtimeStateValue, result, task, provider, taskState);
        }
        return JSON.toJSONString(result);
    }

    private JSONObject buildRuntimeState(JSONObject result,
                                         DeployTask task,
                                         RuntimeProviderAssignment provider,
                                         String taskState) {
        JSONObject runtimeState = new JSONObject();
        runtimeState.put("providerKey", provider.getKey());
        runtimeState.put("providerName", provider.getName());
        runtimeState.put("protocol", task.getProtocol());
        runtimeState.put("action", task.getAction());
        runtimeState.put("taskState", normalizeTaskStateForAudit(taskState));
        runtimeState.put("source", "task");
        runtimeState.put("sourceTaskId", task.getId());
        runtimeState.put("serverId", task.getServerId());
        runtimeState.put("serverName", task.getServerName());
        runtimeState.put("resourceType", runtimeResourceType(provider.getKey()));
        putRuntimeValue(runtimeState, "resourceId", runtimeResourceId(result));
        runtimeState.put("danger", runtimeProviderService.isDangerAgentMaintenanceAction(task.getAction()));

        JSONObject serviceStatuses = result.getJSONObject("services");
        if (serviceStatuses != null && !serviceStatuses.isEmpty()) {
            runtimeState.put("serviceStatuses", serviceStatuses);
        }

        JSONArray protocolNodes = result.getJSONArray("protocolNodes");
        if (protocolNodes != null) {
            runtimeState.put("nodeCount", protocolNodes.size());
        }

        JSONArray forwardRules = result.getJSONArray("forwardRules");
        if (forwardRules != null) {
            runtimeState.put("forwardRuleCount", forwardRules.size());
        }

        JSONObject certificate = result.getJSONObject("certificate");
        if (certificate != null) {
            runtimeState.put("certificateStatus", certificate.getString("status"));
            runtimeState.put("certificateDomain", certificate.getString("domain"));
        }

        JSONObject diagnosticSummary = summarizeDiagnostics(result.getJSONObject("diagnostics"));
        if (diagnosticSummary != null) {
            runtimeState.put("diagnosticSummary", diagnosticSummary);
        }

        RuntimeStatus runtimeStatus = resolveRuntimeStatus(provider, taskState, serviceStatuses,
                protocolNodes, forwardRules, certificate, diagnosticSummary);
        runtimeState.put("status", runtimeStatus.status);
        runtimeState.put("statusSource", runtimeStatus.source);
        runtimeState.put("updatedAt", System.currentTimeMillis());
        return runtimeState;
    }

    private void enrichRuntimeStateTrace(JSONObject runtimeState,
                                         JSONObject result,
                                         DeployTask task,
                                         RuntimeProviderAssignment provider,
                                         String taskState) {
        runtimeState.put("providerKey", provider.getKey());
        runtimeState.put("providerName", provider.getName());
        runtimeState.put("protocol", task.getProtocol());
        runtimeState.put("action", task.getAction());
        runtimeState.put("taskState", normalizeTaskStateForAudit(taskState));
        runtimeState.put("source", "task");
        runtimeState.put("sourceTaskId", task.getId());
        runtimeState.put("serverId", task.getServerId());
        runtimeState.put("serverName", task.getServerName());
        runtimeState.put("resourceType", runtimeResourceType(provider.getKey()));
        Object resourceId = runtimeResourceId(result);
        if (resourceId == null) {
            runtimeState.remove("resourceId");
        } else {
            runtimeState.put("resourceId", resourceId);
        }
        runtimeState.put("danger", runtimeProviderService.isDangerAgentMaintenanceAction(task.getAction()));
        JSONObject serviceStatuses = result.getJSONObject("services");
        if (serviceStatuses == null || serviceStatuses.isEmpty()) {
            serviceStatuses = runtimeState.getJSONObject("serviceStatuses");
        }
        JSONArray protocolNodes = result.getJSONArray("protocolNodes");
        JSONArray forwardRules = result.getJSONArray("forwardRules");
        JSONObject certificate = result.getJSONObject("certificate");
        if (certificate == null && (notBlank(runtimeState.getString("certificateStatus")) || notBlank(runtimeState.getString("certificateDomain")))) {
            certificate = new JSONObject();
            putRuntimeValue(certificate, "status", runtimeState.getString("certificateStatus"));
            putRuntimeValue(certificate, "domain", runtimeState.getString("certificateDomain"));
        }
        JSONObject diagnosticSummary = summarizeDiagnostics(result.getJSONObject("diagnostics"));
        if (diagnosticSummary == null) {
            diagnosticSummary = runtimeState.getJSONObject("diagnosticSummary");
        }
        RuntimeStatus runtimeStatus = resolveRuntimeStatus(provider, taskState, serviceStatuses,
                protocolNodes, forwardRules, certificate, diagnosticSummary);
        runtimeState.put("status", runtimeStatus.status);
        runtimeState.put("statusSource", runtimeStatus.source);
        runtimeState.put("updatedAt", System.currentTimeMillis());
    }

    private String runtimeResourceType(String providerKey) {
        if ("xrayRuntime".equals(providerKey) || "snell".equals(providerKey)) {
            return "protocol-node";
        }
        if ("forward".equals(providerKey)) {
            return "forward-rule";
        }
        if ("certificate".equals(providerKey)) {
            return "certificate";
        }
        if ("firewall".equals(providerKey)) {
            return "firewall-rule";
        }
        return "runtime";
    }

    private Object runtimeResourceId(JSONObject result) {
        if (result == null) {
            return null;
        }
        for (String key : Arrays.asList("resourceId", "remoteId", "inboundId", "serviceName")) {
            Object value = result.get(key);
            if (value != null && notBlank(String.valueOf(value))) {
                return value;
            }
        }
        JSONArray protocolNodes = result.getJSONArray("protocolNodes");
        Object nodeResource = firstArrayResourceId(protocolNodes);
        if (nodeResource != null) {
            return nodeResource;
        }
        JSONArray forwardRules = result.getJSONArray("forwardRules");
        return firstArrayResourceId(forwardRules);
    }

    private Object firstArrayResourceId(JSONArray items) {
        if (items == null || items.size() != 1 || !(items.get(0) instanceof JSONObject)) {
            return null;
        }
        JSONObject item = items.getJSONObject(0);
        for (String key : Arrays.asList("id", "remoteId", "serviceName", "listenPort")) {
            Object value = item.get(key);
            if (value != null && notBlank(String.valueOf(value))) {
                return value;
            }
        }
        return null;
    }

    private void putRuntimeValue(JSONObject item, String key, Object value) {
        if (value != null) {
            item.put(key, value);
        }
    }

    private RuntimeStatus resolveRuntimeStatus(RuntimeProviderAssignment provider,
                                               String taskState,
                                               JSONObject serviceStatuses,
                                               JSONArray protocolNodes,
                                               JSONArray forwardRules,
                                               JSONObject certificate,
                                               JSONObject diagnosticSummary) {
        String normalizedTaskState = normalizeTaskStateForAudit(taskState);
        if (STATE_FAILED.equals(normalizedTaskState) || STATE_TIMEOUT.equals(normalizedTaskState)) {
            return new RuntimeStatus(normalizedTaskState, "task");
        }
        String providerKey = provider.getKey();
        String serviceStatus = providerServiceStatus(providerKey, serviceStatuses);
        if (notBlank(serviceStatus)) {
            return new RuntimeStatus(serviceStatus, "services." + providerKey);
        }
        String nodeState = commonObjectState(protocolNodes, "state");
        if (notBlank(nodeState)) {
            return new RuntimeStatus(nodeState, "protocolNodes");
        }
        String forwardState = commonObjectState(forwardRules, "state");
        if (notBlank(forwardState)) {
            return new RuntimeStatus(forwardState, "forwardRules");
        }
        if (certificate != null && notBlank(certificate.getString("status"))) {
            return new RuntimeStatus(certificate.getString("status"), "certificate.status");
        }
        if (diagnosticSummary != null) {
            if (diagnosticSummary.getIntValue("fail") > 0) {
                return new RuntimeStatus("failed", "diagnostics");
            }
            if (diagnosticSummary.getIntValue("warning") > 0) {
                return new RuntimeStatus("warning", "diagnostics");
            }
            if (diagnosticSummary.getIntValue("ok") > 0) {
                return new RuntimeStatus("ok", "diagnostics");
            }
        }
        return new RuntimeStatus(notBlank(normalizedTaskState) ? normalizedTaskState : "unknown", "task");
    }

    private String providerServiceStatus(String providerKey, JSONObject services) {
        if (services == null || services.isEmpty()) {
            return null;
        }
        if ("xrayRuntime".equals(providerKey)) {
            String xray = services.getString("xray");
            return notBlank(xray) ? xray : services.getString("xrayRuntime");
        }
        if ("snell".equals(providerKey)) {
            return services.getString("snell");
        }
        return services.getString(providerKey);
    }

    private String commonObjectState(JSONArray values, String fieldName) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        String common = null;
        for (Object value : values) {
            if (!(value instanceof JSONObject)) {
                continue;
            }
            String state = ((JSONObject) value).getString(fieldName);
            if (!notBlank(state)) {
                continue;
            }
            if (common == null) {
                common = state;
            } else if (!common.equalsIgnoreCase(state)) {
                return "mixed";
            }
        }
        return common;
    }

    private JSONObject summarizeDiagnostics(JSONObject diagnostics) {
        if (diagnostics == null) {
            return null;
        }
        JSONArray items = diagnostics.getJSONArray("items");
        if (items == null || items.isEmpty()) {
            return null;
        }
        int ok = 0;
        int warning = 0;
        int fail = 0;
        for (Object item : items) {
            if (!(item instanceof JSONObject)) {
                continue;
            }
            String state = normalizeDiagnosticState(((JSONObject) item).getString("state"));
            if ("ok".equals(state)) {
                ok += 1;
            } else if ("fail".equals(state)) {
                fail += 1;
            } else {
                warning += 1;
            }
        }
        JSONObject summary = new JSONObject();
        summary.put("ok", ok);
        summary.put("warning", warning);
        summary.put("fail", fail);
        summary.put("total", ok + warning + fail);
        return summary;
    }

    private String normalizeDiagnosticState(String state) {
        String normalized = state == null ? "" : state.trim().toLowerCase();
        if (Arrays.asList("ok", "success", "succeeded", "pass", "passed").contains(normalized)) {
            return "ok";
        }
        if (Arrays.asList("fail", "failed", "error", "danger", "missing").contains(normalized)) {
            return "fail";
        }
        return "warning";
    }

    private String normalizeTaskStateForAudit(String state) {
        return state == null ? null : state.trim().toLowerCase();
    }

    private boolean notBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static class RuntimeStatus {
        private final String status;
        private final String source;

        private RuntimeStatus(String status, String source) {
            this.status = status;
            this.source = source;
        }
    }

    private void applyAgentResultMetadata(DeployTask task, String resultJson, String state) {
        if (resultJson == null || resultJson.trim().isEmpty()) {
            return;
        }
        try {
            JSONObject root = JSON.parseObject(resultJson);
            if (!STATE_SUCCEEDED.equals(state)) {
                protocolNodeService.applyAgentTaskFailure(task, root, state);
                return;
            }
            protocolNodeService.applyAgentResultNodes(task, root);
            serverForwardRuleService.applyAgentResultForwardRules(task, root);

            JSONObject serverMeta = root.getJSONObject("server");
            JSONObject serviceMeta = root.getJSONObject("services");
            JSONObject certificateMeta = root.getJSONObject("certificate");
            if (serverMeta == null && serviceMeta == null && certificateMeta == null) {
                return;
            }

            ControlServer update = new ControlServer();
            update.setId(task.getServerId());
            update.setUpdatedTime(System.currentTimeMillis());
            if (serverMeta != null) {
                setIfNotBlank(serverMeta.getString("xrayRuntimeEndpoint"), update::setXrayRuntimeEndpoint);
                setIfNotBlank(serverMeta.getString("xrayRuntimeBasePath"), update::setXrayRuntimeBasePath);
                setIfNotBlank(serverMeta.getString("xrayRuntimeApiToken"), value -> update.setXrayRuntimeApiToken(secretCryptoUtils.encryptIfNeeded(value)));
                setIfNotBlank(serverMeta.getString("xrayRuntimeUsername"), update::setXrayRuntimeUsername);
                setIfNotBlank(serverMeta.getString("xrayRuntimePassword"), value -> update.setXrayRuntimePassword(secretCryptoUtils.encryptIfNeeded(value)));
                setIfNotBlank(serverMeta.getString("xrayRuntimeTwoFactorCode"), value -> update.setXrayRuntimeTwoFactorCode(secretCryptoUtils.encryptIfNeeded(value)));
                Integer xrayRuntimeAllowInsecure = serverMeta.getInteger("xrayRuntimeAllowInsecure");
                if (xrayRuntimeAllowInsecure != null) {
                    update.setXrayRuntimeAllowInsecure(xrayRuntimeAllowInsecure);
                }
                setIfNotBlank(serverMeta.getString("agentVersion"), update::setAgentVersion);
                setIfNotBlank(serverMeta.getString("xrayVersion"), update::setXrayVersion);
                setIfNotBlank(serverMeta.getString("snellVersion"), update::setSnellVersion);
            }

            if (serviceMeta != null) {
                setIfNotBlank(serviceMeta.getString("xrayRuntime"), update::setXrayRuntimeServiceStatus);
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
                + "OB_XRAY_TASK='" + escapeShell(json) + "'\n"
                + "XRAY_RUNTIME_ENDPOINT='" + escapeShell(server.getXrayRuntimeEndpoint()) + "'\n"
                + "XRAY_RUNTIME_BASE_PATH='" + escapeShell(server.getXrayRuntimeBasePath()) + "'\n"
                + "XRAY_RUNTIME_API_TOKEN='" + escapeShell(decryptSecret(server.getXrayRuntimeApiToken())) + "'\n"
                + "XRAY_RUNTIME_SERVICE_STATUS='unknown'\n\n"
                + xrayAgentTaskBody();
    }

    private String decryptSecret(String value) {
        return secretCryptoUtils == null ? value : secretCryptoUtils.decryptIfNeeded(value);
    }

    private String xrayAgentTaskBody() {
        return """

                XRAY_RUNTIME_ENDPOINT="${OB_XRAY_RUNTIME_ENDPOINT:-$XRAY_RUNTIME_ENDPOINT}"
                XRAY_RUNTIME_BASE_PATH="${OB_XRAY_RUNTIME_BASE_PATH:-$XRAY_RUNTIME_BASE_PATH}"
                XRAY_RUNTIME_API_TOKEN="${OB_XRAY_RUNTIME_API_TOKEN:-$XRAY_RUNTIME_API_TOKEN}"
                XRAY_RUNTIME_PORT="${OB_XRAY_RUNTIME_PORT:-5168}"
                XRAY_RUNTIME_RUNTIME_NAME="$(printf '%s-%s' 'x' 'ui')"
                XRAY_RUNTIME_RUNTIME_DIR="/usr/local/${XRAY_RUNTIME_RUNTIME_NAME}"
                XRAY_RUNTIME_RUNTIME_UNIT="${XRAY_RUNTIME_RUNTIME_NAME}.service"

                if [ -z "$XRAY_RUNTIME_ENDPOINT" ]; then
                  XRAY_RUNTIME_ENDPOINT="http://127.0.0.1:${XRAY_RUNTIME_PORT}"
                fi

                if [ -z "$XRAY_RUNTIME_API_TOKEN" ] && [ -x "${XRAY_RUNTIME_RUNTIME_DIR}/${XRAY_RUNTIME_RUNTIME_NAME}" ]; then
                  XRAY_RUNTIME_API_TOKEN="$("${XRAY_RUNTIME_RUNTIME_DIR}/${XRAY_RUNTIME_RUNTIME_NAME}" setting -getApiToken true 2>/dev/null | awk '/apiToken:/ {print $2; exit}' || true)"
                fi

                if [ -z "$XRAY_RUNTIME_API_TOKEN" ]; then
                  echo 'Node service API token is required. Save it on the server card or run this task on a host with a local service CLI.' >&2
                  exit 1
                fi

                if command -v systemctl >/dev/null 2>&1; then
                  XRAY_RUNTIME_SERVICE_STATUS="$(systemctl is-active "$XRAY_RUNTIME_RUNTIME_UNIT" 2>/dev/null || echo unknown)"
                fi

                export OB_XRAY_TASK XRAY_RUNTIME_ENDPOINT XRAY_RUNTIME_BASE_PATH XRAY_RUNTIME_API_TOKEN XRAY_RUNTIME_SERVICE_STATUS XRAY_RUNTIME_RUNTIME_DIR
                python3 <<'PY'
                import json
                import os
                import ssl
                import subprocess
                import time
                import urllib.parse
                import urllib.request
                import uuid

                task = json.loads(os.environ["OB_XRAY_TASK"])
                endpoint = os.environ["XRAY_RUNTIME_ENDPOINT"].rstrip("/")
                base_path = (os.environ.get("XRAY_RUNTIME_BASE_PATH") or "").strip()
                if base_path and not base_path.startswith("/"):
                    base_path = "/" + base_path
                base_path = base_path.rstrip("/")
                base = endpoint + base_path
                token = os.environ["XRAY_RUNTIME_API_TOKEN"]
                protocol = (task.get("protocol") or "vless").lower()
                action = (task.get("action") or "present").lower()
                listen_port = task.get("listenPort")
                profile = task.get("profile") or {}
                request = task.get("request") or {}

                def parse_json(value, fallback):
                    if value is None:
                        return fallback
                    if isinstance(value, (dict, list)):
                        return value
                    if isinstance(value, str) and value.strip():
                        try:
                            return json.loads(value)
                        except json.JSONDecodeError:
                            return fallback
                    return fallback

                request_meta = parse_json(request.get("requestJson"), {})
                profile_config = parse_json(profile.get("configJson"), {})

                def first(*values):
                    for value in values:
                        if value is not None and str(value).strip() != "":
                            return value
                    return None

                def as_int(value, fallback):
                    try:
                        return int(value)
                    except (TypeError, ValueError):
                        return fallback

                def url(path):
                    return base + path

                def post_form(path, payload):
                    data = urllib.parse.urlencode(payload).encode()
                    req = urllib.request.Request(
                        url(path),
                        data=data,
                        headers={
                            "Authorization": "Bearer " + token,
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                        method="POST",
                    )
                    ctx = ssl._create_unverified_context()
                    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
                        return resp.read().decode()

                def post_empty(path):
                    return post_form(path, {})

                def find_xray_private_key():
                    runtime_dir = os.environ.get("XRAY_RUNTIME_RUNTIME_DIR") or os.path.join("/usr/local", "x-" + "ui")
                    candidates = [
                        os.path.join(runtime_dir, "bin", "xray"),
                        os.path.join(runtime_dir, "bin", "xray-linux-amd64"),
                        os.path.join(runtime_dir, "bin", "xray-linux-arm64"),
                    ]
                    for candidate in candidates:
                        if not os.path.exists(candidate):
                            continue
                        try:
                            output = subprocess.check_output([candidate, "x25519"], text=True, stderr=subprocess.DEVNULL, timeout=10)
                        except Exception:
                            continue
                        for line in output.splitlines():
                            if "Private key:" in line:
                                return line.split("Private key:", 1)[1].strip()
                    return ""

                def inbound_payload():
                    direct = request_meta.get("payload") or request_meta.get("inbound") or request_meta.get("inboundPayload")
                    if isinstance(direct, dict):
                        return direct
                    if all(key in request_meta for key in ("port", "protocol", "settings")):
                        return request_meta

                    port = as_int(first(request.get("listenPort"), request_meta.get("listenPort"), request_meta.get("port"), listen_port, profile.get("listenPort")), 443)
                    transport = str(first(request_meta.get("transport"), profile_config.get("network"), profile.get("transport"), "tcp")).lower()
                    security = str(first(request_meta.get("security"), profile_config.get("security"), "reality" if protocol == "vless" else "none")).lower()
                    sniffing = json.dumps({"enabled": True, "destOverride": ["http", "tls", "quic", "fakedns"]}, separators=(",", ":"))
                    now = int(time.time())

                    if protocol == "vless":
                        client_id = str(first(request_meta.get("clientId"), request_meta.get("uuid"), uuid.uuid4()))
                        flow = str(first(request_meta.get("flow"), "xtls-rprx-vision" if security == "reality" else ""))
                        settings = {
                            "clients": [{
                                "id": client_id,
                                "flow": flow,
                                "email": str(first(request_meta.get("email"), "vless-%s@overlord.local" % now)),
                                "limitIp": 0,
                                "totalGB": as_int(request_meta.get("totalGB"), 0),
                                "expiryTime": as_int(request_meta.get("expiryTime"), 0),
                                "enable": True,
                            }],
                            "decryption": "none",
                            "fallbacks": [],
                        }
                        stream = {"network": transport, "security": security}
                        if security == "reality":
                            private_key = str(first(request_meta.get("privateKey"), request_meta.get("realityPrivateKey"), find_xray_private_key()))
                            if not private_key:
                                raise SystemExit("Reality private key is required; install the node service first or provide realityPrivateKey in requestJson.")
                            stream["realitySettings"] = {
                                "show": False,
                                "dest": str(first(request_meta.get("dest"), request_meta.get("realityDest"), profile_config.get("dest"), "www.cloudflare.com:443")),
                                "xver": 0,
                                "serverNames": [str(first(request_meta.get("serverName"), request_meta.get("sni"), "www.cloudflare.com"))],
                                "privateKey": private_key,
                                "shortIds": [str(first(request_meta.get("shortId"), request_meta.get("realityShortId"), uuid.uuid4().hex[:8]))],
                            }
                    elif protocol == "vmess":
                        settings = {
                            "clients": [{
                                "id": str(first(request_meta.get("clientId"), request_meta.get("uuid"), uuid.uuid4())),
                                "alterId": 0,
                                "email": str(first(request_meta.get("email"), "vmess-%s@overlord.local" % now)),
                                "limitIp": 0,
                                "totalGB": as_int(request_meta.get("totalGB"), 0),
                                "expiryTime": as_int(request_meta.get("expiryTime"), 0),
                                "enable": True,
                            }],
                            "disableInsecureEncryption": False,
                        }
                        stream = {"network": transport, "security": security}
                        if transport == "ws":
                            stream["wsSettings"] = {"path": str(first(request_meta.get("path"), request_meta.get("wsPath"), "/ws")), "headers": {}}
                    elif protocol == "trojan":
                        settings = {
                            "clients": [{
                                "password": str(first(request_meta.get("password"), uuid.uuid4().hex)),
                                "email": str(first(request_meta.get("email"), "trojan-%s@overlord.local" % now)),
                                "limitIp": 0,
                                "totalGB": as_int(request_meta.get("totalGB"), 0),
                                "expiryTime": as_int(request_meta.get("expiryTime"), 0),
                                "enable": True,
                            }],
                            "fallbacks": [],
                        }
                        stream = {"network": transport, "security": "tls" if security == "none" else security}
                    elif protocol == "shadowsocks":
                        settings = {
                            "method": str(first(request_meta.get("method"), profile_config.get("method"), "2022-blake3-aes-128-gcm")),
                            "password": str(first(request_meta.get("password"), uuid.uuid4().hex)),
                            "network": "tcp,udp",
                        }
                        stream = {"network": transport, "security": "none"}
                    else:
                        raise SystemExit("Unsupported protocol-node type: %s" % protocol)

                    return {
                        "up": 0,
                        "down": 0,
                        "total": 0,
                        "remark": str(first(request_meta.get("remark"), request_meta.get("name"), "ob-%s" % protocol)),
                        "enable": "true",
                        "expiryTime": 0,
                        "listen": str(first(request_meta.get("listen"), "")),
                        "port": port,
                        "protocol": protocol,
                        "settings": json.dumps(settings, separators=(",", ":")),
                        "streamSettings": json.dumps(stream, separators=(",", ":")),
                        "sniffing": sniffing,
                    }

                result = {
                    "server": {
                        "xrayRuntimeEndpoint": endpoint,
                        "xrayRuntimeBasePath": base_path,
                        "tokenConfigured": bool(token),
                    },
                    "services": {
                        "xrayRuntime": os.environ.get("XRAY_RUNTIME_SERVICE_STATUS") or "unknown",
                    },
                    "inbounds": [],
                }

                if action in ("restart", "restarted", "restart-xray"):
                    response = post_empty("/panel/api/server/restartXrayService")
                    result["action"] = action
                    result["response"] = response[:1200]
                elif action in ("absent", "delete", "deleted"):
                    remote_id = first(request_meta.get("remoteId"), request_meta.get("inboundId"), request.get("remoteId"))
                    if not remote_id:
                        raise SystemExit("remoteId or inboundId is required for Xray inbound deletion.")
                    response = post_empty("/panel/api/inbounds/del/%s" % urllib.parse.quote(str(remote_id)))
                    result["inbounds"].append({
                        "name": str(first(request_meta.get("name"), "ob-%s" % protocol)),
                        "engine": "xray",
                        "direction": "inbound",
                        "protocol": protocol,
                        "remoteId": str(remote_id),
                        "state": "deleted",
                        "response": response[:1200],
                    })
                else:
                    payload = inbound_payload()
                    response = post_form("/panel/api/inbounds/add", payload)
                    parsed = parse_json(response, {})
                    obj = parsed.get("obj") if isinstance(parsed, dict) else {}
                    remote_id = obj.get("id") if isinstance(obj, dict) else None
                    try:
                        stream = json.loads(payload.get("streamSettings") or "{}")
                    except json.JSONDecodeError:
                        stream = {}
                    result["inbounds"].append({
                        "name": payload.get("remark"),
                        "engine": "xray",
                        "direction": "inbound",
                        "port": payload.get("port"),
                        "protocol": payload.get("protocol"),
                        "transport": stream.get("network"),
                        "security": stream.get("security"),
                        "remoteId": str(remote_id or ""),
                        "response": response[:1200],
                        "state": "active",
                    })

                print("OB_AGENT_RESULT_JSON=" + json.dumps(result, ensure_ascii=False, separators=(",", ":")))
                PY
                """;
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
                + "AGENT_BIN='${OB_AGENT_BIN:-/usr/local/bin/overlord-agent.sh}'\n"
                + "AGENT_ENV='${OB_AGENT_ENV:-/etc/overlord-agent.env}'\n"
                + "REPO_RAW_URL='${OB_REPO_RAW_URL:-https://raw.githubusercontent.com/zhizhishu/overlord-broil/main}'\n"
                + "SOURCE_URL='${OB_AGENT_SOURCE_URL:-${REPO_RAW_URL}/scripts/overlord-agent.sh}'\n"
                + "LOG_LINES=\"${OB_MAINTENANCE_LOG_LINES:-160}\"\n\n"
                + "SERVER_HOST='" + escapeShell(server.getHost()) + "'\n"
                + "XRAY_RUNTIME_ENDPOINT='" + escapeShell(server.getXrayRuntimeEndpoint()) + "'\n"
                + "CERTIFICATE_DOMAIN='" + escapeShell(server.getCertificateDomain()) + "'\n"
                + "CERTIFICATE_STATUS='" + escapeShell(server.getCertificateStatus()) + "'\n\n"
                + agentMaintenanceBody();
    }

    private String agentMaintenanceBody() {
        return """
                log() {
                  printf '[overlord-maintenance] %s\\n' "$*"
                }

                section() {
                  printf '\\n== %s ==\\n' "$*"
                }

                DIAG_FILE="${TMPDIR:-/tmp}/overlord-maintenance-diagnostics-$$.jsonl"
                : > "$DIAG_FILE" 2>/dev/null || true
                LOG_FILE="${TMPDIR:-/tmp}/overlord-maintenance-logs-$$.jsonl"
                : > "$LOG_FILE" 2>/dev/null || true
                UPGRADE_FILE="${TMPDIR:-/tmp}/overlord-maintenance-upgrade-$$.json"
                : > "$UPGRADE_FILE" 2>/dev/null || true
                case "$LOG_LINES" in
                  ''|*[!0-9]*)
                    LOG_LINES=160
                    ;;
                esac
                if [ "$LOG_LINES" -gt 1000 ]; then
                  LOG_LINES=1000
                fi

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
                  OB_DIAG_STATE="$state" OB_DIAG_CODE="$code" OB_DIAG_TITLE="$title" OB_DIAG_DETAIL="$detail" OB_DIAG_HINT="$hint" "$python_bin" - <<'PY' >> "$DIAG_FILE" 2>/dev/null || true
                import json
                import os

                print(json.dumps({
                    "state": os.environ.get("OB_DIAG_STATE", "warning"),
                    "code": os.environ.get("OB_DIAG_CODE", "unknown"),
                    "title": os.environ.get("OB_DIAG_TITLE", ""),
                    "detail": os.environ.get("OB_DIAG_DETAIL", ""),
                    "hint": os.environ.get("OB_DIAG_HINT", ""),
                }, ensure_ascii=False, separators=(",", ":")))
                PY
                }

                log_file_item() {
                  local runtime="$1"
                  local source="$2"
                  local title="$3"
                  local file="$4"
                  local python_bin
                  [ -s "$file" ] || return 0
                  python_bin="$(first_available_python 2>/dev/null || true)"
                  if [ -z "$python_bin" ]; then
                    printf '%s\\t%s\\t%s\\t%s\\n' "$runtime" "$source" "$title" "$file" >> "$LOG_FILE" 2>/dev/null || true
                    return 0
                  fi
                  OB_LOG_RUNTIME="$runtime" OB_LOG_SOURCE="$source" OB_LOG_TITLE="$title" OB_LOG_PATH="$file" "$python_bin" - <<'PY' >> "$LOG_FILE" 2>/dev/null || true
                import json
                import os

                max_len = 12000
                path = os.environ.get("OB_LOG_PATH", "")
                content = ""
                truncated = False
                try:
                    with open(path, "r", encoding="utf-8", errors="replace") as handle:
                        content = handle.read()
                    if len(content) > max_len:
                        content = content[-max_len:]
                        truncated = True
                except Exception as exc:
                    content = "unable to read log: " + str(exc)
                print(json.dumps({
                    "runtime": os.environ.get("OB_LOG_RUNTIME", "agent"),
                    "source": os.environ.get("OB_LOG_SOURCE", ""),
                    "title": os.environ.get("OB_LOG_TITLE", ""),
                    "content": content,
                    "lines": len(content.splitlines()),
                    "truncated": truncated,
                }, ensure_ascii=False, separators=(",", ":")))
                PY
                }

                capture_journal_log() {
                  local runtime="$1"
                  local unit="$2"
                  local title="$3"
                  local tmp
                  tmp="$(mktemp "${TMPDIR:-/tmp}/overlord-log-${runtime}-XXXXXX" 2>/dev/null || printf '%s' "${TMPDIR:-/tmp}/overlord-log-$$-${runtime}")"
                  journalctl -u "$unit" -n "$LOG_LINES" --no-pager > "$tmp" 2>&1 || true
                  cat "$tmp" 2>/dev/null || true
                  log_file_item "$runtime" "journalctl:${unit}" "$title" "$tmp"
                  rm -f "$tmp" 2>/dev/null || true
                }

                capture_file_log() {
                  local runtime="$1"
                  local source="$2"
                  local title="$3"
                  local file="$4"
                  local lines="${5:-80}"
                  local tmp
                  [ -f "$file" ] || return 0
                  tmp="$(mktemp "${TMPDIR:-/tmp}/overlord-log-${runtime}-XXXXXX" 2>/dev/null || printf '%s' "${TMPDIR:-/tmp}/overlord-log-$$-${runtime}")"
                  tail -n "$lines" "$file" > "$tmp" 2>&1 || true
                  cat "$tmp" 2>/dev/null || true
                  log_file_item "$runtime" "$source" "$title" "$tmp"
                  rm -f "$tmp" 2>/dev/null || true
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

                overlord_agent_status() {
                  local manager
                  manager="$(detect_service_manager)"
                  case "$manager" in
                    systemd)
                      systemctl is-active overlord-agent 2>/dev/null || true
                      ;;
                    openrc)
                      if rc-service overlord-agent status >/dev/null 2>&1; then
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
                      capture_journal_log "agent" "overlord-agent.service" "overlord-agent service log"
                      for unit in "$(printf '%s-%s.service' 'x' 'ui')" xray.service; do
                        if systemctl status "$unit" >/dev/null 2>&1; then
                          capture_journal_log "xrayRuntime" "$unit" "${unit} log"
                        fi
                      done
                      units="$(systemctl list-unit-files 'snell*.service' --no-legend 2>/dev/null | awk '{print $1}' || true)"
                      for unit in $units; do
                        capture_journal_log "snell" "$unit" "${unit} log"
                      done
                      for pattern in 'overlord-forward*.service' 'server-forward*.service' 'socat*.service'; do
                        units="$(systemctl list-unit-files "$pattern" --no-legend 2>/dev/null | awk '{print $1}' || true)"
                        for unit in $units; do
                          capture_journal_log "forward" "$unit" "${unit} log"
                        done
                      done
                      ;;
                    openrc)
                      capture_file_log "agent" "file:/var/log/overlord-agent.log" "overlord-agent log" "/var/log/overlord-agent.log" "$LOG_LINES"
                      capture_file_log "agent" "file:/var/log/overlord-agent.err" "overlord-agent error log" "/var/log/overlord-agent.err" "$LOG_LINES"
                      for file in /var/log/$(printf '%s-%s' 'x' 'ui')*.log /var/log/xray*.log; do
                        capture_file_log "xrayRuntime" "file:${file}" "$(basename "$file")" "$file" "$LOG_LINES"
                      done
                      for file in /var/log/snell*.log; do
                        capture_file_log "snell" "file:${file}" "$(basename "$file")" "$file" "$LOG_LINES"
                      done
                      for file in /var/log/overlord-forward*.log /var/log/server-forward*.log /var/log/socat*.log; do
                        capture_file_log "forward" "file:${file}" "$(basename "$file")" "$file" "$LOG_LINES"
                      done
                      ;;
                    *)
                      echo "no systemd/OpenRC logs available"
                      ;;
                  esac
                  for file in /var/log/$(printf '%s-%s' 'x' 'ui')*.log /var/log/xray*.log; do
                    capture_file_log "xrayRuntime" "file:${file}" "$(basename "$file")" "$file" "$LOG_LINES"
                  done
                  for file in /var/log/snell*.log; do
                    capture_file_log "snell" "file:${file}" "$(basename "$file")" "$file" "$LOG_LINES"
                  done
                  for file in /var/log/overlord-forward*.log /var/log/server-forward*.log /var/log/socat*.log; do
                    capture_file_log "forward" "file:${file}" "$(basename "$file")" "$file" "$LOG_LINES"
                  done
                  echo "== recent task logs"
                  task_files="$(ls -t /var/lib/overlord-agent/task-*.out /var/lib/overlord-agent/task-*.err 2>/dev/null || true)"
                  if [ -z "$task_files" ]; then
                    echo "no recent task logs"
                    return
                  fi
                  printf '%s\\n' "$task_files" \\
                    | head -n 6 \\
                    | while read -r file; do
                        echo "--- ${file}"
                        capture_file_log "agent-task" "file:${file}" "$(basename "$file")" "$file" 80
                      done
                }

                schedule_agent_restart() {
                  local manager
                  manager="$(detect_service_manager)"
                  case "$manager" in
                    systemd)
                      nohup sh -c 'sleep 3; systemctl restart overlord-agent.service' >/tmp/overlord-agent-restart.log 2>&1 &
                      ;;
                    openrc)
                      nohup sh -c 'sleep 3; rc-service overlord-agent restart' >/tmp/overlord-agent-restart.log 2>&1 &
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
                  script="/tmp/overlord-agent-uninstall-$$.sh"
                  cat > "$script" <<'UNINSTALL'
                #!/usr/bin/env sh
                sleep 5
                if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
                  systemctl stop overlord-agent.service 2>/dev/null || true
                  systemctl disable overlord-agent.service 2>/dev/null || true
                  rm -f /etc/systemd/system/overlord-agent.service
                  systemctl daemon-reload 2>/dev/null || true
                elif command -v rc-service >/dev/null 2>&1 && command -v rc-update >/dev/null 2>&1; then
                  rc-service overlord-agent stop 2>/dev/null || true
                  rc-update del overlord-agent default 2>/dev/null || true
                  rm -f /etc/init.d/overlord-agent /usr/local/bin/overlord-agent-openrc-wrapper.sh
                fi
                rm -f /usr/local/bin/overlord-agent.sh /etc/overlord-agent.env
                rm -f "$0"
                UNINSTALL
                  chmod 0700 "$script"
                  nohup sh "$script" >/tmp/overlord-agent-uninstall.log 2>&1 &
                  echo "agent uninstall scheduled via ${manager}; current task can report before the service is removed"
                }

                file_sha256() {
                  local file="$1"
                  if command -v sha256sum >/dev/null 2>&1; then
                    sha256sum "$file" | awk '{print $1}'
                    return
                  fi
                  if command -v shasum >/dev/null 2>&1; then
                    shasum -a 256 "$file" | awk '{print $1}'
                    return
                  fi
                  if command -v openssl >/dev/null 2>&1; then
                    openssl dgst -sha256 "$file" | awk '{print $NF}'
                    return
                  fi
                  echo ""
                }

                agent_script_version() {
                  local script="$1"
                  [ -f "$script" ] || return 0
                  OB_AGENT_VERSION= bash "$script" --version 2>/dev/null | head -n 1 || true
                }

                write_upgrade_metadata() {
                  local previous_version="$1"
                  local new_version="$2"
                  local backup_path="$3"
                  local checksum="$4"
                  local restart_scheduled="$5"
                  local python_bin
                  python_bin="$(first_available_python 2>/dev/null || true)"
                  [ -n "$python_bin" ] || return 0
                  UPGRADE_SOURCE_URL="$SOURCE_URL" \
                  UPGRADE_AGENT_BIN="$AGENT_BIN" \
                  UPGRADE_BACKUP_PATH="$backup_path" \
                  UPGRADE_PREVIOUS_VERSION="$previous_version" \
                  UPGRADE_NEW_VERSION="$new_version" \
                  UPGRADE_CHECKSUM_SHA256="$checksum" \
                  UPGRADE_RESTART_SCHEDULED="$restart_scheduled" \
                  UPGRADE_FILE="$UPGRADE_FILE" \
                    "$python_bin" <<'PY'
                import json
                import os
                import time

                def boolean_env(name):
                    return (os.environ.get(name) or "").strip().lower() in ("1", "true", "yes", "ok")

                payload = {
                    "sourceUrl": os.environ.get("UPGRADE_SOURCE_URL") or "",
                    "agentBinary": os.environ.get("UPGRADE_AGENT_BIN") or "",
                    "backupPath": os.environ.get("UPGRADE_BACKUP_PATH") or "",
                    "previousVersion": os.environ.get("UPGRADE_PREVIOUS_VERSION") or "",
                    "newVersion": os.environ.get("UPGRADE_NEW_VERSION") or "",
                    "checksumSha256": os.environ.get("UPGRADE_CHECKSUM_SHA256") or "",
                    "syntaxChecked": True,
                    "installed": True,
                    "restartScheduled": boolean_env("UPGRADE_RESTART_SCHEDULED"),
                    "reportedAt": int(time.time() * 1000),
                }
                with open(os.environ["UPGRADE_FILE"], "w", encoding="utf-8") as handle:
                    json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
                PY
                }

                upgrade_agent() {
                  local tmp install_dir staged backup previous_version new_version checksum restart_scheduled
                  command -v curl >/dev/null 2>&1 || { echo 'curl is required for agent upgrade.' >&2; return 1; }
                  command -v bash >/dev/null 2>&1 || { echo 'bash is required for agent upgrade validation.' >&2; return 1; }

                  tmp="$(mktemp "${TMPDIR:-/tmp}/overlord-agent-upgrade-XXXXXX")"
                  if ! curl -fsSL --retry 3 --connect-timeout 10 --max-time 120 "$SOURCE_URL" -o "$tmp"; then
                    rm -f "$tmp"
                    echo "failed to download agent from ${SOURCE_URL}" >&2
                    return 1
                  fi
                  if [ ! -s "$tmp" ]; then
                    rm -f "$tmp"
                    echo "downloaded agent is empty: ${SOURCE_URL}" >&2
                    return 1
                  fi
                  if ! bash -n "$tmp"; then
                    rm -f "$tmp"
                    echo "downloaded agent failed bash syntax validation; current binary was not changed." >&2
                    return 1
                  fi

                  previous_version="$(agent_script_version "$AGENT_BIN")"
                  new_version="$(agent_script_version "$tmp")"
                  checksum="$(file_sha256 "$tmp")"
                  install_dir="$(dirname "$AGENT_BIN")"
                  mkdir -p "$install_dir"
                  staged="${install_dir}/.$(basename "$AGENT_BIN").new.$$"
                  backup=""
                  if [ -e "$AGENT_BIN" ]; then
                    backup="${AGENT_BIN}.bak.$(date -u +%Y%m%d%H%M%S)"
                    cp -p "$AGENT_BIN" "$backup"
                  fi

                  if command -v install >/dev/null 2>&1; then
                    install -m 0755 "$tmp" "$staged"
                  else
                    cp "$tmp" "$staged"
                    chmod 0755 "$staged"
                  fi
                  mv "$staged" "$AGENT_BIN"
                  rm -f "$tmp"
                  echo "agent binary updated from ${SOURCE_URL}"
                  echo "previous version: ${previous_version:-unknown}"
                  echo "new version: ${new_version:-unknown}"
                  [ -z "$backup" ] || echo "backup: ${backup}"
                  [ -z "$checksum" ] || echo "sha256: ${checksum}"

                  restart_scheduled=false
                  if schedule_agent_restart; then
                    restart_scheduled=true
                  else
                    echo "agent binary was upgraded, but service restart could not be scheduled automatically." >&2
                  fi
                  write_upgrade_metadata "$previous_version" "$new_version" "$backup" "$checksum" "$restart_scheduled"
                }

                repair_xray_runtime() {
                  local manager
                  manager="$(detect_service_manager)"
                  section "Node service repair"
                  local runtime_unit runtime_dir runtime_bin
                  runtime_unit="$(printf '%s-%s.service' 'x' 'ui')"
                  runtime_dir="/usr/local/$(printf '%s-%s' 'x' 'ui')"
                  runtime_bin="${runtime_dir}/$(printf '%s-%s' 'x' 'ui')"
                  if service_exists "$manager" "$runtime_unit"; then
                    restart_service "$manager" "$runtime_unit"
                  else
                    echo "[fail] Node service not found. Run one-click deployment first."
                    return 1
                  fi
                  if [ -x "$runtime_bin" ]; then
                    "$runtime_bin" setting -show 2>/dev/null || true
                  fi
                }

                repair_xray() {
                  local manager
                  manager="$(detect_service_manager)"
                  section "Xray repair"
                  local runtime_unit runtime_dir
                  runtime_unit="$(printf '%s-%s.service' 'x' 'ui')"
                  runtime_dir="/usr/local/$(printf '%s-%s' 'x' 'ui')"
                  if [ -x "${runtime_dir}/bin/xray" ]; then
                    "${runtime_dir}/bin/xray" version 2>/dev/null | head -n 1 || true
                  fi
                  if service_exists "$manager" "$runtime_unit"; then
                    echo "Restarting node service because it owns the embedded protocol engine."
                    restart_service "$manager" "$runtime_unit"
                  elif service_exists "$manager" "xray.service"; then
                    restart_service "$manager" "xray.service"
                  else
                    echo "[fail] Protocol service not found. If it is embedded in the node service, repair the node service first."
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
                    echo "[fail] Snell service not found. Create a Snell node from the master first."
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
                    diag_item fail "agent_env_missing" "agent 环境文件缺失" "$AGENT_ENV" "重新安装 agent，并确认 OB_MASTER_URL、OB_SERVER_ID、OB_AGENT_TOKEN 已写入。"
                  fi
                  if [ -d /var/lib/overlord-agent ]; then
                    echo "[ok] work dir: /var/lib/overlord-agent"
                    diag_item ok "agent_work_dir" "agent 工作目录存在" "/var/lib/overlord-agent" ""
                  else
                    echo "[warn] work dir missing: /var/lib/overlord-agent"
                    diag_item warning "agent_work_dir_missing" "agent 工作目录缺失" "/var/lib/overlord-agent" "agent 首次运行会创建目录；若任务无法写日志，请检查目录权限。"
                  fi
                  if [ -r "$AGENT_ENV" ]; then
                    grep -E '^(OB_MASTER_URL|OB_SERVER_ID|OB_POLL_INTERVAL)=' "$AGENT_ENV" || true
                    if grep -q '^OB_AGENT_TOKEN=' "$AGENT_ENV"; then
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
                      systemctl --no-pager --full status overlord-agent.service || true
                      ;;
                    openrc)
                      rc-service overlord-agent status || true
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

                firewall_requested_ports() {
                  local python_bin
                  python_bin="$(first_available_python 2>/dev/null || true)"
                  [ -n "$python_bin" ] || return 1
                  REQUEST_JSON="$REQUEST_JSON" "$python_bin" - <<'PY'
                import json
                import os
                import sys

                raw = os.environ.get("REQUEST_JSON") or "{}"

                def parse(value):
                    if not value:
                        return {}
                    if isinstance(value, dict):
                        return value
                    if isinstance(value, str):
                        try:
                            parsed = json.loads(value)
                            return parsed if isinstance(parsed, dict) else {}
                        except Exception:
                            return {}
                    return {}

                root = parse(raw)
                nested = parse(root.get("requestJson"))
                request = root.get("request") if isinstance(root.get("request"), dict) else {}
                original = root.get("originalRequest") if isinstance(root.get("originalRequest"), dict) else {}
                candidates = [root, nested, request, original]
                seen = set()

                def add(port, proto="tcp"):
                    try:
                        port = int(port)
                    except Exception:
                        return
                    proto = str(proto or "tcp").lower()
                    if proto not in ("tcp", "udp"):
                        proto = "tcp"
                    if port < 1 or port > 65535:
                        return
                    key = (proto, port)
                    if key not in seen:
                        seen.add(key)
                        print("%s %s" % key)

                def add_value(value, proto="tcp"):
                    if value is None:
                        return
                    if isinstance(value, dict):
                        add(value.get("port") or value.get("listenPort") or value.get("targetPort"), value.get("protocol") or value.get("transport") or proto)
                    elif isinstance(value, list):
                        for item in value:
                            add_value(item, proto)
                    elif isinstance(value, str) and "," in value:
                        for part in value.split(","):
                            add_value(part.strip(), proto)
                    else:
                        add(value, proto)

                list_keys = ("ports", "runtimePorts", "listenPorts", "exposedPorts", "firewallPorts")
                scalar_keys = (
                    "port", "listenPort", "runtimePort", "vlessPort", "vmessPort", "trojanPort",
                    "shadowsocksPort", "snellPort", "forwardListenPort", "remotePort", "acmePort"
                )
                for source in candidates:
                    if not isinstance(source, dict):
                        continue
                    proto = source.get("protocol") or source.get("transport") or "tcp"
                    for key in list_keys:
                        add_value(source.get(key), proto)
                    for key in scalar_keys:
                        add_value(source.get(key), proto)
                    if str(source.get("certificateMode") or "").lower() == "acme-http":
                        add(80, "tcp")

                if not seen:
                    sys.exit(1)
                PY
                }

                manage_firewall_port() {
                  local mode="$1"
                  local proto="$2"
                  local port="$3"
                  local applied=0
                  local changed=0
                  local action_word="open"
                  [ "$mode" = "close" ] && action_word="close"

                  section "Firewall ${action_word} ${proto}/${port}"

                  if [ "$(id -u)" -ne 0 ]; then
                    echo "[fail] firewall ${action_word} requires root."
                    diag_item fail "firewall_root_required" "Firewall task requires root" "${proto}/${port}" "Run the Overlord agent service as root for firewall changes."
                    return 1
                  fi

                  if command -v ufw >/dev/null 2>&1; then
                    applied=1
                    if [ "$mode" = "open" ]; then
                      if ufw allow "${port}/${proto}"; then
                        changed=1
                        diag_item ok "ufw_${mode}_${proto}_${port}" "ufw rule applied" "${proto}/${port}" ""
                      else
                        diag_item warning "ufw_${mode}_${proto}_${port}_failed" "ufw rule failed" "${proto}/${port}" "Check ufw status and apply the rule manually if needed."
                      fi
                    else
                      if ufw delete allow "${port}/${proto}"; then
                        changed=1
                        diag_item ok "ufw_${mode}_${proto}_${port}" "ufw rule removed" "${proto}/${port}" ""
                      else
                        diag_item warning "ufw_${mode}_${proto}_${port}_missing" "ufw rule was not removed" "${proto}/${port}" "The rule may not exist; check ufw status."
                      fi
                    fi
                  fi

                  if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
                    applied=1
                    if [ "$mode" = "open" ]; then
                      if firewall-cmd --permanent --add-port="${port}/${proto}" && firewall-cmd --reload; then
                        changed=1
                        diag_item ok "firewalld_${mode}_${proto}_${port}" "firewalld rule applied" "${proto}/${port}" ""
                      else
                        diag_item warning "firewalld_${mode}_${proto}_${port}_failed" "firewalld rule failed" "${proto}/${port}" "Check firewalld zone and apply the rule manually if needed."
                      fi
                    else
                      if firewall-cmd --permanent --remove-port="${port}/${proto}" && firewall-cmd --reload; then
                        changed=1
                        diag_item ok "firewalld_${mode}_${proto}_${port}" "firewalld rule removed" "${proto}/${port}" ""
                      else
                        diag_item warning "firewalld_${mode}_${proto}_${port}_missing" "firewalld rule was not removed" "${proto}/${port}" "The rule may not exist in the active zone."
                      fi
                    fi
                  fi

                  if command -v iptables >/dev/null 2>&1; then
                    applied=1
                    if [ "$mode" = "open" ]; then
                      if iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null; then
                        diag_item ok "iptables_${mode}_${proto}_${port}_exists" "iptables rule already exists" "${proto}/${port}" ""
                      elif iptables -I INPUT -p "$proto" --dport "$port" -j ACCEPT; then
                        changed=1
                        diag_item ok "iptables_${mode}_${proto}_${port}" "iptables rule inserted" "${proto}/${port}" "Persist this rule with your distro firewall tooling if required."
                      else
                        diag_item warning "iptables_${mode}_${proto}_${port}_failed" "iptables rule failed" "${proto}/${port}" "Check nftables/iptables backend and apply manually if needed."
                      fi
                    else
                      while iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null; do
                        if iptables -D INPUT -p "$proto" --dport "$port" -j ACCEPT; then
                          changed=1
                        else
                          break
                        fi
                      done
                      if [ "$changed" -eq 1 ]; then
                        diag_item ok "iptables_${mode}_${proto}_${port}" "iptables rule removed" "${proto}/${port}" ""
                      else
                        diag_item warning "iptables_${mode}_${proto}_${port}_missing" "iptables rule not found" "${proto}/${port}" ""
                      fi
                    fi
                  fi

                  if [ "$applied" -eq 0 ]; then
                    echo "[fail] no supported firewall command found for ${proto}/${port}."
                    diag_item fail "firewall_tool_missing" "No supported firewall command found" "${proto}/${port}" "Install ufw, firewalld or iptables, or manage cloud security groups manually."
                    return 1
                  fi
                  if [ "$changed" -eq 1 ]; then
                    echo "[ok] firewall ${action_word} handled for ${proto}/${port}."
                  else
                    echo "[warn] firewall ${action_word} finished without confirmed change for ${proto}/${port}."
                  fi
                }

                manage_firewall_ports() {
                  local mode="$1"
                  local ports line proto port failed
                  failed=0
                  ports="$(firewall_requested_ports || true)"
                  section "Firewall ${mode} runtime ports"
                  if [ -z "$ports" ]; then
                    echo "[fail] no runtime ports were provided in requestJson."
                    diag_item fail "firewall_ports_missing" "No runtime ports provided" "requestJson did not include ports/runtimePorts/listenPort/runtimePort/etc." "Pass ports such as {\\\"ports\\\":[{\\\"port\\\":443,\\\"protocol\\\":\\\"tcp\\\"}]}."
                    return 1
                  fi
                  while read -r proto port; do
                    [ -n "$proto" ] && [ -n "$port" ] || continue
                    manage_firewall_port "$mode" "$proto" "$port" || failed=1
                  done <<< "$ports"
                  diagnose_firewall || true
                  return "$failed"
                }

                diagnose_certificate() {
                  local domain found_cert
                  found_cert=0
                  domain="$(certificate_domain || true)"
                  section "Certificate / ACME diagnostics"
                  echo "stored certificate status: ${CERTIFICATE_STATUS:-unknown}"
                  if [ -z "$domain" ]; then
                    echo "[warn] 证书域名缺失：ACME HTTP 模式必须填写域名。"
                    diag_item warning "certificate_domain_missing" "证书域名缺失" "ACME HTTP 模式必须填写域名。" "在一键部署或服务器配置中填写 certificateDomain。"
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
                  "$python_bin" - "$action" "$status" "$manager" "$(overlord_agent_status)" "$(service_status "$(printf '%s-%s.service' 'x' 'ui')")" "$(service_status snell.service)" "$AGENT_BIN" "$DIAG_FILE" "$LOG_FILE" "$UPGRADE_FILE" <<'PY' || true
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

                def load_logs(path):
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
                                        "runtime": parts[0] if len(parts) > 0 else "agent",
                                        "source": parts[1] if len(parts) > 1 else "unknown",
                                        "title": parts[2] if len(parts) > 2 else "log",
                                        "content": parts[3] if len(parts) > 3 else "",
                                    }
                                if not isinstance(item, dict):
                                    continue
                                content = str(item.get("content") or "")
                                items.append({
                                    "runtime": str(item.get("runtime") or "agent"),
                                    "source": str(item.get("source") or ""),
                                    "title": str(item.get("title") or item.get("source") or "log"),
                                    "content": content,
                                    "lines": int(item.get("lines") or len(content.splitlines())),
                                    "truncated": bool(item.get("truncated")),
                                })
                    except Exception as exc:
                        items.append({
                            "runtime": "agent",
                            "source": "logs_parse_error",
                            "title": "日志结果解析失败",
                            "content": str(exc),
                            "lines": 1,
                            "truncated": False,
                        })
                    return items

                def load_upgrade(path):
                    if not path or not os.path.exists(path) or os.path.getsize(path) <= 0:
                        return None
                    try:
                        with open(path, "r", encoding="utf-8", errors="replace") as handle:
                            payload = json.load(handle)
                        return payload if isinstance(payload, dict) else None
                    except Exception as exc:
                        return {
                            "parseError": str(exc),
                            "syntaxChecked": False,
                            "installed": False,
                        }

                items = load_diagnostics(sys.argv[8] if len(sys.argv) > 8 else "")
                log_items = load_logs(sys.argv[9] if len(sys.argv) > 9 else "")
                upgrade = load_upgrade(sys.argv[10] if len(sys.argv) > 10 else "")
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
                        "xrayRuntimeServiceStatus": sys.argv[5],
                        "snellServiceStatus": sys.argv[6],
                        "agentBinary": sys.argv[7],
                        "reportedAt": int(time.time() * 1000),
                    }
                }
                if upgrade:
                    payload["maintenance"]["upgrade"] = upgrade
                if items:
                    payload["diagnostics"] = {
                        "items": items,
                        "summary": summary,
                    }
                if log_items:
                    runtime_counts = {}
                    for item in log_items:
                        runtime = item.get("runtime") or "agent"
                        runtime_counts[runtime] = runtime_counts.get(runtime, 0) + 1
                    payload["logs"] = {
                        "items": log_items,
                        "summary": {
                            "total": len(log_items),
                            "runtimes": runtime_counts,
                        },
                    }

                print("OB_AGENT_RESULT_JSON=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
                PY
                  rm -f "$DIAG_FILE" 2>/dev/null || true
                  rm -f "$LOG_FILE" 2>/dev/null || true
                  rm -f "$UPGRADE_FILE" 2>/dev/null || true
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
                  open-runtime-ports|firewall-open|open-firewall)
                    manage_firewall_ports open
                    emit_result "$ACTION" "opened"
                    ;;
                  close-runtime-ports|firewall-close|close-firewall)
                    manage_firewall_ports close
                    emit_result "$ACTION" "closed"
                    ;;
                  repair-xray-runtime)
                    repair_xray_runtime
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
                    repair_xray_runtime || true
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
