package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.XrayRuntimeInboundDto;
import com.admin.common.dto.XrayRuntimeServerDto;
import com.admin.common.dto.XrayRuntimeTrafficQueryDto;
import com.admin.common.dto.XrayRuntimeXraySettingDto;
import com.admin.common.lang.R;
import com.admin.common.utils.MasterSelfProtectionUtils;
import com.admin.common.utils.SecretCryptoUtils;
import com.admin.config.RestTemplateConfig;
import com.admin.entity.ControlServer;
import com.admin.entity.XrayRuntimeTrafficSnapshot;
import com.admin.mapper.XrayRuntimeTrafficSnapshotMapper;
import com.admin.service.ControlServerService;
import com.admin.service.XrayRuntimeService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.annotation.Resource;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class XrayRuntimeServiceImpl implements XrayRuntimeService {

    private static final String DEFAULT_OUTBOUND_TEST_URL = "https://www.google.com/generate_204";

    @Resource
    private RestTemplate restTemplate;

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private XrayRuntimeTrafficSnapshotMapper trafficSnapshotMapper;

    @Resource
    private SecretCryptoUtils secretCryptoUtils;

    @Override
    public R testConnection(XrayRuntimeServerDto dto) {
        return apiGet(resolveServer(dto.getServerId()), "/panel/api/server/status", true);
    }

    @Override
    public R listInbounds(XrayRuntimeServerDto dto) {
        R result = apiGet(resolveServer(dto.getServerId()), "/panel/api/inbounds/list", true);
        markSynced(dto.getServerId(), result);
        return result;
    }

    @Override
    public R addInbound(XrayRuntimeInboundDto dto) {
        ControlServer server = resolveServer(dto.getServerId());
        String guard = guardInboundPort(server, dto.getPayload());
        if (guard != null) {
            return R.err(guard);
        }
        return apiPostForm(server, "/panel/api/inbounds/add", payloadToForm(dto.getPayload()), true);
    }

    @Override
    public R updateInbound(XrayRuntimeInboundDto dto) {
        if (dto.getInboundId() == null) {
            return R.err("inbound id is required");
        }
        ControlServer server = resolveServer(dto.getServerId());
        Map<String, Object> payload = new LinkedHashMap<>(safePayload(dto.getPayload()));
        payload.putIfAbsent("id", dto.getInboundId());
        String guard = guardInboundPort(server, payload);
        if (guard != null) {
            return R.err(guard);
        }
        return apiPostForm(server, "/panel/api/inbounds/update/" + dto.getInboundId(), payloadToForm(payload), true);
    }

    @Override
    public R deleteInbound(XrayRuntimeInboundDto dto) {
        if (dto.getInboundId() == null) {
            return R.err("inbound id is required");
        }
        return apiPostForm(resolveServer(dto.getServerId()), "/panel/api/inbounds/del/" + dto.getInboundId(), new LinkedMultiValueMap<>(), true);
    }

    @Override
    public R setInboundEnable(XrayRuntimeInboundDto dto) {
        if (dto.getInboundId() == null || dto.getEnable() == null) {
            return R.err("inbound id and enable are required");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("enable", String.valueOf(dto.getEnable()));
        return apiPostForm(resolveServer(dto.getServerId()), "/panel/api/inbounds/setEnable/" + dto.getInboundId(), form, true);
    }

    @Override
    public R addClient(XrayRuntimeInboundDto dto) {
        if (dto.getInboundId() == null || isBlank(dto.getSettingsJson())) {
            return R.err("inbound id and settingsJson are required");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("id", String.valueOf(dto.getInboundId()));
        form.add("settings", dto.getSettingsJson());
        return apiPostForm(resolveServer(dto.getServerId()), "/panel/api/inbounds/addClient", form, true);
    }

    @Override
    public R updateClient(XrayRuntimeInboundDto dto) {
        if (dto.getInboundId() == null || isBlank(dto.getClientId()) || isBlank(dto.getSettingsJson())) {
            return R.err("inbound id, client id and settingsJson are required");
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("id", String.valueOf(dto.getInboundId()));
        form.add("settings", dto.getSettingsJson());
        return apiPostForm(resolveServer(dto.getServerId()), "/panel/api/inbounds/updateClient/" + encodePath(dto.getClientId()), form, true);
    }

    @Override
    public R deleteClient(XrayRuntimeInboundDto dto) {
        if (dto.getInboundId() == null || isBlank(dto.getClientId())) {
            return R.err("inbound id and client id are required");
        }
        String path = "/panel/api/inbounds/" + dto.getInboundId() + "/delClient/" + encodePath(dto.getClientId());
        return apiPostForm(resolveServer(dto.getServerId()), path, new LinkedMultiValueMap<>(), true);
    }

    @Override
    public R resetClientTraffic(XrayRuntimeInboundDto dto) {
        if (dto.getInboundId() == null || isBlank(dto.getEmail())) {
            return R.err("inbound id and email are required");
        }
        String path = "/panel/api/inbounds/" + dto.getInboundId() + "/resetClientTraffic/" + encodePath(dto.getEmail());
        return apiPostForm(resolveServer(dto.getServerId()), path, new LinkedMultiValueMap<>(), true);
    }

    @Override
    public R getConfig(XrayRuntimeServerDto dto) {
        return apiGet(resolveServer(dto.getServerId()), "/panel/api/server/getConfigJson", true);
    }

    @Override
    public R getOutbounds(XrayRuntimeServerDto dto) {
        R configResult = getConfig(dto);
        if (configResult.getCode() != 0) {
            return configResult;
        }

        Object data = configResult.getData();
        Object config = unwrapObj(data);
        Object outbounds = extractOutbounds(config);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("config", config);
        result.put("outbounds", outbounds);
        return R.ok(result);
    }

    @Override
    public R getOutboundsTraffic(XrayRuntimeServerDto dto) {
        ControlServer server = resolveServer(dto.getServerId());
        XrayRuntimeSession session = loginSession(server);
        if (!session.isReady()) {
            return R.err(session.error);
        }
        return exchange(server, HttpMethod.GET, "/panel/xray/getOutboundsTraffic", new HttpEntity<>(session.headers()), false);
    }

    @Override
    public R syncTraffic(XrayRuntimeServerDto dto) {
        ControlServer server = resolveServer(dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }

        long now = System.currentTimeMillis();
        List<XrayRuntimeTrafficSnapshot> snapshots = new ArrayList<>();
        TrafficTotals totals = new TrafficTotals();

        R inboundResult = apiGet(server, "/panel/api/inbounds/list", true);
        if (inboundResult.getCode() != 0 || !isSuccessEnvelope(inboundResult.getData())) {
            return inboundResult.getCode() != 0 ? inboundResult : R.err("Protocol inbound traffic sync failed");
        }
        syncInboundSnapshots(server, toJsonArray(unwrapObj(inboundResult.getData())), now, snapshots, totals);

        String outboundError = null;
        R outboundResult = getOutboundsTraffic(dto);
        if (outboundResult.getCode() == 0 && isSuccessEnvelope(outboundResult.getData())) {
            syncOutboundSnapshots(server, toJsonArray(unwrapObj(outboundResult.getData())), now, snapshots, totals);
        } else {
            outboundError = outboundResult.getMsg();
            if (outboundError == null || outboundError.isEmpty()) {
                outboundError = "Protocol outbound traffic sync skipped";
            }
        }

        for (XrayRuntimeTrafficSnapshot snapshot : snapshots) {
            trafficSnapshotMapper.insert(snapshot);
        }
        markTrafficSynced(server, now, totals);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("serverId", server.getId());
        summary.put("syncedTime", now);
        summary.put("snapshotCount", snapshots.size());
        summary.put("inboundCount", countType(snapshots, "inbound"));
        summary.put("clientCount", countType(snapshots, "client"));
        summary.put("outboundCount", countType(snapshots, "outbound"));
        summary.put("uploadTraffic", totals.up);
        summary.put("downloadTraffic", totals.down);
        summary.put("totalTraffic", totals.up + totals.down);
        if (outboundError != null) {
            summary.put("outboundWarning", outboundError);
        }
        return R.ok(summary);
    }

    @Override
    public R listTrafficSnapshots(XrayRuntimeTrafficQueryDto dto) {
        int limit = dto.getLimit() == null ? 200 : Math.max(1, Math.min(dto.getLimit(), 500));
        QueryWrapper<XrayRuntimeTrafficSnapshot> query = new QueryWrapper<>();
        if (dto.getServerId() != null) {
            query.eq("server_id", dto.getServerId());
        }
        if (!isBlank(dto.getSourceType())) {
            query.eq("source_type", dto.getSourceType().trim().toLowerCase());
        }
        query.orderByDesc("synced_time").orderByDesc("id").last("LIMIT " + limit);
        return R.ok(trafficSnapshotMapper.selectList(query));
    }

    @Override
    public R saveXraySetting(XrayRuntimeXraySettingDto dto) {
        ControlServer server = resolveServer(dto.getServerId());
        XrayRuntimeSession session = loginSession(server);
        if (!session.isReady()) {
            return R.err(session.error);
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("xraySetting", dto.getXraySetting());
        form.add("outboundTestUrl", isBlank(dto.getOutboundTestUrl()) ? DEFAULT_OUTBOUND_TEST_URL : dto.getOutboundTestUrl());

        HttpHeaders headers = session.headers();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        return exchange(server, HttpMethod.POST, "/panel/xray/update", new HttpEntity<>(form, headers), false);
    }

    @Override
    public R restartXray(XrayRuntimeServerDto dto) {
        return apiPostForm(resolveServer(dto.getServerId()), "/panel/api/server/restartXrayService", new LinkedMultiValueMap<>(), true);
    }

    private R apiGet(ControlServer server, String path, boolean bearerRequired) {
        HttpHeaders headers = apiHeaders(server, bearerRequired);
        return exchange(server, HttpMethod.GET, path, new HttpEntity<>(headers), bearerRequired);
    }

    private R apiPostForm(ControlServer server, String path, MultiValueMap<String, String> form, boolean bearerRequired) {
        HttpHeaders headers = apiHeaders(server, bearerRequired);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        return exchange(server, HttpMethod.POST, path, new HttpEntity<>(form, headers), bearerRequired);
    }

    private R exchange(ControlServer server, HttpMethod method, String path, HttpEntity<?> entity, boolean bearerRequired) {
        if (server == null) {
            return R.err("server not found");
        }
        if (bearerRequired && isBlank(server.getXrayRuntimeApiToken())) {
            return R.err("Node service api token is required for this action");
        }
        if (isBlank(server.getXrayRuntimeEndpoint())) {
            return R.err("Node service endpoint is required");
        }

        try {
            ResponseEntity<String> response = clientFor(server).exchange(buildUrl(server, path), method, entity, String.class);
            return normalizeResponse(response.getBody());
        } catch (RestClientException e) {
            return R.err(nodeServiceConnectionMessage(server, path, e));
        } catch (Exception e) {
            return R.err(nodeServiceConnectionMessage(server, path, e));
        }
    }

    private HttpHeaders apiHeaders(ControlServer server, boolean bearerRequired) {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        if (server != null && !isBlank(server.getXrayRuntimeApiToken())) {
            headers.setBearerAuth(server.getXrayRuntimeApiToken().trim());
        }
        return headers;
    }

    private XrayRuntimeSession loginSession(ControlServer server) {
        if (server == null) {
            return XrayRuntimeSession.error("server not found");
        }
        if (isBlank(server.getXrayRuntimeUsername()) || isBlank(server.getXrayRuntimePassword())) {
            return XrayRuntimeSession.error("Node service username and password are required for outbound save");
        }
        try {
            RestTemplate client = clientFor(server);
            ResponseEntity<String> csrfResp = client.exchange(buildUrl(server, "/csrf-token"), HttpMethod.GET, new HttpEntity<>(new HttpHeaders()), String.class);
            String csrf = extractObjString(csrfResp.getBody());
            List<String> cookies = new ArrayList<>(csrfResp.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE));
            if (isBlank(csrf)) {
                return XrayRuntimeSession.error("Node service csrf token missing");
            }

            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("username", server.getXrayRuntimeUsername());
            form.add("password", server.getXrayRuntimePassword());
            if (!isBlank(server.getXrayRuntimeTwoFactorCode())) {
                form.add("twoFactorCode", server.getXrayRuntimeTwoFactorCode());
            }

            HttpHeaders loginHeaders = new HttpHeaders();
            loginHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            loginHeaders.add("X-CSRF-Token", csrf);
            if (!cookies.isEmpty()) {
                loginHeaders.add(HttpHeaders.COOKIE, joinCookies(cookies));
            }
            ResponseEntity<String> loginResp = client.exchange(buildUrl(server, "/login"), HttpMethod.POST, new HttpEntity<>(form, loginHeaders), String.class);
            cookies.addAll(loginResp.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE));
            R loginResult = normalizeResponse(loginResp.getBody());
            if (loginResult.getCode() != 0 || !isSuccessEnvelope(loginResult.getData())) {
                return XrayRuntimeSession.error("Node service login failed");
            }

            return new XrayRuntimeSession(csrf, joinCookies(cookies), null);
        } catch (Exception e) {
            return XrayRuntimeSession.error(nodeServiceConnectionMessage(server, "/login", e));
        }
    }

    private RestTemplate clientFor(ControlServer server) throws Exception {
        Integer xrayRuntimeAllowInsecure = server.getXrayRuntimeAllowInsecure();
        boolean allowInsecure = (xrayRuntimeAllowInsecure != null ? xrayRuntimeAllowInsecure : server.getAllowInsecure()) != null
                && (xrayRuntimeAllowInsecure != null ? xrayRuntimeAllowInsecure : server.getAllowInsecure()) == 1;
        return allowInsecure ? new RestTemplate(RestTemplateConfig.generateHttpRequestFactory()) : restTemplate;
    }

    private ControlServer resolveServer(Long serverId) {
        if (serverId == null) {
            return null;
        }
        return decryptServerSecrets(controlServerService.getById(serverId));
    }

    private String guardInboundPort(ControlServer server, Map<String, Object> payload) {
        Integer port = payloadPort(payload);
        return MasterSelfProtectionUtils.validateListenPort(server, port, "协议入站端口");
    }

    private Integer payloadPort(Map<String, Object> payload) {
        Object value = payload == null ? null : payload.get("port");
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.valueOf(((String) value).trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private ControlServer decryptServerSecrets(ControlServer server) {
        if (server == null) {
            return null;
        }
        server.setXrayRuntimeApiToken(secretCryptoUtils.decryptIfNeeded(server.getXrayRuntimeApiToken()));
        server.setXrayRuntimePassword(secretCryptoUtils.decryptIfNeeded(server.getXrayRuntimePassword()));
        server.setXrayRuntimeTwoFactorCode(secretCryptoUtils.decryptIfNeeded(server.getXrayRuntimeTwoFactorCode()));
        return server;
    }

    private void markSynced(Long serverId, R result) {
        if (result.getCode() != 0 || !isSuccessEnvelope(result.getData())) {
            return;
        }
        ControlServer update = new ControlServer();
        update.setId(serverId);
        update.setXrayRuntimeLastSync(System.currentTimeMillis());
        update.setUpdatedTime(System.currentTimeMillis());
        controlServerService.updateById(update);
    }

    private void markTrafficSynced(ControlServer server, long syncedTime, TrafficTotals totals) {
        ControlServer update = new ControlServer();
        update.setId(server.getId());
        update.setXrayRuntimeLastSync(syncedTime);
        update.setUploadTraffic(totals.up);
        update.setDownloadTraffic(totals.down);
        update.setUpdatedTime(syncedTime);
        controlServerService.updateById(update);
    }

    private void syncInboundSnapshots(ControlServer server, JSONArray inbounds, long now,
                                      List<XrayRuntimeTrafficSnapshot> snapshots, TrafficTotals totals) {
        for (Object item : inbounds) {
            JSONObject inbound = toJsonObject(item);
            if (inbound == null) {
                continue;
            }
            Integer inboundId = inbound.getInteger("id");
            String remark = inbound.getString("remark");
            String tag = inbound.getString("tag");
            String protocol = inbound.getString("protocol");

            XrayRuntimeTrafficSnapshot inboundSnapshot = baseSnapshot(server, "inbound", now);
            inboundSnapshot.setInboundId(inboundId);
            inboundSnapshot.setInboundRemark(remark);
            inboundSnapshot.setProtocol(protocol);
            inboundSnapshot.setTag(tag);
            inboundSnapshot.setUp(longValue(inbound, "up"));
            inboundSnapshot.setDown(longValue(inbound, "down"));
            inboundSnapshot.setTotal(totalValue(inboundSnapshot.getUp(), inboundSnapshot.getDown(), longValue(inbound, "total")));
            inboundSnapshot.setExpiryTime(longValue(inbound, "expiryTime"));
            inboundSnapshot.setEnable(booleanToInt(inbound.getBoolean("enable")));
            inboundSnapshot.setRawJson(JSON.toJSONString(inbound));
            snapshots.add(inboundSnapshot);
            totals.add(inboundSnapshot.getUp(), inboundSnapshot.getDown());

            JSONArray clientStats = toJsonArray(inbound.get("clientStats"));
            for (Object clientItem : clientStats) {
                JSONObject client = toJsonObject(clientItem);
                if (client == null) {
                    continue;
                }
                XrayRuntimeTrafficSnapshot clientSnapshot = baseSnapshot(server, "client", now);
                clientSnapshot.setInboundId(firstInt(client.getInteger("inboundId"), client.getInteger("inbound_id"), inboundId));
                clientSnapshot.setInboundRemark(remark);
                clientSnapshot.setProtocol(protocol);
                clientSnapshot.setTag(tag);
                clientSnapshot.setEmail(client.getString("email"));
                clientSnapshot.setClientId(firstString(client.getString("id"), client.getString("uuid"), client.getString("clientId")));
                clientSnapshot.setUp(longValue(client, "up"));
                clientSnapshot.setDown(longValue(client, "down"));
                clientSnapshot.setTotal(totalValue(clientSnapshot.getUp(), clientSnapshot.getDown(), longValue(client, "total")));
                clientSnapshot.setExpiryTime(longValue(client, "expiryTime"));
                clientSnapshot.setEnable(booleanToInt(client.getBoolean("enable")));
                clientSnapshot.setRawJson(JSON.toJSONString(client));
                snapshots.add(clientSnapshot);
            }
        }
    }

    private void syncOutboundSnapshots(ControlServer server, JSONArray outbounds, long now,
                                       List<XrayRuntimeTrafficSnapshot> snapshots, TrafficTotals totals) {
        for (Object item : outbounds) {
            JSONObject outbound = toJsonObject(item);
            if (outbound == null) {
                continue;
            }
            XrayRuntimeTrafficSnapshot snapshot = baseSnapshot(server, "outbound", now);
            snapshot.setTag(outbound.getString("tag"));
            snapshot.setUp(longValue(outbound, "up"));
            snapshot.setDown(longValue(outbound, "down"));
            snapshot.setTotal(totalValue(snapshot.getUp(), snapshot.getDown(), longValue(outbound, "total")));
            snapshot.setRawJson(JSON.toJSONString(outbound));
            snapshots.add(snapshot);
        }
    }

    private XrayRuntimeTrafficSnapshot baseSnapshot(ControlServer server, String sourceType, long now) {
        XrayRuntimeTrafficSnapshot snapshot = new XrayRuntimeTrafficSnapshot();
        snapshot.setServerId(server.getId());
        snapshot.setServerName(server.getName());
        snapshot.setSourceType(sourceType);
        snapshot.setSyncedTime(now);
        snapshot.setStatus(1);
        snapshot.setCreatedTime(now);
        snapshot.setUpdatedTime(now);
        return snapshot;
    }

    private int countType(List<XrayRuntimeTrafficSnapshot> snapshots, String sourceType) {
        int count = 0;
        for (XrayRuntimeTrafficSnapshot snapshot : snapshots) {
            if (sourceType.equals(snapshot.getSourceType())) {
                count++;
            }
        }
        return count;
    }

    private String buildUrl(ControlServer server, String path) {
        String endpoint = trimTrailingSlash(server.getXrayRuntimeEndpoint().trim());
        String basePath = normalizeBasePath(server.getXrayRuntimeBasePath());
        String cleanPath = path.startsWith("/") ? path : "/" + path;
        return endpoint + basePath + cleanPath;
    }

    private String nodeServiceConnectionMessage(ControlServer server, String path, Exception e) {
        String serverName = server == null ? "unknown" : firstNotBlank(server.getName(), server.getHost(), String.valueOf(server.getId()));
        String endpoint = server == null ? "" : nullToEmpty(server.getXrayRuntimeEndpoint()).trim();
        String basePath = server == null ? "" : normalizeBasePath(server.getXrayRuntimeBasePath());
        String raw = e == null || e.getMessage() == null ? "" : e.getMessage();
        String lower = raw.toLowerCase(Locale.ROOT);
        StringBuilder message = new StringBuilder();

        message.append("节点服务未连接：").append(serverName);
        if (!isBlank(endpoint)) {
            message.append("（").append(endpoint).append(basePath).append("）");
        }
        message.append("。");

        if (isLoopbackEndpoint(endpoint)) {
            message.append("当前地址是 127.0.0.1/localhost，主控在 Docker 内时这不是被控服务器。");
            message.append("请在服务器卡片点击“部署/修复节点服务”，或把节点服务地址改为 http://<被控服务器IP>:5168。");
            message.append("如果主控和被控确实在同一台宿主机，可改用 http://host.docker.internal:5168。");
        } else if (lower.contains("connection refused") || lower.contains("connectexception")) {
            message.append("目标端口拒绝连接，通常是节点服务未安装、未启动、防火墙未放行，或端口不是 5168。");
            message.append("请先执行“部署/修复节点服务”，完成后再同步出站/流量。");
        } else if (lower.contains("timed out") || lower.contains("timeout")) {
            message.append("连接超时，请检查被控服务器是否在线、端口是否放行、节点服务是否启动。");
        } else if (lower.contains("unknownhost")) {
            message.append("域名或主机不可解析，请检查服务器地址。");
        } else {
            message.append("请先确认节点服务已部署并在线，再重试出站、路由和流量操作。");
        }

        if (!isBlank(path)) {
            message.append(" 操作路径：").append(path);
        }
        return message.toString();
    }

    private boolean isLoopbackEndpoint(String endpoint) {
        if (isBlank(endpoint)) {
            return false;
        }
        try {
            URI uri = URI.create(endpoint.trim());
            String host = uri.getHost();
            return "127.0.0.1".equals(host) || "localhost".equalsIgnoreCase(host) || "::1".equals(host);
        } catch (Exception ignored) {
            String value = endpoint.toLowerCase(Locale.ROOT);
            return value.contains("127.0.0.1") || value.contains("localhost") || value.contains("[::1]");
        }
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return "unknown";
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String normalizeBasePath(String basePath) {
        if (isBlank(basePath) || "/".equals(basePath.trim())) {
            return "";
        }
        String path = basePath.trim();
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        return trimTrailingSlash(path);
    }

    private String trimTrailingSlash(String value) {
        String result = value;
        while (result.endsWith("/")) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    private MultiValueMap<String, String> payloadToForm(Map<String, Object> payload) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        for (Map.Entry<String, Object> entry : safePayload(payload).entrySet()) {
            if (entry.getValue() == null) {
                continue;
            }
            Object value = entry.getValue();
            if (value instanceof Map || value instanceof Collection) {
                form.add(entry.getKey(), JSON.toJSONString(value));
            } else {
                form.add(entry.getKey(), String.valueOf(value));
            }
        }
        return form;
    }

    private Map<String, Object> safePayload(Map<String, Object> payload) {
        return payload == null ? Collections.emptyMap() : payload;
    }

    private R normalizeResponse(String body) {
        if (isBlank(body)) {
            return R.ok();
        }
        try {
            return R.ok(JSON.parse(body));
        } catch (Exception ignored) {
            return R.ok(body);
        }
    }

    private boolean isSuccessEnvelope(Object data) {
        if (data instanceof JSONObject) {
            Boolean success = ((JSONObject) data).getBoolean("success");
            return success == null || success;
        }
        return true;
    }

    private Object unwrapObj(Object data) {
        if (data instanceof JSONObject) {
            JSONObject object = (JSONObject) data;
            if (object.containsKey("obj")) {
                return object.get("obj");
            }
        }
        return data;
    }

    private JSONArray toJsonArray(Object value) {
        if (value == null) {
            return new JSONArray();
        }
        if (value instanceof JSONArray) {
            return (JSONArray) value;
        }
        if (value instanceof Collection) {
            return JSON.parseArray(JSON.toJSONString(value));
        }
        if (value instanceof String) {
            try {
                Object parsed = JSON.parse((String) value);
                return parsed instanceof JSONArray ? (JSONArray) parsed : new JSONArray();
            } catch (Exception ignored) {
                return new JSONArray();
            }
        }
        return new JSONArray();
    }

    private JSONObject toJsonObject(Object value) {
        if (value instanceof JSONObject) {
            return (JSONObject) value;
        }
        if (value instanceof Map) {
            return JSON.parseObject(JSON.toJSONString(value));
        }
        if (value instanceof String) {
            try {
                Object parsed = JSON.parse((String) value);
                return parsed instanceof JSONObject ? (JSONObject) parsed : null;
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private Long longValue(JSONObject object, String key) {
        if (object == null || !object.containsKey(key) || object.get(key) == null) {
            return 0L;
        }
        try {
            return object.getLong(key);
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private Long totalValue(Long up, Long down, Long total) {
        if (total != null && total > 0) {
            return total;
        }
        return (up == null ? 0L : up) + (down == null ? 0L : down);
    }

    private Integer firstInt(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String firstString(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value;
            }
        }
        return null;
    }

    private Integer booleanToInt(Boolean value) {
        if (value == null) {
            return null;
        }
        return value ? 1 : 0;
    }

    private Object extractOutbounds(Object config) {
        Object parsed = config;
        if (parsed instanceof String) {
            try {
                parsed = JSON.parse((String) parsed);
            } catch (Exception ignored) {
                return new JSONArray();
            }
        }
        if (parsed instanceof JSONObject) {
            Object outbounds = ((JSONObject) parsed).get("outbounds");
            return outbounds == null ? new JSONArray() : outbounds;
        }
        return new JSONArray();
    }

    private String extractObjString(String body) {
        if (isBlank(body)) {
            return "";
        }
        try {
            JSONObject json = JSON.parseObject(body);
            Object obj = json.get("obj");
            return obj == null ? "" : String.valueOf(obj);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String joinCookies(List<String> setCookies) {
        List<String> values = new ArrayList<>();
        for (String cookie : setCookies) {
            if (isBlank(cookie)) {
                continue;
            }
            values.add(cookie.split(";", 2)[0]);
        }
        return String.join("; ", values);
    }

    private String encodePath(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static class TrafficTotals {
        private long up;
        private long down;

        private void add(Long up, Long down) {
            this.up += up == null ? 0L : up;
            this.down += down == null ? 0L : down;
        }
    }

    private static class XrayRuntimeSession {
        private final String csrf;
        private final String cookie;
        private final String error;

        private XrayRuntimeSession(String csrf, String cookie, String error) {
            this.csrf = csrf;
            this.cookie = cookie;
            this.error = error;
        }

        private static XrayRuntimeSession error(String error) {
            return new XrayRuntimeSession(null, null, error);
        }

        private boolean isReady() {
            return error == null;
        }

        private HttpHeaders headers() {
            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.add("X-CSRF-Token", csrf);
            headers.add(HttpHeaders.COOKIE, cookie);
            return headers;
        }
    }
}
