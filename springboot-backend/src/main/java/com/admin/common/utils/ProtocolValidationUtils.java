package com.admin.common.utils;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Map;
import java.util.regex.Pattern;

public final class ProtocolValidationUtils {

    private static final Pattern HOST_SAFE = Pattern.compile("^[A-Za-z0-9._-]+$");
    private static final Pattern REALITY_KEY = Pattern.compile("^[A-Za-z0-9_-]{40,64}$");
    private static final Pattern REALITY_SHORT_ID = Pattern.compile("^[0-9a-fA-F]{2,16}$");
    private static final Pattern OUTBOUND_TAG = Pattern.compile("^[A-Za-z0-9._:@-]{1,128}$");

    private ProtocolValidationUtils() {
    }

    public static boolean isValidPort(Integer port) {
        return port != null && port > 0 && port < 65536;
    }

    public static boolean isValidProtocol(String protocol) {
        if (isBlank(protocol)) {
            return true;
        }
        String value = protocol.trim().toLowerCase();
        return "tcp".equals(value) || "udp".equals(value);
    }

    public static boolean isValidHost(String host) {
        if (isBlank(host)) {
            return false;
        }
        String text = host.trim();
        if (text.length() > 255 || text.contains("/") || text.contains("\\")
                || text.contains("://") || containsWhitespace(text)) {
            return false;
        }
        if (text.startsWith("[") || text.endsWith("]")) {
            return text.startsWith("[") && text.endsWith("]") && isValidIpv6Literal(text.substring(1, text.length() - 1));
        }
        if (text.contains(":")) {
            return text.indexOf(':') != text.lastIndexOf(':') && isValidIpv6Literal(text);
        }
        return HOST_SAFE.matcher(text).matches();
    }

    public static boolean isValidHostPort(String value) {
        HostPort hostPort = parseHostPort(value);
        return hostPort != null && isValidHost(hostPort.host) && isValidPort(hostPort.port);
    }

    public static String validateReality(String serverName, String dest, JSONObject realitySettings) {
        if (!isBlank(serverName) && !isValidHost(serverName)) {
            return "reality serverName is invalid";
        }
        if (!isBlank(dest) && !isValidHostPort(dest)) {
            return "reality dest is invalid";
        }
        if (realitySettings == null) {
            return null;
        }
        Object serverNames = realitySettings.get("serverNames");
        if (serverNames instanceof JSONArray) {
            for (Object value : (JSONArray) serverNames) {
                if (!isValidHost(String.valueOf(value))) {
                    return "reality serverName is invalid";
                }
            }
        }
        String singleServerName = realitySettings.getString("serverName");
        if (!isBlank(singleServerName) && !isValidHost(singleServerName)) {
            return "reality serverName is invalid";
        }
        String publicKey = realitySettings.getString("publicKey");
        String privateKey = realitySettings.getString("privateKey");
        if (!isBlank(publicKey) && !REALITY_KEY.matcher(publicKey.trim()).matches()) {
            return "reality publicKey is invalid";
        }
        if (!isBlank(privateKey) && !REALITY_KEY.matcher(privateKey.trim()).matches()) {
            return "reality privateKey is invalid";
        }
        Object shortIds = realitySettings.get("shortIds");
        if (shortIds instanceof JSONArray) {
            for (Object value : (JSONArray) shortIds) {
                if (!isBlank(String.valueOf(value)) && !REALITY_SHORT_ID.matcher(String.valueOf(value).trim()).matches()) {
                    return "reality shortId is invalid";
                }
            }
        }
        String shortId = realitySettings.getString("shortId");
        if (!isBlank(shortId) && !REALITY_SHORT_ID.matcher(shortId.trim()).matches()) {
            return "reality shortId is invalid";
        }
        return null;
    }

    public static boolean isValidPsk(String psk) {
        return !isBlank(psk) && psk.trim().length() >= 8 && psk.trim().length() <= 128 && !containsControl(psk);
    }

    public static String validateOutboundTags(Object value) {
        JSONObject object = toObject(value);
        if (object == null) {
            return null;
        }
        return validateOutboundTagsInObject(object);
    }

    public static JSONObject toObject(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof JSONObject) {
            return (JSONObject) value;
        }
        try {
            Object parsed = value instanceof String ? JSON.parse((String) value) : JSON.parse(JSON.toJSONString(value));
            return parsed instanceof JSONObject ? (JSONObject) parsed : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    public static JSONObject parseObject(String value) {
        if (isBlank(value)) {
            return null;
        }
        return toObject(value);
    }

    private static String validateOutboundTagsInObject(JSONObject object) {
        for (Map.Entry<String, Object> entry : object.entrySet()) {
            Object value = entry.getValue();
            if ("outboundTag".equals(entry.getKey())) {
                if (isBlank(String.valueOf(value)) || !OUTBOUND_TAG.matcher(String.valueOf(value).trim()).matches()) {
                    return "outboundTag is invalid";
                }
                continue;
            }
            String nested = validateOutboundTagsInValue(value);
            if (nested != null) {
                return nested;
            }
        }
        return null;
    }

    private static String validateOutboundTagsInValue(Object value) {
        if (value instanceof JSONObject) {
            return validateOutboundTagsInObject((JSONObject) value);
        }
        if (value instanceof JSONArray) {
            for (Object item : (JSONArray) value) {
                String nested = validateOutboundTagsInValue(item);
                if (nested != null) {
                    return nested;
                }
            }
        }
        if (value instanceof String) {
            Object parsed = parseJsonValue((String) value);
            if (parsed != null) {
                return validateOutboundTagsInValue(parsed);
            }
        }
        return null;
    }

    private static Object parseJsonValue(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            Object parsed = JSON.parse(value);
            return parsed instanceof JSONObject || parsed instanceof JSONArray ? parsed : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static HostPort parseHostPort(String value) {
        if (isBlank(value) || containsWhitespace(value)) {
            return null;
        }
        String text = value.trim();
        String host;
        String portText;
        if (text.startsWith("[")) {
            int end = text.indexOf(']');
            if (end <= 1 || end + 2 > text.length() || text.charAt(end + 1) != ':') {
                return null;
            }
            host = text.substring(1, end);
            portText = text.substring(end + 2);
        } else {
            int colon = text.lastIndexOf(':');
            if (colon <= 0 || colon == text.length() - 1 || text.indexOf(':') != colon) {
                return null;
            }
            host = text.substring(0, colon);
            portText = text.substring(colon + 1);
        }
        try {
            return new HostPort(host, Integer.valueOf(portText));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static boolean containsWhitespace(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isWhitespace(value.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    private static boolean isValidIpv6Literal(String value) {
        if (isBlank(value)) {
            return false;
        }
        try {
            InetAddress address = InetAddress.getByName(value);
            return address instanceof Inet6Address;
        } catch (UnknownHostException ignored) {
            return false;
        }
    }

    private static boolean containsControl(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isISOControl(value.charAt(i))) {
                return true;
            }
        }
        return false;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static final class HostPort {
        private final String host;
        private final Integer port;

        private HostPort(String host, Integer port) {
            this.host = host;
            this.port = port;
        }
    }
}
