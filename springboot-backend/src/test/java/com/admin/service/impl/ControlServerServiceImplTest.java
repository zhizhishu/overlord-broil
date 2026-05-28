package com.admin.service.impl;

import com.admin.common.dto.ControlServerUpdateDto;
import com.admin.entity.ControlServer;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
}
