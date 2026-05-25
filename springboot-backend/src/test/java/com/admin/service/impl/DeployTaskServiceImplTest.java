package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
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
