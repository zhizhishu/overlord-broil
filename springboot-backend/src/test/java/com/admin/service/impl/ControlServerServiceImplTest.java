package com.admin.service.impl;

import com.admin.common.dto.ControlServerUpdateDto;
import com.admin.entity.ControlServer;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ControlServerServiceImplTest {

    @Test
    void blankNodeServiceFieldsDoNotClearExistingConnection() {
        ControlServerServiceImpl service = new ControlServerServiceImpl();
        ControlServerUpdateDto dto = new ControlServerUpdateDto();
        dto.setXrayRuntimeEndpoint("");
        dto.setXrayRuntimeBasePath("");
        dto.setXrayRuntimeApiToken("");
        dto.setXrayRuntimeUsername("");
        dto.setXrayRuntimePassword("");
        dto.setXrayRuntimeTwoFactorCode("");

        ControlServer exists = new ControlServer();
        exists.setXrayRuntimeEndpoint("http://203.0.113.10:5168");
        exists.setXrayRuntimeBasePath("/ob-1");
        exists.setXrayRuntimeApiToken("token");
        exists.setXrayRuntimeUsername("admin");
        exists.setXrayRuntimePassword("secret");
        exists.setXrayRuntimeTwoFactorCode("123456");

        ControlServer update = new ControlServer();
        ReflectionTestUtils.invokeMethod(service, "preserveBlankXrayRuntimeFields", dto, exists, update);

        assertEquals("http://203.0.113.10:5168", update.getXrayRuntimeEndpoint());
        assertEquals("/ob-1", update.getXrayRuntimeBasePath());
        assertEquals("token", update.getXrayRuntimeApiToken());
        assertEquals("admin", update.getXrayRuntimeUsername());
        assertEquals("secret", update.getXrayRuntimePassword());
        assertEquals("123456", update.getXrayRuntimeTwoFactorCode());
    }

    @Test
    void joinCommandUsesSudoEnvForRootInstaller() {
        ControlServerServiceImpl service = new ControlServerServiceImpl();

        String command = ReflectionTestUtils.invokeMethod(
                service,
                "buildJoinCommand",
                "http://203.0.113.10:5166",
                "join-token-123");

        assertTrue(command.contains("install-agent-bootstrap.sh"));
        assertTrue(command.contains("| sudo env OB_MASTER_URL='http://203.0.113.10:5166'"));
        assertTrue(command.contains("OB_JOIN_TOKEN='join-token-123'"));
        assertTrue(command.endsWith(" sh"));
    }
}
