package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.admin.entity.DeployTask;
import com.admin.runtime.RuntimeProviderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;

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

    private String attach(String resultJson, DeployTask task) {
        return ReflectionTestUtils.invokeMethod(service, "attachRuntimeMetadata", resultJson, task, "succeeded");
    }
}
