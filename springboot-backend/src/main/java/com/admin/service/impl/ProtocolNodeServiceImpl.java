package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.ProtocolNodeDto;
import com.admin.common.dto.ProtocolNodeQueryDto;
import com.admin.common.dto.XrayRuntimeInboundDto;
import com.admin.common.dto.XrayRuntimeServerDto;
import com.admin.common.lang.R;
import com.admin.common.utils.LowMemoryPolicyUtils;
import com.admin.common.utils.MasterSelfProtectionUtils;
import com.admin.common.utils.ProtocolValidationUtils;
import com.admin.entity.ControlServer;
import com.admin.entity.DeployTask;
import com.admin.entity.ProtocolNode;
import com.admin.mapper.DeployTaskMapper;
import com.admin.mapper.ProtocolNodeMapper;
import com.admin.service.ControlServerService;
import com.admin.service.ProtocolNodeService;
import com.admin.service.SnellTemplateService;
import com.admin.service.XrayRuntimeService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class ProtocolNodeServiceImpl extends ServiceImpl<ProtocolNodeMapper, ProtocolNode> implements ProtocolNodeService {

    private static final int STATUS_ACTIVE = 1;
    private static final int STATUS_DELETED = 0;
    private static final String ENGINE_XRAY = "xray";
    private static final String ENGINE_SNELL = "snell";
    private static final String DIRECTION_INBOUND = "inbound";

    @Resource
    private ControlServerService controlServerService;

    @Resource
    private XrayRuntimeService xrayRuntimeService;

    @Resource
    private SnellTemplateService snellTemplateService;

    @Resource
    private DeployTaskMapper deployTaskMapper;

    @Override
    public R createNode(ProtocolNodeDto dto) {
        ControlServer server = resolveServer(dto == null ? null : dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String protocol = normalize(dto.getProtocol(), "vless");
        String engine = normalize(dto.getEngine(), inferEngine(protocol));
        String action = normalize(dto.getAction(), "present");
        long now = System.currentTimeMillis();

        ProtocolNode node = new ProtocolNode();
        copyDtoToNode(dto, node);
        node.setServerId(server.getId());
        node.setServerName(server.getName());
        node.setName(firstNotBlank(dto.getName(), "ob-" + protocol + "-" + now));
        node.setProtocol(protocol);
        node.setEngine(engine);
        node.setDirection(normalize(dto.getDirection(), DIRECTION_INBOUND));
        node.setState("pending");
        node.setStatus(STATUS_ACTIVE);
        node.setCreatedTime(now);
        node.setUpdatedTime(now);

        if (ENGINE_SNELL.equals(engine)) {
            String masterGuardError = MasterSelfProtectionUtils.validateListenPortAndAction(
                    server, node.getPort(), action, "协议节点", "协议监听端口");
            if (masterGuardError != null) {
                return R.err(masterGuardError);
            }
            String validation = validateSnellNode(node);
            if (validation != null) {
                return R.err(validation);
            }
            if (!this.save(node)) {
                return R.err("protocol node create failed");
            }
            fillSnellDefaults(node);
            this.updateById(node);
            DeployTask task = createSnellTask(server, node, action);
            return R.ok(result(node, task));
        }

        String nanoError = validateNanoXrayNode(server);
        if (nanoError != null) {
            return R.err(nanoError);
        }

        Map<String, Object> payload = payloadFrom(dto);
        if (payload == null || payload.isEmpty()) {
            return R.err("xray node payload is required");
        }
        String localValidation = validateXrayNodeFields(node);
        if (localValidation != null) {
            return R.err(localValidation);
        }
        String masterGuardError = MasterSelfProtectionUtils.validateListenPortAndAction(
                server, MasterSelfProtectionUtils.firstPort(payloadPort(payload), node.getPort()),
                action, "协议节点", "协议监听端口");
        if (masterGuardError != null) {
            return R.err(masterGuardError);
        }
        String validation = validateXrayNode(node, payload);
        if (validation != null) {
            return R.err(validation);
        }
        XrayRuntimeInboundDto inboundDto = new XrayRuntimeInboundDto();
        inboundDto.setServerId(server.getId());
        inboundDto.setPayload(payload);
        R remote = xrayRuntimeService.addInbound(inboundDto);
        if (!isRemoteSuccess(remote)) {
            return R.err(remoteError(remote, "Protocol inbound create failed"));
        }

        node.setRemoteId(firstNotBlank(node.getRemoteId(), extractRemoteId(remote.getData())));
        node.setConfigJson(JSON.toJSONString(payload));
        node.setState("active");
        node.setLastSync(now);
        return this.save(node) ? R.ok(result(node, null)) : R.err("protocol node create failed");
    }

    @Override
    public R updateNode(ProtocolNodeDto dto) {
        if (dto == null || dto.getId() == null) {
            return R.err("protocol node id is required");
        }
        ProtocolNode exists = this.getById(dto.getId());
        if (exists == null) {
            return R.err("protocol node not found");
        }
        ControlServer server = resolveServer(exists.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String action = normalize(dto.getAction(), "present");

        copyDtoToNode(dto, exists);
        exists.setUpdatedTime(System.currentTimeMillis());
        if (ENGINE_SNELL.equals(normalize(exists.getEngine(), inferEngine(exists.getProtocol())))) {
            String masterGuardError = MasterSelfProtectionUtils.validateListenPortAndAction(
                    server, exists.getPort(), action, "协议节点", "协议监听端口");
            if (masterGuardError != null) {
                return R.err(masterGuardError);
            }
            String validation = validateSnellNode(exists);
            if (validation != null) {
                return R.err(validation);
            }
            fillSnellDefaults(exists);
            exists.setState("pending");
            this.updateById(exists);
            DeployTask task = createSnellTask(server, exists, action);
            return R.ok(result(exists, task));
        }

        String nanoError = validateNanoXrayNode(server);
        if (nanoError != null) {
            return R.err(nanoError);
        }

        String localValidation = validateXrayNodeFields(exists);
        if (localValidation != null) {
            return R.err(localValidation);
        }
        Map<String, Object> payload = payloadFrom(dto);
        Integer listenPort = exists.getPort();
        if (payload != null && !payload.isEmpty()) {
            listenPort = MasterSelfProtectionUtils.firstPort(payloadPort(payload), listenPort);
        }
        String masterGuardError = MasterSelfProtectionUtils.validateListenPortAndAction(
                server, listenPort, action, "协议节点", "协议监听端口");
        if (masterGuardError != null) {
            return R.err(masterGuardError);
        }
        if (payload != null && !payload.isEmpty() && !isBlank(exists.getRemoteId())) {
            String validation = validateXrayNode(exists, payload);
            if (validation != null) {
                return R.err(validation);
            }
            XrayRuntimeInboundDto inboundDto = new XrayRuntimeInboundDto();
            inboundDto.setServerId(server.getId());
            inboundDto.setInboundId(parseInt(exists.getRemoteId()));
            inboundDto.setPayload(payload);
            R remote = xrayRuntimeService.updateInbound(inboundDto);
            if (!isRemoteSuccess(remote)) {
                return R.err(remoteError(remote, "Protocol inbound update failed"));
            }
            exists.setConfigJson(JSON.toJSONString(payload));
            exists.setState("active");
            exists.setLastSync(System.currentTimeMillis());
        }
        return this.updateById(exists) ? R.ok(exists) : R.err("protocol node update failed");
    }

    @Override
    public R listNodes(ProtocolNodeQueryDto dto) {
        QueryWrapper<ProtocolNode> query = new QueryWrapper<>();
        query.eq("status", STATUS_ACTIVE);
        if (dto.getServerId() != null) {
            query.eq("server_id", dto.getServerId());
        }
        if (!isBlank(dto.getProtocol())) {
            query.eq("protocol", normalize(dto.getProtocol(), ""));
        }
        if (!isBlank(dto.getEngine())) {
            query.eq("engine", normalize(dto.getEngine(), ""));
        }
        if (!isBlank(dto.getDirection())) {
            query.eq("direction", normalize(dto.getDirection(), ""));
        }
        query.orderByDesc("updated_time").orderByDesc("id");
        if (dto.getLimit() != null) {
            int limit = Math.max(1, Math.min(dto.getLimit(), 500));
            query.last("LIMIT " + limit);
        }
        return R.ok(this.list(query));
    }

    @Override
    public R deleteNode(ProtocolNodeDto dto) {
        if (dto == null || dto.getId() == null) {
            return R.err("protocol node id is required");
        }
        ProtocolNode node = this.getById(dto.getId());
        if (node == null) {
            return R.err("protocol node not found");
        }
        ControlServer server = resolveServer(node.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String masterGuardError = MasterSelfProtectionUtils.validateAction(server, "absent", "协议节点");
        if (masterGuardError != null) {
            return R.err(masterGuardError);
        }

        if (ENGINE_SNELL.equals(node.getEngine())) {
            node.setState("deleting");
            node.setUpdatedTime(System.currentTimeMillis());
            this.updateById(node);
            DeployTask task = createSnellTask(server, node, "absent");
            return R.ok(result(node, task));
        }

        if (!isBlank(node.getRemoteId())) {
            XrayRuntimeInboundDto inboundDto = new XrayRuntimeInboundDto();
            inboundDto.setServerId(server.getId());
            inboundDto.setInboundId(parseInt(node.getRemoteId()));
            R remote = xrayRuntimeService.deleteInbound(inboundDto);
            if (!isRemoteSuccess(remote)) {
                return R.err(remoteError(remote, "Protocol inbound delete failed"));
            }
        }
        return this.removeById(node.getId()) ? R.ok("protocol node deleted") : R.err("protocol node delete failed");
    }

    @Override
    public R restartNode(ProtocolNodeDto dto) {
        if (dto == null || dto.getId() == null) {
            return R.err("protocol node id is required");
        }
        ProtocolNode node = this.getById(dto.getId());
        if (node == null) {
            return R.err("protocol node not found");
        }
        ControlServer server = resolveServer(node.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        String masterGuardError = MasterSelfProtectionUtils.validateAction(server, "restarted", "协议节点");
        if (masterGuardError != null) {
            return R.err(masterGuardError);
        }
        if (ENGINE_SNELL.equals(node.getEngine())) {
            DeployTask task = createSnellTask(server, node, "restarted");
            node.setState("pending");
            node.setUpdatedTime(System.currentTimeMillis());
            this.updateById(node);
            return R.ok(result(node, task));
        }
        return xrayRuntimeService.restartXray(serverDto(server.getId()));
    }

    @Override
    public R syncNodes(ProtocolNodeQueryDto dto) {
        if (dto == null || dto.getServerId() == null) {
            return R.err("server id is required");
        }
        ControlServer server = resolveServer(dto.getServerId());
        if (server == null) {
            return R.err("server not found");
        }
        R remote = xrayRuntimeService.listInbounds(serverDto(server.getId()));
        if (!isRemoteSuccess(remote)) {
            return R.err(remoteError(remote, "Protocol inbound sync failed"));
        }

        long now = System.currentTimeMillis();
        int count = 0;
        JSONArray inbounds = toJsonArray(unwrap(remote.getData()));
        for (Object item : inbounds) {
            JSONObject inbound = toJsonObject(item);
            if (inbound == null) {
                continue;
            }
            upsertXrayInbound(server, inbound, now);
            count++;
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("serverId", server.getId());
        summary.put("syncedTime", now);
        summary.put("inboundCount", count);
        return R.ok(summary);
    }

    @Override
    public void applyAgentResultNodes(DeployTask task, JSONObject result) {
        if (task == null || result == null) {
            return;
        }
        ControlServer server = resolveServer(task.getServerId());
        if (server == null) {
            return;
        }
        long now = System.currentTimeMillis();
        for (Object item : toJsonArray(result.get("inbounds"))) {
            JSONObject inbound = toJsonObject(item);
            if (inbound != null) {
                upsertManagedInbound(server, inbound, now);
            }
        }
        for (Object item : toJsonArray(result.get("protocolNodes"))) {
            JSONObject meta = toJsonObject(item);
            if (meta != null) {
                upsertNodeMeta(server, meta, now);
            }
        }
    }

    @Override
    public void applyAgentTaskFailure(DeployTask task, JSONObject result, String state) {
        if (task == null || result == null || !"snell".equals(normalize(task.getProtocol(), ""))) {
            return;
        }
        ProtocolNode node = findTaskProtocolNode(task);
        if (node == null) {
            return;
        }
        long now = System.currentTimeMillis();
        node.setState("absent".equals(normalize(task.getAction(), "")) ? "delete_failed" : "failed");
        node.setLastSync(now);
        node.setLastError(extractTaskError(result, state));
        node.setUpdatedTime(now);
        this.updateById(node);
    }

    private DeployTask createSnellTask(ControlServer server, ProtocolNode node, String action) {
        long now = System.currentTimeMillis();
        DeployTask task = new DeployTask();
        task.setServerId(server.getId());
        task.setServerName(server.getName());
        task.setProtocol("snell");
        task.setAction(action);
        task.setState("generated");
        task.setRequestJson(JSON.toJSONString(result(node, null)));
        task.setScript(snellTemplateService.buildNodeScript(node, action));
        task.setStatus(STATUS_ACTIVE);
        task.setCreatedTime(now);
        task.setUpdatedTime(now);
        deployTaskMapper.insert(task);
        return task;
    }

    private ProtocolNode findTaskProtocolNode(DeployTask task) {
        try {
            JSONObject request = JSON.parseObject(task.getRequestJson());
            JSONObject nodeMeta = request == null ? null : request.getJSONObject("node");
            Long id = nodeMeta == null ? null : nodeMeta.getLong("id");
            if (id != null) {
                return this.getById(id);
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private String extractTaskError(JSONObject result, String state) {
        String stderr = result.getString("stderr");
        if (!isBlank(stderr)) {
            return truncate(stderr.trim(), 1000);
        }
        String stdout = result.getString("stdout");
        if (!isBlank(stdout)) {
            return truncate(stdout.trim(), 1000);
        }
        Integer exitCode = result.getInteger("exitCode");
        return "agent task " + normalize(state, "failed") + (exitCode == null ? "" : " with exit code " + exitCode);
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String validateSnellNode(ProtocolNode node) {
        if (!ProtocolValidationUtils.isValidPort(node.getPort())) {
            return "snell port is invalid";
        }
        String psk = extractPsk(node.getCredentialJson());
        if (!isBlank(psk) && !ProtocolValidationUtils.isValidPsk(psk)) {
            return "snell psk is invalid";
        }
        return null;
    }

    private String validateXrayNodeFields(ProtocolNode node) {
        if (node.getPort() != null && !ProtocolValidationUtils.isValidPort(node.getPort())) {
            return "xray port is invalid";
        }
        String outboundTagError = ProtocolValidationUtils.validateOutboundTags(node.getConfigJson());
        if (outboundTagError != null) {
            return outboundTagError;
        }
        return null;
    }

    private String validateXrayNode(ProtocolNode node, Map<String, Object> payload) {
        Integer port = payloadPort(payload);
        if (port == null) {
            port = node.getPort();
        }
        if (port != null && !ProtocolValidationUtils.isValidPort(port)) {
            return "xray port is invalid";
        }
        String outboundTagError = ProtocolValidationUtils.validateOutboundTags(payload);
        if (outboundTagError != null) {
            return outboundTagError;
        }
        JSONObject stream = ProtocolValidationUtils.toObject(payload.get("streamSettings"));
        if (stream == null) {
            return null;
        }
        JSONObject reality = ProtocolValidationUtils.toObject(stream.get("realitySettings"));
        boolean realitySecurity = "reality".equalsIgnoreCase(stream.getString("security"));
        if (reality == null && !realitySecurity) {
            return null;
        }
        if (reality == null) {
            return "reality settings are required";
        }
        String dest = reality == null ? null : reality.getString("dest");
        if (isBlank(dest)) {
            return "reality dest is required";
        }
        if (!hasRealityServerName(reality)) {
            return "reality serverName is required";
        }
        return ProtocolValidationUtils.validateReality(null, dest, reality);
    }

    private boolean hasRealityServerName(JSONObject reality) {
        if (!isBlank(reality.getString("serverName"))) {
            return true;
        }
        Object serverNames = reality.get("serverNames");
        if (serverNames instanceof JSONArray) {
            for (Object value : (JSONArray) serverNames) {
                if (value != null && !isBlank(String.valueOf(value))) {
                    return true;
                }
            }
        }
        return false;
    }

    private Integer payloadPort(Map<String, Object> payload) {
        Object value = payload == null ? null : payload.get("port");
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.valueOf(((String) value).trim());
            } catch (NumberFormatException ignored) {
                return -1;
            }
        }
        return null;
    }

    private String extractPsk(String credentialJson) {
        JSONObject credential = ProtocolValidationUtils.parseObject(credentialJson);
        return credential == null ? null : credential.getString("psk");
    }

    private void upsertXrayInbound(ControlServer server, JSONObject inbound, long now) {
        ProtocolNode node = findExisting(server.getId(), ENGINE_XRAY, DIRECTION_INBOUND,
                stringValue(inbound.get("id")), inbound.getString("protocol"), inbound.getInteger("port"), inbound.getString("remark"));
        if (node == null) {
            node = new ProtocolNode();
            node.setCreatedTime(now);
        }
        node.setServerId(server.getId());
        node.setServerName(server.getName());
        node.setName(firstNotBlank(inbound.getString("remark"), "xray-inbound-" + inbound.getString("id")));
        node.setProtocol(normalize(inbound.getString("protocol"), "xray"));
        node.setEngine(ENGINE_XRAY);
        node.setDirection(DIRECTION_INBOUND);
        node.setListen(inbound.getString("listen"));
        node.setPort(inbound.getInteger("port"));
        node.setRemoteId(stringValue(inbound.get("id")));
        node.setState(Boolean.FALSE.equals(inbound.getBoolean("enable")) ? "disabled" : "active");
        node.setUp(longValue(inbound, "up"));
        node.setDown(longValue(inbound, "down"));
        node.setTotal(totalValue(node.getUp(), node.getDown(), longValue(inbound, "total")));
        node.setConfigJson(JSON.toJSONString(inbound));
        node.setLastSync(now);
        node.setLastError(null);
        node.setStatus(STATUS_ACTIVE);
        node.setUpdatedTime(now);
        saveOrUpdate(node);
    }

    private void upsertManagedInbound(ControlServer server, JSONObject inbound, long now) {
        JSONObject response = parseObject(inbound.getString("response"));
        JSONObject obj = toJsonObject(response == null ? null : response.get("obj"));
        String remoteId = obj == null ? null : stringValue(obj.get("id"));
        if (isBlank(remoteId)) {
            remoteId = extractRemoteId(response);
        }

        ProtocolNode node = findExisting(server.getId(), ENGINE_XRAY, DIRECTION_INBOUND,
                remoteId, inbound.getString("protocol"), inbound.getInteger("port"), inbound.getString("name"));
        if (node == null) {
            node = new ProtocolNode();
            node.setCreatedTime(now);
        }
        node.setServerId(server.getId());
        node.setServerName(server.getName());
        node.setName(firstNotBlank(inbound.getString("name"), "ob-" + inbound.getString("protocol")));
        node.setProtocol(normalize(inbound.getString("protocol"), "xray"));
        node.setEngine(ENGINE_XRAY);
        node.setDirection(DIRECTION_INBOUND);
        node.setPort(inbound.getInteger("port"));
        node.setRemoteId(remoteId);
        node.setTransport(firstNotBlank(inbound.getString("transport"), "tcp"));
        node.setSecurity(inbound.getString("security"));
        node.setConfigJson(JSON.toJSONString(inbound));
        node.setState("active");
        node.setLastSync(now);
        node.setStatus(STATUS_ACTIVE);
        node.setUpdatedTime(now);
        saveOrUpdate(node);
    }

    private void upsertNodeMeta(ControlServer server, JSONObject meta, long now) {
        ProtocolNode node = null;
        Long id = meta.getLong("id");
        if (id != null) {
            node = this.getById(id);
        }
        if (node == null) {
            node = findExisting(server.getId(), normalize(meta.getString("engine"), inferEngine(meta.getString("protocol"))),
                    normalize(meta.getString("direction"), DIRECTION_INBOUND),
                    firstNotBlank(meta.getString("remoteId"), meta.getString("serviceName")),
                    meta.getString("protocol"), meta.getInteger("port"), meta.getString("name"));
        }
        if (node == null) {
            node = new ProtocolNode();
            node.setCreatedTime(now);
        }

        String protocol = normalize(meta.getString("protocol"), "snell");
        String engine = normalize(meta.getString("engine"), inferEngine(protocol));
        node.setServerId(server.getId());
        node.setServerName(server.getName());
        node.setName(firstNotBlank(meta.getString("name"), node.getName(), protocol + "-" + now));
        node.setProtocol(protocol);
        node.setEngine(engine);
        node.setDirection(normalize(meta.getString("direction"), DIRECTION_INBOUND));
        setIfNotBlank(meta.getString("listen"), node::setListen);
        if (meta.getInteger("port") != null) node.setPort(meta.getInteger("port"));
        setIfNotBlank(meta.getString("transport"), node::setTransport);
        setIfNotBlank(meta.getString("security"), node::setSecurity);
        setJson(meta, "credentialJson", "credential", node::setCredentialJson);
        setJson(meta, "configJson", "config", node::setConfigJson);
        setIfNotBlank(meta.getString("remoteId"), node::setRemoteId);
        setIfNotBlank(meta.getString("serviceName"), node::setServiceName);
        setIfNotBlank(meta.getString("state"), node::setState);
        if (meta.getLong("up") != null) node.setUp(meta.getLong("up"));
        if (meta.getLong("down") != null) node.setDown(meta.getLong("down"));
        if (meta.getLong("total") != null) node.setTotal(meta.getLong("total"));
        node.setLastSync(now);
        node.setLastError(meta.getString("lastError"));
        node.setStatus("deleted".equals(node.getState()) ? STATUS_DELETED : STATUS_ACTIVE);
        node.setUpdatedTime(now);
        saveOrUpdate(node);
    }

    private ProtocolNode findExisting(Long serverId, String engine, String direction, String remoteId,
                                      String protocol, Integer port, String name) {
        QueryWrapper<ProtocolNode> query = new QueryWrapper<>();
        query.eq("server_id", serverId)
                .eq("engine", engine)
                .eq("direction", direction)
                .eq("status", STATUS_ACTIVE);
        if (!isBlank(remoteId)) {
            query.eq("remote_id", remoteId);
        } else if (port != null && !isBlank(protocol)) {
            query.eq("port", port).eq("protocol", normalize(protocol, ""));
        } else if (!isBlank(name)) {
            query.eq("name", name);
        } else {
            return null;
        }
        query.last("LIMIT 1");
        return this.getOne(query, false);
    }

    private void fillSnellDefaults(ProtocolNode node) {
        node.setEngine(ENGINE_SNELL);
        node.setProtocol("snell");
        node.setDirection(normalize(node.getDirection(), DIRECTION_INBOUND));
        node.setTransport(firstNotBlank(node.getTransport(), "tcp"));
        node.setSecurity(firstNotBlank(node.getSecurity(), "psk"));
        if (isBlank(node.getListen())) {
            node.setListen("::0");
        }
        if (isBlank(node.getServiceName())) {
            node.setServiceName("snell-node-" + node.getId() + ".service");
        }
        if (isBlank(node.getRemoteId())) {
            node.setRemoteId(node.getServiceName());
        }
    }

    private void copyDtoToNode(ProtocolNodeDto dto, ProtocolNode node) {
        if (dto == null) {
            return;
        }
        setIfNotBlank(dto.getName(), node::setName);
        setIfNotBlank(dto.getProtocol(), value -> node.setProtocol(normalize(value, "")));
        setIfNotBlank(dto.getEngine(), value -> node.setEngine(normalize(value, "")));
        setIfNotBlank(dto.getDirection(), value -> node.setDirection(normalize(value, "")));
        if (dto.getListen() != null) node.setListen(dto.getListen().trim());
        if (dto.getPort() != null) node.setPort(dto.getPort());
        setIfNotBlank(dto.getTransport(), node::setTransport);
        setIfNotBlank(dto.getSecurity(), node::setSecurity);
        setIfNotBlank(dto.getCredentialJson(), node::setCredentialJson);
        setIfNotBlank(dto.getConfigJson(), node::setConfigJson);
        setIfNotBlank(dto.getRemoteId(), node::setRemoteId);
        setIfNotBlank(dto.getServiceName(), node::setServiceName);
    }

    private Map<String, Object> payloadFrom(ProtocolNodeDto dto) {
        if (dto == null) {
            return null;
        }
        if (dto.getPayload() != null && !dto.getPayload().isEmpty()) {
            return dto.getPayload();
        }
        if (isBlank(dto.getConfigJson())) {
            return null;
        }
        try {
            Object parsed = JSON.parse(dto.getConfigJson());
            if (parsed instanceof Map) {
                return (Map<String, Object>) parsed;
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private Map<String, Object> result(ProtocolNode node, DeployTask task) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("node", node);
        if (task != null) {
            data.put("task", taskSummary(task));
        }
        return data;
    }

    private Map<String, Object> taskSummary(DeployTask task) {
        Map<String, Object> item = new LinkedHashMap<>();
        if (task == null) {
            return item;
        }
        item.put("id", task.getId());
        item.put("serverId", task.getServerId());
        item.put("serverName", task.getServerName());
        item.put("protocol", task.getProtocol());
        item.put("action", task.getAction());
        item.put("state", task.getState());
        item.put("status", task.getStatus());
        item.put("createdTime", task.getCreatedTime());
        item.put("updatedTime", task.getUpdatedTime());
        return item;
    }

    private XrayRuntimeServerDto serverDto(Long serverId) {
        XrayRuntimeServerDto dto = new XrayRuntimeServerDto();
        dto.setServerId(serverId);
        return dto;
    }

    private ControlServer resolveServer(Long serverId) {
        return serverId == null ? null : controlServerService.getById(serverId);
    }

    private String validateNanoXrayNode(ControlServer server) {
        if (!LowMemoryPolicyUtils.isNanoCritical(server == null ? null : server.getMemoryTotalMb())) {
            return null;
        }
        return "server memory is below 200 MB; Nano nodes should use Snell or remote port forwarding instead of Xray inbound nodes";
    }

    private String inferEngine(String protocol) {
        return "snell".equals(normalize(protocol, "")) ? ENGINE_SNELL : ENGINE_XRAY;
    }

    private String normalize(String value, String fallback) {
        return isBlank(value) ? fallback : value.trim().toLowerCase();
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean isRemoteSuccess(R remote) {
        if (remote == null || remote.getCode() != 0) {
            return false;
        }
        JSONObject object = toJsonObject(remote.getData());
        if (object == null) {
            return true;
        }
        Boolean success = object.getBoolean("success");
        return success == null || success;
    }

    private String remoteError(R remote, String fallback) {
        if (remote == null) {
            return fallback;
        }
        JSONObject object = toJsonObject(remote.getData());
        if (object != null && !isBlank(object.getString("msg"))) {
            return object.getString("msg");
        }
        return isBlank(remote.getMsg()) ? fallback : remote.getMsg();
    }

    private Object unwrap(Object data) {
        JSONObject object = toJsonObject(data);
        if (object != null && object.containsKey("obj")) {
            return object.get("obj");
        }
        return data;
    }

    private String extractRemoteId(Object data) {
        JSONObject object = toJsonObject(data);
        if (object == null) {
            return null;
        }
        Object unwrapped = object.containsKey("obj") ? object.get("obj") : object;
        JSONObject obj = toJsonObject(unwrapped);
        if (obj != null) {
            return stringValue(firstNotNull(obj.get("id"), obj.get("inboundId")));
        }
        return stringValue(unwrapped);
    }

    private Object firstNotNull(Object... values) {
        for (Object value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private JSONArray toJsonArray(Object value) {
        if (value == null) {
            return new JSONArray();
        }
        if (value instanceof JSONArray) {
            return (JSONArray) value;
        }
        if (value instanceof String) {
            try {
                Object parsed = JSON.parse((String) value);
                return parsed instanceof JSONArray ? (JSONArray) parsed : new JSONArray();
            } catch (Exception ignored) {
                return new JSONArray();
            }
        }
        try {
            Object parsed = JSON.parse(JSON.toJSONString(value));
            return parsed instanceof JSONArray ? (JSONArray) parsed : new JSONArray();
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private JSONObject toJsonObject(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof JSONObject) {
            return (JSONObject) value;
        }
        if (value instanceof String) {
            return parseObject((String) value);
        }
        try {
            Object parsed = JSON.parse(JSON.toJSONString(value));
            return parsed instanceof JSONObject ? (JSONObject) parsed : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private JSONObject parseObject(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return JSON.parseObject(value);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long longValue(JSONObject object, String key) {
        if (object == null || object.get(key) == null) {
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

    private Integer parseInt(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private void setIfNotBlank(String value, java.util.function.Consumer<String> setter) {
        if (!isBlank(value)) {
            setter.accept(value.trim());
        }
    }

    private void setJson(JSONObject object, String stringKey, String objectKey, java.util.function.Consumer<String> setter) {
        Object value = object.get(stringKey);
        if (value == null) {
            value = object.get(objectKey);
        }
        if (value == null) {
            return;
        }
        setter.accept(value instanceof String ? (String) value : JSON.toJSONString(value));
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
