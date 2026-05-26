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
    void exposesAgentMaintenanceActionCatalog() {
        RuntimeProviderDescriptor xui = service.getProvider("xui");
        RuntimeProviderDescriptor snell = service.getProvider("snell");

        assertTrue(xui.getActionCatalog().stream().anyMatch(action ->
                "install-diagnose".equals(action.getKey())
                        && "diagnostic".equals(action.getCategory())
                        && action.isStateSync()));
        assertTrue(xui.getActionCatalog().stream().anyMatch(action ->
                "uninstall-agent".equals(action.getKey())
                        && action.isDanger()));
        assertTrue(snell.getActionCatalog().stream().anyMatch(action ->
                "repair-snell".equals(action.getKey())
                        && "repair".equals(action.getCategory())
                        && "agent-maintenance".equals(action.getProtocol())));
        RuntimeProviderDescriptor firewall = service.getProvider("firewall");
        assertTrue(firewall.getActionCatalog().stream().anyMatch(action ->
                "open-runtime-ports".equals(action.getKey())
                        && "repair".equals(action.getCategory())
                        && action.isStateSync()));
        assertTrue(firewall.getActionCatalog().stream().anyMatch(action ->
                "close-runtime-ports".equals(action.getKey())
                        && action.isDanger()));
    }

    @Test
    void validatesAgentMaintenanceActionsFromCatalog() {
        assertTrue(service.isAllowedAgentMaintenanceAction("doctor"));
        assertTrue(service.isAllowedAgentMaintenanceAction("repair-snell"));
        assertTrue(service.isAllowedAgentMaintenanceAction("firewall-diagnose"));
        assertTrue(service.isAllowedAgentMaintenanceAction("open-runtime-ports"));
        assertTrue(service.isAllowedAgentMaintenanceAction("close-runtime-ports"));
        assertTrue(service.isAllowedAgentMaintenanceAction(null));
        assertEquals(15, service.listAgentMaintenanceActions().size());
    }

    @Test
    void resolvesProtocolAndMaintenanceActions() {
        assertEquals("xui", service.assign("vless", "present").getKey());
        assertEquals("snell", service.assign("snell", "present").getKey());
        assertEquals("forward", service.assign("server-forward", "restart").getKey());
        assertEquals("certificate", service.assign("agent-maintenance", "cert-diagnose").getKey());
        assertEquals("firewall", service.assign("agent-maintenance", "firewall-diagnose").getKey());
        assertEquals("firewall", service.assign("agent-maintenance", "open-runtime-ports").getKey());
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
