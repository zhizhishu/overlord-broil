package com.admin.runtime;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuntimeProviderServiceTest {

    private final RuntimeProviderService service = new RuntimeProviderService();

    @Test
    void listsCoreRuntimeProviders() {
        assertEquals(5, service.listProviders().size());
        assertTrue(service.listProviders().stream().anyMatch(provider -> "xui".equals(provider.getKey())));
        assertTrue(service.listProviders().stream().anyMatch(provider -> "snell".equals(provider.getKey())));
        assertTrue(service.listProviders().stream().anyMatch(provider -> "forward".equals(provider.getKey())));
        assertTrue(service.listProviders().stream().anyMatch(provider -> "certificate".equals(provider.getKey())));
        assertTrue(service.listProviders().stream().anyMatch(provider -> "firewall".equals(provider.getKey())));
    }

    @Test
    void resolvesProtocolAndMaintenanceActions() {
        assertEquals("xui", service.assign("vless", "present").getKey());
        assertEquals("snell", service.assign("snell", "present").getKey());
        assertEquals("forward", service.assign("server-forward", "restart").getKey());
        assertEquals("certificate", service.assign("agent-maintenance", "cert-diagnose").getKey());
        assertEquals("firewall", service.assign("agent-maintenance", "firewall-diagnose").getKey());
        assertEquals("snell", service.assign("agent-maintenance", "repair-snell").getKey());
        assertEquals("xui", service.assign("agent-maintenance", "repair-xray").getKey());
    }

    @Test
    void orchestrationExposesRelatedProviders() {
        RuntimeProviderAssignment assignment = service.assign("xui-orchestrator", "orchestrate");

        assertEquals("xui", assignment.getKey());
        assertTrue(assignment.getRelatedProviders().contains("snell"));
        assertTrue(assignment.getRelatedProviders().contains("certificate"));
        assertTrue(assignment.getRelatedProviders().contains("firewall"));
    }
}
