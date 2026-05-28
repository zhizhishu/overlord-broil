package com.admin.service.impl;

import com.admin.entity.ControlServer;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;

import static org.junit.jupiter.api.Assertions.assertTrue;

class XrayRuntimeServiceImplTest {

    @Test
    void nodeServiceConnectionMessageExplainsLoopbackDockerEndpoint() {
        XrayRuntimeServiceImpl service = new XrayRuntimeServiceImpl();
        ControlServer server = new ControlServer();
        server.setId(1L);
        server.setName("hk-agent");
        server.setHost("203.0.113.10");
        server.setXrayRuntimeEndpoint("http://127.0.0.1:2053");
        server.setXrayRuntimeBasePath("");

        String message = ReflectionTestUtils.invokeMethod(
                service,
                "nodeServiceConnectionMessage",
                server,
                "/panel/api/server/getConfigJson",
                new RestClientException("Connection refused")
        );

        assertTrue(message.contains("节点服务未连接"));
        assertTrue(message.contains("127.0.0.1/localhost"));
        assertTrue(message.contains("部署/修复节点服务"));
        assertTrue(message.contains("http://<被控服务器IP>:5168"));
    }
}
