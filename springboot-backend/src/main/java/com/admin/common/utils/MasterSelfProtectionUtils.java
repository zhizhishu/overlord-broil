package com.admin.common.utils;

import com.admin.entity.ControlServer;

import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public final class MasterSelfProtectionUtils {

    private static final String MASTER_ROLE = "master";
    private static final Set<String> DESTRUCTIVE_ACTIONS = new HashSet<>(Arrays.asList(
            "absent", "delete", "deleted", "remove", "removed", "uninstall",
            "stop", "stopped", "reset", "purge", "destroy"
    ));

    private MasterSelfProtectionUtils() {
    }

    public static boolean isMaster(ControlServer server) {
        return server != null && server.getRole() != null && MASTER_ROLE.equalsIgnoreCase(server.getRole().trim());
    }

    public static String validateListenPort(ControlServer server, Integer port, String portLabel) {
        if (!isMaster(server) || port == null) {
            return null;
        }
        String reason = protectedListenPorts().get(port);
        if (reason == null) {
            return null;
        }
        return "主控安全模式：master 服务器禁止" + safeLabel(portLabel) + "使用受保护端口 "
                + port + "（" + reason + "），请更换为 agent 服务器或其他端口。";
    }

    public static String validateAction(ControlServer server, String action, String operationName) {
        if (!isMaster(server) || action == null) {
            return null;
        }
        String normalized = action.trim().toLowerCase();
        if (!DESTRUCTIVE_ACTIONS.contains(normalized)) {
            return null;
        }
        return "主控安全模式：master 服务器禁止执行" + safeLabel(operationName)
                + "的删除、停止或清理类动作（" + normalized + "），请在 agent 服务器上操作。";
    }

    public static String validateListenPortAndAction(ControlServer server, Integer port, String action,
                                                     String operationName, String portLabel) {
        String actionError = validateAction(server, action, operationName);
        if (actionError != null) {
            return actionError;
        }
        return validateListenPort(server, port, portLabel);
    }

    public static Integer firstPort(Integer primary, Integer fallback) {
        return primary != null ? primary : fallback;
    }

    private static Map<Integer, String> protectedListenPorts() {
        Map<Integer, String> ports = new LinkedHashMap<>();
        ports.put(80, "HTTP/ACME 证书验证端口");
        ports.put(5166, "默认前端入口端口");
        ports.put(6365, "后端 API 端口");
        ports.put(3306, "MySQL 数据库端口");
        ports.put(8081, "前端端口");
        ports.put(8066, "phpMyAdmin 端口");
        ports.put(22, "SSH 管理端口");
        putEnvPort(ports, "FRONTEND_PORT", "FRONTEND_PORT 前端端口");
        putEnvPort(ports, "BACKEND_PORT", "BACKEND_PORT 后端端口");
        putEnvPort(ports, "PHPMYADMIN_PORT", "PHPMYADMIN_PORT phpMyAdmin 端口");
        return ports;
    }

    private static void putEnvPort(Map<Integer, String> ports, String envName, String label) {
        Integer port = parsePort(System.getenv(envName));
        if (port != null) {
            ports.putIfAbsent(port, label);
        }
    }

    private static Integer parsePort(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        try {
            int port = Integer.parseInt(value.trim());
            return port > 0 && port <= 65535 ? port : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static String safeLabel(String label) {
        return label == null || label.trim().isEmpty() ? "操作" : label.trim();
    }
}
