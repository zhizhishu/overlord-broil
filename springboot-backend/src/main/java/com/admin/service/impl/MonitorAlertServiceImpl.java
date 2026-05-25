package com.admin.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.admin.common.dto.ControlServerHeartbeatDto;
import com.admin.common.dto.MonitorAlertQueryDto;
import com.admin.common.lang.R;
import com.admin.common.utils.LowMemoryPolicyUtils;
import com.admin.entity.ControlServer;
import com.admin.entity.MonitorAlert;
import com.admin.mapper.ControlServerMapper;
import com.admin.mapper.MonitorAlertMapper;
import com.admin.service.MonitorAlertService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class MonitorAlertServiceImpl extends ServiceImpl<MonitorAlertMapper, MonitorAlert> implements MonitorAlertService {

    private static final int STATUS_ACTIVE = 1;
    private static final int ACK_OPEN = 0;
    private static final int ACK_DONE = 1;
    private static final long OFFLINE_THRESHOLD_MS = 5 * 60 * 1000L;
    private static final long CERT_EXPIRY_WARNING_MS = 30L * 24 * 60 * 60 * 1000L;
    private static final long TRAFFIC_SPIKE_MIN_BYTES = 10L * 1024 * 1024 * 1024;

    @Resource
    private ControlServerMapper controlServerMapper;

    @Override
    public R listAlerts(MonitorAlertQueryDto dto) {
        scanOfflineServers(System.currentTimeMillis());

        QueryWrapper<MonitorAlert> query = new QueryWrapper<>();
        if (dto != null) {
            if (dto.getServerId() != null) {
                query.eq("server_id", dto.getServerId());
            }
            if (notBlank(dto.getAlertType())) {
                query.eq("alert_type", dto.getAlertType().trim());
            }
            if (notBlank(dto.getSeverity())) {
                query.eq("severity", dto.getSeverity().trim());
            }
            if (dto.getAcknowledged() != null) {
                query.eq("acknowledged", dto.getAcknowledged());
            }
        }
        query.eq("status", STATUS_ACTIVE).orderByDesc("last_seen_at").orderByDesc("id");
        int limit = dto == null || dto.getLimit() == null ? 100 : Math.max(1, Math.min(dto.getLimit(), 500));
        query.last("LIMIT " + limit);
        return R.ok(this.list(query));
    }

    @Override
    public R acknowledgeAlert(Long id) {
        MonitorAlert exists = this.getById(id);
        if (exists == null) {
            return R.err("monitor alert not found");
        }

        long now = System.currentTimeMillis();
        MonitorAlert update = new MonitorAlert();
        update.setId(id);
        update.setAcknowledged(ACK_DONE);
        update.setAcknowledgedTime(now);
        update.setUpdatedTime(now);
        return this.updateById(update) ? R.ok("monitor alert acknowledged") : R.err("monitor alert acknowledge failed");
    }

    @Override
    public void handleHeartbeat(ControlServer previous, ControlServerHeartbeatDto dto, long now) {
        if (previous == null || dto == null) {
            return;
        }
        checkService(previous, "xui_service_failure", "x-ui", dto.getXuiServiceStatus(), now);
        checkService(previous, "xray_service_failure", "xray", dto.getXrayServiceStatus(), now);
        checkService(previous, "snell_service_failure", "snell", dto.getSnellServiceStatus(), now);
        checkCertificate(previous, dto, now);
        checkTraffic(previous, dto, now);
        checkLowMemory(previous, dto, now);
    }

    @Override
    public void handleTaskFailed(Long serverId, String serverName, Long taskId, String state, String resultJson, long now) {
        if (serverId == null) {
            return;
        }
        String normalized = normalize(state);
        if (!"failed".equals(normalized) && !"timeout".equals(normalized)) {
            return;
        }
        String alertState = isTimeoutResult(resultJson) ? "timeout" : normalized;

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("taskId", taskId);
        detail.put("state", state);
        detail.put("resultJson", resultJson);
        raise(serverId, serverName, "task_" + alertState, "critical", "deploy_task",
                "Deploy task " + taskId + " " + alertState, detail, now);
    }

    private void scanOfflineServers(long now) {
        QueryWrapper<ControlServer> query = new QueryWrapper<>();
        query.eq("status", STATUS_ACTIVE).isNotNull("last_heartbeat");
        List<ControlServer> servers = controlServerMapper.selectList(query);
        for (ControlServer server : servers) {
            if (server.getLastHeartbeat() != null && now - server.getLastHeartbeat() > OFFLINE_THRESHOLD_MS) {
                Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("lastHeartbeat", server.getLastHeartbeat());
                detail.put("offlineThresholdMs", OFFLINE_THRESHOLD_MS);
                raise(server.getId(), server.getName(), "agent_offline", "critical", "heartbeat",
                        "Agent heartbeat is stale for server " + server.getName(), detail, now);
            }
        }
    }

    private void checkService(ControlServer server, String alertType, String serviceName, String serviceStatus, long now) {
        if (notBlank(serviceStatus) && !isHealthyStatus(serviceStatus)) {
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("service", serviceName);
            detail.put("status", serviceStatus);
            raise(server.getId(), server.getName(), alertType, "critical", "heartbeat",
                    serviceName + " service is " + serviceStatus, detail, now);
        }
    }

    private void checkCertificate(ControlServer server, ControlServerHeartbeatDto dto, long now) {
        if (notBlank(dto.getCertificateStatus()) && !isHealthyStatus(dto.getCertificateStatus())) {
            Map<String, Object> detail = certificateDetail(dto);
            raise(server.getId(), server.getName(), "certificate_expiry", "warning", "heartbeat",
                    "Certificate status is " + dto.getCertificateStatus(), detail, now);
            return;
        }
        Long expireAt = dto.getCertificateExpireAt();
        if (expireAt == null) {
            return;
        }
        long remaining = expireAt - now;
        if (remaining <= CERT_EXPIRY_WARNING_MS) {
            Map<String, Object> detail = certificateDetail(dto);
            detail.put("remainingMs", remaining);
            String severity = remaining <= 0 ? "critical" : "warning";
            raise(server.getId(), server.getName(), "certificate_expiry", severity, "heartbeat",
                    "Certificate expires at " + expireAt, detail, now);
        }
    }

    private Map<String, Object> certificateDetail(ControlServerHeartbeatDto dto) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("mode", dto.getCertificateMode());
        detail.put("domain", dto.getCertificateDomain());
        detail.put("status", dto.getCertificateStatus());
        detail.put("expireAt", dto.getCertificateExpireAt());
        return detail;
    }

    private void checkTraffic(ControlServer previous, ControlServerHeartbeatDto dto, long now) {
        Long upload = dto.getUploadTraffic();
        Long download = dto.getDownloadTraffic();
        if ((upload != null && upload < 0) || (download != null && download < 0)) {
            Map<String, Object> detail = trafficDetail(previous, upload, download);
            raise(previous.getId(), previous.getName(), "traffic_anomaly", "warning", "heartbeat",
                    "Traffic counter reported a negative value", detail, now);
            return;
        }
        long previousTotal = safeLong(previous.getUploadTraffic()) + safeLong(previous.getDownloadTraffic());
        long currentTotal = safeLong(upload) + safeLong(download);
        long delta = currentTotal - previousTotal;
        if (previousTotal > 0 && delta > TRAFFIC_SPIKE_MIN_BYTES && currentTotal > previousTotal * 5) {
            Map<String, Object> detail = trafficDetail(previous, upload, download);
            detail.put("delta", delta);
            raise(previous.getId(), previous.getName(), "traffic_anomaly", "warning", "heartbeat",
                    "Traffic counter increased unusually fast", detail, now);
        }
    }

    private Map<String, Object> trafficDetail(ControlServer previous, Long upload, Long download) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("previousUploadTraffic", previous.getUploadTraffic());
        detail.put("previousDownloadTraffic", previous.getDownloadTraffic());
        detail.put("uploadTraffic", upload);
        detail.put("downloadTraffic", download);
        return detail;
    }

    private void checkLowMemory(ControlServer server, ControlServerHeartbeatDto dto, long now) {
        Long memoryTotalMb = dto.getMemoryTotalMb();
        boolean lowMemoryMode = Integer.valueOf(1).equals(dto.getLowMemoryMode())
                || LowMemoryPolicyUtils.isLowMemory(memoryTotalMb);
        if (!lowMemoryMode) {
            return;
        }

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("memoryTotalMb", memoryTotalMb);
        detail.put("memoryUsage", dto.getMemoryUsage());
        detail.put("profile", notBlank(dto.getLowMemoryProfile())
                ? dto.getLowMemoryProfile()
                : LowMemoryPolicyUtils.profile(memoryTotalMb));
        detail.put("advice", notBlank(dto.getLowMemoryAdvice())
                ? dto.getLowMemoryAdvice()
                : LowMemoryPolicyUtils.advice(memoryTotalMb));
        String severity = LowMemoryPolicyUtils.isNanoCritical(memoryTotalMb)
                ? "critical"
                : "warning";
        String message = memoryTotalMb == null || memoryTotalMb <= 0
                ? "Server is marked as low-memory Nano mode"
                : "Server memory is " + memoryTotalMb + " MB; avoid full 3x-ui/Xray orchestration";
        raise(server.getId(), server.getName(), "low_memory_server", severity, "heartbeat", message, detail, now);
    }

    private void raise(Long serverId, String serverName, String alertType, String severity, String source,
                       String message, Map<String, Object> detail, long now) {
        QueryWrapper<MonitorAlert> query = new QueryWrapper<>();
        query.eq("server_id", serverId)
                .eq("alert_type", alertType)
                .eq("source", source)
                .eq("acknowledged", ACK_OPEN)
                .eq("status", STATUS_ACTIVE)
                .last("LIMIT 1");
        MonitorAlert exists = this.getOne(query, false);
        String detailJson = detail == null ? null : JSON.toJSONString(detail);
        if (exists == null) {
            MonitorAlert alert = new MonitorAlert();
            alert.setServerId(serverId);
            alert.setServerName(serverName);
            alert.setAlertType(alertType);
            alert.setSeverity(severity);
            alert.setSource(source);
            alert.setMessage(message);
            alert.setDetailJson(detailJson);
            alert.setFirstSeenAt(now);
            alert.setLastSeenAt(now);
            alert.setAcknowledged(ACK_OPEN);
            alert.setStatus(STATUS_ACTIVE);
            alert.setCreatedTime(now);
            alert.setUpdatedTime(now);
            this.save(alert);
            return;
        }

        MonitorAlert update = new MonitorAlert();
        update.setId(exists.getId());
        update.setServerName(serverName);
        update.setSeverity(severity);
        update.setMessage(message);
        update.setDetailJson(detailJson);
        update.setLastSeenAt(now);
        update.setUpdatedTime(now);
        this.updateById(update);
    }

    private boolean isHealthyStatus(String value) {
        String normalized = normalize(value);
        return "ok".equals(normalized)
                || "up".equals(normalized)
                || "active".equals(normalized)
                || "running".equals(normalized)
                || "healthy".equals(normalized)
                || "normal".equals(normalized)
                || "ready".equals(normalized)
                || "enabled".equals(normalized)
                || "valid".equals(normalized)
                || "success".equals(normalized)
                || "succeeded".equals(normalized);
    }

    private boolean isTimeoutResult(String resultJson) {
        if (!notBlank(resultJson)) {
            return false;
        }
        try {
            JSONObject result = JSON.parseObject(resultJson);
            return result.getBooleanValue("timedOut") || result.getIntValue("exitCode") == 124;
        } catch (Exception ignored) {
            return false;
        }
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean notBlank(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private long safeLong(Long value) {
        return value == null ? 0L : value;
    }
}
