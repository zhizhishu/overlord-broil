package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.DeployTaskDto;
import com.admin.common.dto.AgentTaskReportDto;
import com.admin.entity.ControlServer;
import com.admin.entity.DeployTask;
import com.admin.entity.ProtocolProfile;
import com.admin.runtime.RuntimeProviderAssignment;
import com.admin.runtime.RuntimeProviderService;
import com.admin.service.OperationAuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class DeployTaskServiceImplTest {

    private DeployTaskServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new DeployTaskServiceImpl();
        ReflectionTestUtils.setField(service, "runtimeProviderService", new RuntimeProviderService());
    }

    @Test
    void attachesRuntimeProviderWhenAgentReportDoesNotIncludeIt() {
        DeployTask task = new DeployTask();
        task.setProtocol("snell");
        task.setAction("present");

        String resultJson = attach("{\"exitCode\":0}", task);
        JSONObject result = JSON.parseObject(resultJson);
        JSONObject runtimeState = result.getJSONObject("runtimeState");

        assertEquals("snell", result.getJSONObject("runtimeProvider").getString("key"));
        assertEquals("present", result.getJSONObject("runtimeProvider").getString("action"));
        assertEquals("snell", runtimeState.getString("providerKey"));
        assertEquals("succeeded", runtimeState.getString("taskState"));
        assertEquals("succeeded", runtimeState.getString("status"));
        assertEquals("task", runtimeState.getString("statusSource"));
    }

    @Test
    void overwritesAgentReportedRuntimeProviderWithMasterAuditMetadata() {
        DeployTask task = new DeployTask();
        task.setProtocol("vless");
        task.setAction("present");

        String resultJson = attach("{\"runtimeProvider\":{\"key\":\"custom-agent\"}}", task);
        JSONObject result = JSON.parseObject(resultJson);

        assertEquals("xrayRuntime", result.getJSONObject("runtimeProvider").getString("key"));
        assertEquals("xrayRuntime", result.getJSONObject("runtimeState").getString("providerKey"));
    }

    @Test
    void overwritesAgentReportedRuntimeStateTraceWithMasterAuditMetadata() {
        DeployTask task = new DeployTask();
        task.setId(202L);
        task.setServerId(9L);
        task.setServerName("edge-xray-runtime");
        task.setProtocol("vless");
        task.setAction("present");

        String resultJson = attach("""
                {
                  "runtimeState": {
                    "providerKey": "snell",
                    "providerName": "Forged Runtime",
                    "protocol": "snell",
                    "action": "close-runtime-ports",
                    "taskState": "failed",
                    "source": "agent",
                    "sourceTaskId": 999,
                    "serverId": 888,
                    "serverName": "wrong-server",
                    "resourceType": "firewall-rule",
                    "resourceId": "forged-resource",
                    "danger": false,
                    "status": "active",
                    "statusSource": "services.snell"
                  }
                }
                """, task);

        JSONObject runtimeState = JSON.parseObject(resultJson).getJSONObject("runtimeState");

        assertEquals("xrayRuntime", runtimeState.getString("providerKey"));
        assertEquals("Node Service", runtimeState.getString("providerName"));
        assertEquals("vless", runtimeState.getString("protocol"));
        assertEquals("present", runtimeState.getString("action"));
        assertEquals("succeeded", runtimeState.getString("taskState"));
        assertEquals("task", runtimeState.getString("source"));
        assertEquals(202L, runtimeState.getLongValue("sourceTaskId"));
        assertEquals(9L, runtimeState.getLongValue("serverId"));
        assertEquals("edge-xray-runtime", runtimeState.getString("serverName"));
        assertEquals("protocol-node", runtimeState.getString("resourceType"));
        assertNull(runtimeState.get("resourceId"));
        assertEquals(false, runtimeState.getBooleanValue("danger"));
        assertEquals("succeeded", runtimeState.getString("status"));
        assertEquals("task", runtimeState.getString("statusSource"));
    }

    @Test
    void wrapsInvalidResultJsonWithRuntimeProviderAuditMetadata() {
        DeployTask task = new DeployTask();
        task.setProtocol("server-forward");
        task.setAction("restart");

        String resultJson = attach("plain log", task);
        JSONObject result = JSON.parseObject(resultJson);

        assertEquals("plain log", result.getString("rawResultJson"));
        assertEquals("forward", result.getJSONObject("runtimeProvider").getString("key"));
        assertEquals("forward", result.getJSONObject("runtimeState").getString("providerKey"));
        assertEquals("succeeded", result.getJSONObject("runtimeState").getString("status"));
    }

    @Test
    void sanitizesAgentResultSecretsBeforeTaskHistory() {
        String sanitized = ReflectionTestUtils.invokeMethod(service, "sanitizeAgentResultJson", """
                {
                  "server": {
                    "xrayRuntimeEndpoint": "http://127.0.0.1:5168",
                    "xrayRuntimeApiToken": "token-123",
                    "xrayRuntimePassword": "password-123",
                    "xrayRuntimeTwoFactorCode": "654321"
                  },
                  "serverSecrets": {
                    "xrayRuntimeApiToken": "token-456"
                  }
                }
                """);

        JSONObject result = JSON.parseObject(sanitized);
        JSONObject server = result.getJSONObject("server");

        assertEquals("http://127.0.0.1:5168", server.getString("xrayRuntimeEndpoint"));
        assertNull(server.getString("xrayRuntimeApiToken"));
        assertNull(server.getString("xrayRuntimePassword"));
        assertNull(server.getString("xrayRuntimeTwoFactorCode"));
        assertTrue(server.getBooleanValue("xrayRuntimeApiTokenConfigured"));
        assertTrue(server.getBooleanValue("xrayRuntimePasswordConfigured"));
        assertTrue(server.getBooleanValue("xrayRuntimeTwoFactorConfigured"));
        assertNull(result.getJSONObject("serverSecrets"));
    }

    @Test
    void buildsRuntimeStateFromServicesAndNodes() {
        DeployTask task = new DeployTask();
        task.setId(101L);
        task.setServerId(7L);
        task.setServerName("edge-snell");
        task.setProtocol("snell");
        task.setAction("present");

        String resultJson = attach("{\"services\":{\"snell\":\"active\"},\"protocolNodes\":[{\"remoteId\":\"snell-8390\",\"state\":\"active\"}]}", task);
        JSONObject runtimeState = JSON.parseObject(resultJson).getJSONObject("runtimeState");

        assertEquals("snell", runtimeState.getString("providerKey"));
        assertEquals("active", runtimeState.getString("status"));
        assertEquals("services.snell", runtimeState.getString("statusSource"));
        assertEquals(1, runtimeState.getIntValue("nodeCount"));
        assertEquals("active", runtimeState.getJSONObject("serviceStatuses").getString("snell"));
        assertEquals("task", runtimeState.getString("source"));
        assertEquals(101L, runtimeState.getLongValue("sourceTaskId"));
        assertEquals(7L, runtimeState.getLongValue("serverId"));
        assertEquals("protocol-node", runtimeState.getString("resourceType"));
        assertEquals("snell-8390", runtimeState.getString("resourceId"));
        assertEquals(false, runtimeState.getBooleanValue("danger"));
    }

    @Test
    void buildsRuntimeStateFromDiagnostics() {
        DeployTask task = new DeployTask();
        task.setProtocol("agent-maintenance");
        task.setAction("cert-diagnose");

        String resultJson = attach("{\"diagnostics\":{\"items\":[{\"state\":\"ok\"},{\"state\":\"missing\"},{\"state\":\"warning\"}]}}", task);
        JSONObject runtimeState = JSON.parseObject(resultJson).getJSONObject("runtimeState");
        JSONObject summary = runtimeState.getJSONObject("diagnosticSummary");

        assertEquals("certificate", runtimeState.getString("providerKey"));
        assertEquals("failed", runtimeState.getString("status"));
        assertEquals("diagnostics", runtimeState.getString("statusSource"));
        assertEquals(1, summary.getIntValue("ok"));
        assertEquals(1, summary.getIntValue("warning"));
        assertEquals(1, summary.getIntValue("fail"));
    }

    @Test
    void preservesRemoteLogsWhenAttachingRuntimeMetadata() {
        DeployTask task = new DeployTask();
        task.setProtocol("agent-maintenance");
        task.setAction("logs");

        String resultJson = attach("""
                {
                  "logs": {
                    "items": [
                      {
                        "runtime": "snell",
                        "source": "journalctl:snell.service",
                        "title": "snell service log",
                        "content": "line1\\nline2",
                        "lines": 2,
                        "truncated": false
                      }
                    ]
                  }
                }
                """, task);
        JSONObject result = JSON.parseObject(resultJson);
        JSONArray items = result.getJSONObject("logs").getJSONArray("items");

        assertEquals(1, items.size());
        assertEquals("snell", items.getJSONObject(0).getString("runtime"));
        assertEquals("journalctl:snell.service", items.getJSONObject(0).getString("source"));
        assertEquals("line1\nline2", items.getJSONObject(0).getString("content"));
        assertEquals("xrayRuntime", result.getJSONObject("runtimeProvider").getString("key"));
        assertNotNull(result.getJSONObject("runtimeState"));
    }

    @Test
    void agentMaintenanceLogsScriptIncludesStructuredRemoteLogCollectors() {
        DeployTaskDto dto = new DeployTaskDto();
        dto.setServerId(7L);
        dto.setProtocol("agent-maintenance");
        dto.setAction("logs");

        ControlServer server = new ControlServer();
        server.setId(7L);
        server.setName("edge-logs");
        server.setHost("203.0.113.7");

        String script = ReflectionTestUtils.invokeMethod(service, "buildAgentMaintenanceScript", dto, server);

        assertNotNull(script);
        assertTrue(script.contains("LOG_LINES=\"${OB_MAINTENANCE_LOG_LINES:-160}\""));
        assertTrue(script.contains("LOG_FILE=\"${TMPDIR:-/tmp}/overlord-maintenance-logs-$$.jsonl\""));
        assertTrue(script.contains("capture_journal_log \"agent\" \"overlord-agent.service\""));
        assertTrue(script.contains("capture_journal_log \"xrayRuntime\" \"$unit\""));
        assertTrue(script.contains("capture_file_log \"snell\""));
        assertTrue(script.contains("capture_file_log \"agent-task\""));
        assertTrue(script.contains("def load_logs(path):"));
        assertTrue(script.contains("payload[\"logs\"]"));
        assertTrue(script.contains("rm -f \"$LOG_FILE\""));
    }

    @Test
    void agentMaintenanceUpgradeScriptIncludesSafeUpgradeLifecycle() {
        DeployTaskDto dto = new DeployTaskDto();
        dto.setServerId(7L);
        dto.setProtocol("agent-maintenance");
        dto.setAction("upgrade-agent");

        ControlServer server = new ControlServer();
        server.setId(7L);
        server.setName("edge-upgrade");
        server.setHost("203.0.113.7");

        String script = ReflectionTestUtils.invokeMethod(service, "buildAgentMaintenanceScript", dto, server);

        assertNotNull(script);
        assertTrue(script.contains("UPGRADE_FILE=\"${TMPDIR:-/tmp}/overlord-maintenance-upgrade-$$.json\""));
        assertTrue(script.contains("file_sha256()"));
        assertTrue(script.contains("agent_script_version()"));
        assertTrue(script.contains("write_upgrade_metadata()"));
        assertTrue(script.contains("curl -fsSL --retry 3 --connect-timeout 10 --max-time 120"));
        assertTrue(script.contains("bash -n \"$tmp\""));
        assertTrue(script.contains("cp -p \"$AGENT_BIN\" \"$backup\""));
        assertTrue(script.contains("staged=\"${install_dir}/.$(basename \"$AGENT_BIN\").new.$$\""));
        assertTrue(script.contains("checksumSha256"));
        assertTrue(script.contains("payload[\"maintenance\"][\"upgrade\"] = upgrade"));
        assertTrue(script.contains("rm -f \"$UPGRADE_FILE\""));
    }

    @Test
    void xrayDeployScriptExecutesThroughAgentAndReportsInboundMetadata() throws Exception {
        DeployTaskDto dto = new DeployTaskDto();
        dto.setServerId(7L);
        dto.setProtocol("vmess");
        dto.setAction("present");
        dto.setListenPort(2086);
        dto.setRequestJson("{\"transport\":\"ws\",\"wsPath\":\"/ob\",\"email\":\"client@overlord.local\"}");

        ProtocolProfile profile = new ProtocolProfile();
        profile.setProtocol("vmess");
        profile.setVersionFamily("xray");
        profile.setListenPort(2086);
        profile.setTransport("ws");
        profile.setConfigJson("{\"network\":\"ws\",\"security\":\"none\"}");

        ControlServer server = new ControlServer();
        server.setId(7L);
        server.setName("edge-xray");
        server.setHost("203.0.113.7");
        server.setXrayRuntimeEndpoint("http://127.0.0.1:5168");
        server.setXrayRuntimeBasePath("/ob");
        server.setXrayRuntimeApiToken("token-123");

        String script = ReflectionTestUtils.invokeMethod(service, "buildXrayAgentPayload", dto, profile, server);

        assertNotNull(script);
        assertTrue(script.contains("OB_XRAY_TASK="));
        assertTrue(script.contains("XRAY_RUNTIME_API_TOKEN='token-123'"));
        assertTrue(script.contains("/panel/api/inbounds/add"));
        assertTrue(script.contains("OB_AGENT_RESULT_JSON="));
        assertTrue(script.contains("\"inbounds\": []"));
        assertTrue(script.contains("runtimeState") || script.contains("services"));
        assertTrue(script.contains("\"tokenConfigured\": bool(token)"));
        assertTrue(!script.contains("\"xrayRuntimeApiToken\": token"));
        assertTrue(!script.contains("next integration step"));
        assertBashSyntaxValid(script);
    }

    @Test
    void agentMaintenanceFirewallScriptIncludesRuntimePortOpenCloseActions() throws Exception {
        DeployTaskDto dto = new DeployTaskDto();
        dto.setServerId(7L);
        dto.setProtocol("agent-maintenance");
        dto.setAction("open-runtime-ports");
        dto.setRequestJson("{\"ports\":[{\"port\":443,\"protocol\":\"tcp\"},{\"port\":8390,\"protocol\":\"udp\"}]}");

        ControlServer server = new ControlServer();
        server.setId(7L);
        server.setName("edge-firewall");
        server.setHost("203.0.113.7");

        String script = ReflectionTestUtils.invokeMethod(service, "buildAgentMaintenanceScript", dto, server);

        assertNotNull(script);
        assertTrue(script.contains("firewall_requested_ports()"));
        assertTrue(script.contains("manage_firewall_ports open"));
        assertTrue(script.contains("manage_firewall_ports close"));
        assertTrue(script.contains("ufw allow"));
        assertTrue(script.contains("firewall-cmd --permanent --add-port"));
        assertTrue(script.contains("iptables -I INPUT"));
        assertTrue(script.contains("firewall_ports_missing"));
        assertTrue(script.contains("OB_AGENT_RESULT_JSON="));
        assertTrue(script.contains("done <<< \"$ports\""));
        assertBashSyntaxValid(script);
    }

    private static void assertBashSyntaxValid(String script) throws Exception {
        Path scriptFile = Files.createTempFile("ob-generated-", ".sh");
        try {
            Files.writeString(scriptFile, script, StandardCharsets.UTF_8);
            Process process = new ProcessBuilder("bash", "-n", scriptFile.toString())
                    .redirectErrorStream(true)
                    .start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            int exitCode = process.waitFor();
            assertEquals(0, exitCode, output);
        } finally {
            Files.deleteIfExists(scriptFile);
        }
    }

    @Test
    void validatesAgentMaintenanceActionsFromRuntimeProviderCatalog() {
        DeployTaskDto dto = new DeployTaskDto();
        dto.setProtocol("agent-maintenance");

        dto.setAction("repair-snell");
        assertNull(ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));

        dto.setAction("open-runtime-ports");
        assertNull(ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));

        dto.setAction("");
        assertNull(ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));

        dto.setAction("format-disk");
        assertEquals("unsupported agent maintenance action",
                ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));
    }

    @Test
    void dangerousAgentMaintenanceActionsRequireExplicitConfirmation() {
        DeployTaskDto dto = new DeployTaskDto();
        dto.setProtocol("agent-maintenance");
        dto.setAction("close-runtime-ports");
        dto.setRequestJson("{\"ports\":[{\"port\":443,\"protocol\":\"tcp\"}]}");

        assertEquals("dangerous agent maintenance action requires dangerConfirmed=true and confirmAction=close-runtime-ports",
                ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));

        dto.setRequestJson("{\"dangerConfirmed\":true,\"confirmAction\":\"close-runtime-ports\",\"ports\":[{\"port\":443,\"protocol\":\"tcp\"}]}");

        assertNull(ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));
    }

    @Test
    void auditTaskEventUsesRuntimeProviderAndDangerFlag() {
        OperationAuditLogService auditLogService = mock(OperationAuditLogService.class);
        ReflectionTestUtils.setField(service, "operationAuditLogService", auditLogService);

        DeployTask task = new DeployTask();
        task.setId(99L);
        task.setServerId(7L);
        task.setServerName("edge-firewall");
        task.setProtocol("agent-maintenance");
        task.setAction("close-runtime-ports");

        ReflectionTestUtils.invokeMethod(service, "auditTaskEvent",
                "agent_task.claimed", "agent", "7", "edge-firewall", task,
                "claimed", "Agent claimed task #99", new LinkedHashMap<>());

        verify(auditLogService).recordTaskEvent(
                eq("agent_task.claimed"),
                eq("agent"),
                eq("7"),
                eq("edge-firewall"),
                eq(task),
                any(RuntimeProviderAssignment.class),
                eq(true),
                eq("claimed"),
                eq("Agent claimed task #99"),
                anyMap());
    }

    @Test
    void masterAuditFallsBackToUnknownActorWithoutRequestContext() {
        OperationAuditLogService auditLogService = mock(OperationAuditLogService.class);
        ReflectionTestUtils.setField(service, "operationAuditLogService", auditLogService);

        DeployTask task = new DeployTask();
        task.setId(99L);
        task.setServerId(7L);
        task.setServerName("edge-snell");
        task.setProtocol("snell");
        task.setAction("present");

        ReflectionTestUtils.invokeMethod(service, "auditMasterTaskEvent",
                "deploy_task.created", task, "requested", "Created deploy task #99", new LinkedHashMap<>());

        verify(auditLogService).recordTaskEvent(
                eq("deploy_task.created"),
                eq("master-unknown"),
                eq("unknown"),
                eq("Unknown master user"),
                eq(task),
                any(RuntimeProviderAssignment.class),
                eq(false),
                eq("requested"),
                eq("Created deploy task #99"),
                anyMap());
    }

    @Test
    void agentReportAuditDetailStoresLengthsInsteadOfRawLogs() {
        DeployTask task = new DeployTask();
        task.setId(99L);
        task.setProtocol("snell");
        task.setAction("present");

        AgentTaskReportDto dto = new AgentTaskReportDto();
        dto.setExitCode(1);
        dto.setStdout("stdout-secret");
        dto.setStderr("stderr-secret");

        Map<String, Object> detail = ReflectionTestUtils.invokeMethod(service,
                "agentReportDetail", task, dto, "failed", "{\"ok\":false}");

        assertNotNull(detail);
        assertEquals(13, detail.get("stdoutLength"));
        assertEquals(13, detail.get("stderrLength"));
        assertEquals(12, detail.get("resultJsonLength"));
        assertTrue(!detail.containsValue("stdout-secret"));
        assertTrue(!detail.containsValue("stderr-secret"));
    }

    @Test
    void extractsRuntimeStateFromTaskResultJson() {
        DeployTask task = new DeployTask();
        task.setResultJson("{\"runtimeState\":{\"providerKey\":\"snell\",\"status\":\"active\"}}");

        JSONObject runtimeState = ReflectionTestUtils.invokeMethod(service, "extractRuntimeState", task);

        assertNotNull(runtimeState);
        assertEquals("snell", runtimeState.getString("providerKey"));
        assertEquals("active", runtimeState.getString("status"));
    }

    @Test
    void buildsRuntimeOverviewItemFromTaskRuntimeState() {
        DeployTask task = new DeployTask();
        task.setId(42L);
        task.setServerId(7L);
        task.setServerName("edge-1");
        task.setUpdatedTime(1234L);
        JSONObject runtimeState = JSON.parseObject("""
                {
                  "providerKey":"snell",
                  "providerName":"Snell Service",
                  "protocol":"snell",
                  "action":"present",
                  "taskState":"succeeded",
                  "status":"active",
                  "statusSource":"services.snell",
                  "sourceTaskId":42,
                  "resourceType":"protocol-node",
                  "resourceId":"snell-8390",
                  "danger":false,
                  "serviceStatuses":{"snell":"active"},
                  "nodeCount":1,
                  "updatedAt":5678
                }
                """);

        Map<String, Object> item = ReflectionTestUtils.invokeMethod(service,
                "runtimeOverviewItem", task, runtimeState, "snell", null);

        assertNotNull(item);
        assertEquals(7L, item.get("serverId"));
        assertEquals("edge-1", item.get("serverName"));
        assertEquals("snell", item.get("serviceKey"));
        assertEquals("active", item.get("status"));
        assertEquals(42L, item.get("taskId"));
        assertEquals(42L, item.get("sourceTaskId"));
        assertEquals("protocol-node", item.get("resourceType"));
        assertEquals("snell-8390", item.get("resourceId"));
        assertEquals(false, item.get("danger"));
        assertEquals("task", item.get("source"));
        assertEquals(1, item.get("nodeCount"));
    }

    @Test
    void seedsHeartbeatRuntimeStatesAndCountsHealth() {
        ControlServer server = new ControlServer();
        server.setId(9L);
        server.setName("oracle-nano");
        server.setLastHeartbeat(System.currentTimeMillis());
        server.setXrayRuntimeServiceStatus("active");
        server.setXrayServiceStatus("running");
        server.setSnellServiceStatus("not-installed");
        server.setCertificateStatus("expiring");
        server.setCertificateDomain("example.com");

        Map<String, Map<String, Object>> items = new LinkedHashMap<>();
        ReflectionTestUtils.invokeMethod(service, "seedServerProviderRuntimeStates", items, server, System.currentTimeMillis());

        assertEquals("running", items.get("9:xrayRuntime").get("status"));
        assertEquals("not-installed", items.get("9:snell").get("status"));
        assertEquals("expiring", items.get("9:certificate").get("status"));

        Map<String, Integer> counts = ReflectionTestUtils.invokeMethod(service,
                "countRuntimeOverview", List.copyOf(items.values()));

        assertNotNull(counts);
        assertEquals(1, counts.get("healthy"));
        assertEquals(2, counts.get("warning"));
        assertEquals(0, counts.get("failed"));
    }

    private String attach(String resultJson, DeployTask task) {
        return ReflectionTestUtils.invokeMethod(service, "attachRuntimeMetadata", resultJson, task, "succeeded");
    }
}
