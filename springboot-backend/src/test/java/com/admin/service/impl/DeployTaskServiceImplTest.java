package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.DeployTaskDto;
import com.admin.entity.ControlServer;
import com.admin.entity.DeployTask;
import com.admin.runtime.RuntimeProviderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    void keepsAgentReportedRuntimeProvider() {
        DeployTask task = new DeployTask();
        task.setProtocol("vless");
        task.setAction("present");

        String resultJson = attach("{\"runtimeProvider\":{\"key\":\"custom-agent\"}}", task);
        JSONObject result = JSON.parseObject(resultJson);

        assertEquals("custom-agent", result.getJSONObject("runtimeProvider").getString("key"));
        assertEquals("xui", result.getJSONObject("runtimeState").getString("providerKey"));
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
    void buildsRuntimeStateFromServicesAndNodes() {
        DeployTask task = new DeployTask();
        task.setProtocol("snell");
        task.setAction("present");

        String resultJson = attach("{\"services\":{\"snell\":\"active\"},\"protocolNodes\":[{\"state\":\"active\"}]}", task);
        JSONObject runtimeState = JSON.parseObject(resultJson).getJSONObject("runtimeState");

        assertEquals("snell", runtimeState.getString("providerKey"));
        assertEquals("active", runtimeState.getString("status"));
        assertEquals("services.snell", runtimeState.getString("statusSource"));
        assertEquals(1, runtimeState.getIntValue("nodeCount"));
        assertEquals("active", runtimeState.getJSONObject("serviceStatuses").getString("snell"));
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
        assertEquals("xui", result.getJSONObject("runtimeProvider").getString("key"));
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
        assertTrue(script.contains("LOG_LINES=\"${FLUX_MAINTENANCE_LOG_LINES:-160}\""));
        assertTrue(script.contains("LOG_FILE=\"${TMPDIR:-/tmp}/flux-maintenance-logs-$$.jsonl\""));
        assertTrue(script.contains("capture_journal_log \"agent\" \"flux-agent.service\""));
        assertTrue(script.contains("capture_journal_log \"xui\" \"$unit\""));
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
        assertTrue(script.contains("UPGRADE_FILE=\"${TMPDIR:-/tmp}/flux-maintenance-upgrade-$$.json\""));
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
    void validatesAgentMaintenanceActionsFromRuntimeProviderCatalog() {
        DeployTaskDto dto = new DeployTaskDto();
        dto.setProtocol("agent-maintenance");

        dto.setAction("repair-snell");
        assertNull(ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));

        dto.setAction("");
        assertNull(ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));

        dto.setAction("format-disk");
        assertEquals("unsupported agent maintenance action",
                ReflectionTestUtils.invokeMethod(service, "validateDeployTask", dto, null, "agent-maintenance"));
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
                  "providerName":"Snell Runtime",
                  "protocol":"snell",
                  "action":"present",
                  "taskState":"succeeded",
                  "status":"active",
                  "statusSource":"services.snell",
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
        assertEquals("snell", item.get("providerKey"));
        assertEquals("active", item.get("status"));
        assertEquals(42L, item.get("taskId"));
        assertEquals("task", item.get("source"));
        assertEquals(1, item.get("nodeCount"));
    }

    @Test
    void seedsHeartbeatRuntimeStatesAndCountsHealth() {
        ControlServer server = new ControlServer();
        server.setId(9L);
        server.setName("oracle-nano");
        server.setLastHeartbeat(System.currentTimeMillis());
        server.setXuiServiceStatus("active");
        server.setXrayServiceStatus("running");
        server.setSnellServiceStatus("not-installed");
        server.setCertificateStatus("expiring");
        server.setCertificateDomain("example.com");

        Map<String, Map<String, Object>> items = new LinkedHashMap<>();
        ReflectionTestUtils.invokeMethod(service, "seedServerProviderRuntimeStates", items, server, System.currentTimeMillis());

        assertEquals("running", items.get("9:xui").get("status"));
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
