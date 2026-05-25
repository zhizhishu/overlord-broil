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

        assertEquals("snell", result.getJSONObject("runtimeProvider").getString("key"));
        assertEquals("present", result.getJSONObject("runtimeProvider").getString("action"));
    }

    @Test
    void keepsAgentReportedRuntimeProvider() {
        DeployTask task = new DeployTask();
        task.setProtocol("vless");
        task.setAction("present");

        String resultJson = attach("{\"runtimeProvider\":{\"key\":\"custom-agent\"}}", task);
        JSONObject result = JSON.parseObject(resultJson);

        assertEquals("custom-agent", result.getJSONObject("runtimeProvider").getString("key"));
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
    }

    private String attach(String resultJson, DeployTask task) {
        return ReflectionTestUtils.invokeMethod(service, "attachRuntimeProviderMetadata", resultJson, task);
    }
}
