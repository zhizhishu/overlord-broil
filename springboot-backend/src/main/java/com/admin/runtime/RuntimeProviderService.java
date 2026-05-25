package com.admin.runtime;

import com.admin.entity.DeployTask;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RuntimeProviderService {

    private final List<RuntimeProviderDescriptor> providers;
    private final Map<String, RuntimeProviderDescriptor> providerMap;

    public RuntimeProviderService() {
        this.providers = Collections.unmodifiableList(buildProviders());
        Map<String, RuntimeProviderDescriptor> map = new LinkedHashMap<>();
        for (RuntimeProviderDescriptor provider : providers) {
            map.put(provider.getKey(), provider);
        }
        this.providerMap = Collections.unmodifiableMap(map);
    }

    public List<RuntimeProviderDescriptor> listProviders() {
        return providers;
    }

    public RuntimeProviderDescriptor getProvider(String key) {
        if (key == null) {
            return null;
        }
        return providerMap.get(normalize(key));
    }

    public RuntimeProviderAssignment assign(String protocol, String action) {
        RuntimeProviderDescriptor provider = resolve(protocol, action);
        if (provider == null) {
            provider = providerMap.get("xui");
        }
        RuntimeProviderAssignment assignment = new RuntimeProviderAssignment();
        assignment.setKey(provider.getKey());
        assignment.setName(provider.getName());
        assignment.setProtocol(normalize(protocol));
        assignment.setAction(normalize(action));
        assignment.setExecutor(provider.getExecutor());
        assignment.setStateSource(provider.getStateSource());
        assignment.setAgentRequired(provider.isAgentRequired());
        assignment.setMasterApiSupported(provider.isMasterApiSupported());
        assignment.setNanoSupported(provider.isNanoSupported());
        assignment.setCapabilities(new ArrayList<>(provider.getCapabilities()));
        assignment.setRelatedProviders(resolveRelatedProviders(provider, protocol));
        return assignment;
    }

    public RuntimeProviderDescriptor resolve(String protocol, String action) {
        String normalizedProtocol = normalize(protocol);
        String normalizedAction = normalize(action);

        if ("snell".equals(normalizedProtocol) || normalizedAction.contains("snell")) {
            return providerMap.get("snell");
        }
        if ("forward".equals(normalizedProtocol) || "server-forward".equals(normalizedProtocol)
                || "tcp".equals(normalizedProtocol) || "udp".equals(normalizedProtocol)) {
            return providerMap.get("forward");
        }
        if (normalizedProtocol.contains("cert") || normalizedAction.contains("cert")
                || normalizedAction.contains("acme")) {
            return providerMap.get("certificate");
        }
        if (normalizedProtocol.contains("firewall") || normalizedAction.contains("firewall")) {
            return providerMap.get("firewall");
        }
        if ("agent-maintenance".equals(normalizedProtocol)) {
            return resolveAgentMaintenance(normalizedAction);
        }
        if ("xui-orchestrator".equals(normalizedProtocol)) {
            return providerMap.get("xui");
        }
        for (RuntimeProviderDescriptor provider : providers) {
            if (contains(provider.getProtocols(), normalizedProtocol)
                    || contains(provider.getActions(), normalizedAction)) {
                return provider;
            }
        }
        return providerMap.get("xui");
    }

    public void applyToTask(DeployTask task) {
        if (task == null) {
            return;
        }
        task.setRuntimeProvider(assign(task.getProtocol(), task.getAction()));
    }

    private RuntimeProviderDescriptor resolveAgentMaintenance(String action) {
        if (action.contains("cert") || action.contains("acme")) {
            return providerMap.get("certificate");
        }
        if (action.contains("firewall")) {
            return providerMap.get("firewall");
        }
        if (action.contains("snell")) {
            return providerMap.get("snell");
        }
        return providerMap.get("xui");
    }

    private List<String> resolveRelatedProviders(RuntimeProviderDescriptor provider, String protocol) {
        if ("xui-orchestrator".equals(normalize(protocol))) {
            return Arrays.asList("xui", "snell", "certificate", "firewall");
        }
        return new ArrayList<>(provider.getRelatedProviders());
    }

    private boolean contains(List<String> values, String expected) {
        if (expected == null || expected.isEmpty()) {
            return false;
        }
        for (String value : values) {
            if (expected.equals(normalize(value))) {
                return true;
            }
        }
        return false;
    }

    private List<RuntimeProviderDescriptor> buildProviders() {
        List<RuntimeProviderDescriptor> result = new ArrayList<>();
        result.add(provider(
                "xui",
                "3x-ui / Xray Runtime",
                "proxy-runtime",
                "master-api + agent-task",
                "control_server.xui/xray status, three_xui_traffic_snapshot, protocol_node",
                "3x-ui panel API, Xray inbound/outbound, Reality, VMess, Trojan, Shadowsocks and traffic sync.",
                true,
                true,
                false,
                list("vless", "vmess", "trojan", "shadowsocks", "xui-orchestrator"),
                list("present", "absent", "restart", "orchestrate", "repair-xui", "repair-xray", "sync-traffic"),
                list("install-3x-ui", "configure-panel", "create-inbound", "manage-outbound", "restart-xray", "sync-traffic"),
                list("xuiEndpoint", "xuiApiToken or xuiUsername/xuiPassword"),
                list("5168 optional panel", "user-defined inbound ports"),
                list("certificate", "firewall")
        ));
        result.add(provider(
                "snell",
                "Snell Runtime",
                "proxy-runtime",
                "agent-task",
                "control_server.snell status, protocol_node, deploy_task result",
                "Snell is unified as a product-layer protocol node while remaining an independent service on the agent.",
                true,
                false,
                true,
                list("snell"),
                list("present", "absent", "restart", "repair-snell"),
                list("install-snell", "write-snell.conf", "restart-service", "report-service-state"),
                list("agent token", "listen port", "psk"),
                list("user-defined snell ports"),
                list("firewall")
        ));
        result.add(provider(
                "forward",
                "Forward Runtime",
                "forward-runtime",
                "agent-task",
                "server_forward_rule, deploy_task result",
                "Remote TCP/UDP forwarding is executed by the agent and kept visible in the unified rule center.",
                true,
                false,
                true,
                list("forward", "tcp", "udp"),
                list("present", "absent", "restart"),
                list("install-socat", "write-service", "restart-service", "sync-forward-rule"),
                list("listen port", "target host", "target port"),
                list("user-defined forward listen ports"),
                list("firewall")
        ));
        result.add(provider(
                "certificate",
                "Certificate Runtime",
                "certificate-runtime",
                "agent-task",
                "control_server.certificate status, deploy_task result",
                "Certificate tasks diagnose or issue local certificates for 3x-ui/Xray and related inbound services.",
                true,
                false,
                false,
                list("certificate", "acme-http", "self-signed"),
                list("issue", "renew", "cert-diagnose"),
                list("self-signed", "acme-http", "expiry-report", "diagnose-dns-and-port"),
                list("certificate domain for acme-http"),
                list("80 only for acme-http validation"),
                list("xui", "firewall")
        ));
        result.add(provider(
                "firewall",
                "Firewall Runtime",
                "network-runtime",
                "agent-task",
                "deploy_task diagnostic result",
                "Firewall runtime opens, diagnoses and reports node, forwarding, ACME and panel ports on controlled servers.",
                true,
                false,
                true,
                list("firewall"),
                list("open", "close", "firewall-diagnose"),
                list("ufw/firewalld/iptables-detect", "port-diagnose", "open-runtime-ports"),
                list("runtime ports"),
                list("runtime-dependent ports"),
                list("xui", "snell", "forward", "certificate")
        ));
        return result;
    }

    private RuntimeProviderDescriptor provider(String key,
                                               String name,
                                               String runtimeType,
                                               String executor,
                                               String stateSource,
                                               String summary,
                                               boolean agentRequired,
                                               boolean masterApiSupported,
                                               boolean nanoSupported,
                                               List<String> protocols,
                                               List<String> actions,
                                               List<String> capabilities,
                                               List<String> requiredServerFields,
                                               List<String> exposedPorts,
                                               List<String> relatedProviders) {
        RuntimeProviderDescriptor descriptor = new RuntimeProviderDescriptor();
        descriptor.setKey(key);
        descriptor.setName(name);
        descriptor.setRuntimeType(runtimeType);
        descriptor.setExecutor(executor);
        descriptor.setStateSource(stateSource);
        descriptor.setSummary(summary);
        descriptor.setAgentRequired(agentRequired);
        descriptor.setMasterApiSupported(masterApiSupported);
        descriptor.setNanoSupported(nanoSupported);
        descriptor.setProtocols(protocols);
        descriptor.setActions(actions);
        descriptor.setCapabilities(capabilities);
        descriptor.setRequiredServerFields(requiredServerFields);
        descriptor.setExposedPorts(exposedPorts);
        descriptor.setRelatedProviders(relatedProviders);
        return descriptor;
    }

    private List<String> list(String... values) {
        return new ArrayList<>(Arrays.asList(values));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }
}
