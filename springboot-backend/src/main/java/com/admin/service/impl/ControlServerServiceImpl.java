package com.admin.service.impl;

import cn.hutool.core.util.IdUtil;
import com.admin.common.dto.AgentJoinRequestDto;
import com.admin.common.dto.AgentJoinResponseDto;
import com.admin.common.dto.ControlServerDto;
import com.admin.common.dto.ControlServerHeartbeatDto;
import com.admin.common.dto.ControlServerUpdateDto;
import com.admin.common.lang.R;
import com.admin.common.utils.LowMemoryPolicyUtils;
import com.admin.common.utils.SecretCryptoUtils;
import com.admin.entity.ControlServer;
import com.admin.mapper.ControlServerMapper;
import com.admin.service.ControlServerService;
import com.admin.service.MonitorAlertService;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ControlServerServiceImpl extends ServiceImpl<ControlServerMapper, ControlServer> implements ControlServerService {

    private static final int STATUS_ACTIVE = 1;
    private static final int STATUS_ERROR = -1;
    private static final long JOIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000L;
    private static final String AGENT_BOOTSTRAP_URL = "https://raw.githubusercontent.com/zhizhishu/overlord-broil/main/scripts/install-agent-bootstrap.sh";

    @Resource
    private MonitorAlertService monitorAlertService;

    @Resource
    private SecretCryptoUtils secretCryptoUtils;

    @Override
    public R createServer(ControlServerDto dto) {
        long now = System.currentTimeMillis();
        ControlServer server = new ControlServer();
        BeanUtils.copyProperties(dto, server);
        server.setApiToken(IdUtil.simpleUUID());
        server.setStatus(STATUS_ACTIVE);
        server.setCreatedTime(now);
        server.setUpdatedTime(now);
        encryptSecrets(server);

        return this.save(server) ? R.ok(maskToken(server)) : R.err("server create failed");
    }

    @Override
    public R getAllServers() {
        List<ControlServer> servers = this.list().stream()
                .map(this::maskToken)
                .collect(Collectors.toList());
        return R.ok(servers);
    }

    @Override
    public R updateServer(ControlServerUpdateDto dto) {
        ControlServer exists = this.getById(dto.getId());
        if (exists == null) {
            return R.err("server not found");
        }

        ControlServer server = new ControlServer();
        BeanUtils.copyProperties(dto, server);
        server.setApiToken(null);
        preserveBlankXrayRuntimeFields(dto, exists, server);
        preserveMaskedXrayRuntimeSecrets(dto, exists, server);
        server.setUpdatedTime(System.currentTimeMillis());
        encryptSecrets(server);

        return this.updateById(server) ? R.ok("server updated") : R.err("server update failed");
    }

    private void preserveBlankXrayRuntimeFields(ControlServerUpdateDto dto, ControlServer exists, ControlServer server) {
        if (isBlank(dto.getXrayRuntimeEndpoint())) {
            server.setXrayRuntimeEndpoint(exists.getXrayRuntimeEndpoint());
        }
        if (isBlank(dto.getXrayRuntimeBasePath())) {
            server.setXrayRuntimeBasePath(exists.getXrayRuntimeBasePath());
        }
        if (isBlank(dto.getXrayRuntimeApiToken())) {
            server.setXrayRuntimeApiToken(exists.getXrayRuntimeApiToken());
        }
        if (isBlank(dto.getXrayRuntimeUsername())) {
            server.setXrayRuntimeUsername(exists.getXrayRuntimeUsername());
        }
        if (isBlank(dto.getXrayRuntimePassword())) {
            server.setXrayRuntimePassword(exists.getXrayRuntimePassword());
        }
        if (isBlank(dto.getXrayRuntimeTwoFactorCode())) {
            server.setXrayRuntimeTwoFactorCode(exists.getXrayRuntimeTwoFactorCode());
        }
    }

    private void preserveMaskedXrayRuntimeSecrets(ControlServerUpdateDto dto, ControlServer exists, ControlServer server) {
        if (dto.getXrayRuntimeApiToken() != null && dto.getXrayRuntimeApiToken().contains("****")) {
            server.setXrayRuntimeApiToken(exists.getXrayRuntimeApiToken());
        }
        if ("********".equals(dto.getXrayRuntimePassword())) {
            server.setXrayRuntimePassword(exists.getXrayRuntimePassword());
        }
        if ("******".equals(dto.getXrayRuntimeTwoFactorCode())) {
            server.setXrayRuntimeTwoFactorCode(exists.getXrayRuntimeTwoFactorCode());
        }
    }

    @Override
    public R deleteServer(Long id) {
        if (this.getById(id) == null) {
            return R.err("server not found");
        }
        return this.removeById(id) ? R.ok("server deleted") : R.err("server delete failed");
    }

    @Override
    public R getServerToken(Long id) {
        ControlServer server = this.getById(id);
        if (server == null) {
            return R.err("server not found");
        }
        return R.err(410, "agent token is hidden; use the one-time join command or rotate the token");
    }

    @Override
    public R getServerInstallCommand(Long id, String masterUrl) {
        ControlServer server = this.getById(id);
        if (server == null) {
            return R.err("server not found");
        }
        String normalizedMasterUrl = normalizeMasterUrl(masterUrl);
        if (normalizedMasterUrl == null || normalizedMasterUrl.trim().isEmpty()) {
            return R.err("master url is unavailable; open the console through its public 5166 address and try again");
        }
        String joinToken = IdUtil.simpleUUID() + IdUtil.simpleUUID();
        ControlServer update = new ControlServer();
        update.setId(server.getId());
        update.setJoinToken(secretCryptoUtils.encryptIfNeeded(joinToken));
        update.setJoinTokenExpiresAt(System.currentTimeMillis() + JOIN_TOKEN_TTL_MS);
        update.setJoinTokenUsedAt(null);
        update.setUpdatedTime(System.currentTimeMillis());
        if (!this.updateById(update)) {
            return R.err("join token create failed");
        }
        String command = "curl -fsSL " + shellQuote(AGENT_BOOTSTRAP_URL)
                + " | env OB_MASTER_URL=" + shellQuote(normalizedMasterUrl)
                + " OB_JOIN_TOKEN=" + shellQuote(joinToken)
                + " sh";

        return R.ok(command);
    }

    @Override
    public R joinAgent(AgentJoinRequestDto dto) {
        String token = dto.getJoinToken() == null ? "" : dto.getJoinToken().trim();
        if (token.isEmpty()) {
            return R.err(401, "invalid join token");
        }
        long now = System.currentTimeMillis();
        ControlServer server = findByJoinToken(token, now);
        if (server == null) {
            return R.err(401, "invalid or expired join token");
        }
        String agentToken = secretCryptoUtils.decryptIfNeeded(server.getApiToken());
        if (agentToken == null || agentToken.trim().isEmpty()) {
            agentToken = IdUtil.simpleUUID();
        }

        UpdateWrapper<ControlServer> consumeToken = new UpdateWrapper<>();
        consumeToken.eq("id", server.getId())
                .eq("join_token", server.getJoinToken())
                .isNull("join_token_used_at")
                .ge("join_token_expires_at", now)
                .set("api_token", secretCryptoUtils.encryptIfNeeded(agentToken))
                .set("host", firstNotBlank(dto.getHost(), dto.getHostname(), server.getHost()))
                .set("endpoint", firstNotBlank(dto.getEndpoint(), server.getEndpoint()))
                .set("agent_version", firstNotBlank(dto.getAgentVersion(), server.getAgentVersion()))
                .set("memory_total_mb", dto.getMemoryTotalMb() == null ? server.getMemoryTotalMb() : dto.getMemoryTotalMb())
                .set("join_token", null)
                .set("join_token_expires_at", null)
                .set("join_token_used_at", now)
                .set("last_error", null)
                .set("status", STATUS_ACTIVE)
                .set("updated_time", now);
        if (!this.update(consumeToken)) {
            return R.err(401, "invalid or expired join token");
        }

        AgentJoinResponseDto response = new AgentJoinResponseDto();
        response.setServerId(server.getId());
        response.setServerName(server.getName());
        response.setAgentToken(agentToken);
        return R.ok(response);
    }

    @Override
    public R rotateServerToken(Long id) {
        ControlServer server = this.getById(id);
        if (server == null) {
            return R.err("server not found");
        }
        String token = IdUtil.simpleUUID();
        server.setApiToken(secretCryptoUtils.encryptIfNeeded(token));
        server.setUpdatedTime(System.currentTimeMillis());
        return this.updateById(server) ? R.ok("server token rotated; create a new join command if the agent must be reinstalled") : R.err("server token rotate failed");
    }

    @Override
    public R heartbeat(ControlServerHeartbeatDto dto, String token) {
        ControlServer server = this.getById(dto.getServerId());
        if (server == null || server.getApiToken() == null || !secretCryptoUtils.decryptIfNeeded(server.getApiToken()).equals(token)) {
            return R.err(401, "invalid agent token");
        }

        long now = System.currentTimeMillis();
        ControlServer update = new ControlServer();
        update.setId(server.getId());
        update.setAgentVersion(dto.getAgentVersion());
        update.setXrayVersion(dto.getXrayVersion());
        update.setSnellVersion(dto.getSnellVersion());
        update.setXrayRuntimeServiceStatus(dto.getXrayRuntimeServiceStatus());
        update.setXrayServiceStatus(dto.getXrayServiceStatus());
        update.setSnellServiceStatus(dto.getSnellServiceStatus());
        update.setCertificateMode(dto.getCertificateMode());
        update.setCertificateDomain(dto.getCertificateDomain());
        update.setCertificateStatus(dto.getCertificateStatus());
        update.setCertificateExpireAt(dto.getCertificateExpireAt());
        update.setCpuUsage(dto.getCpuUsage());
        update.setMemoryUsage(dto.getMemoryUsage());
        update.setMemoryTotalMb(dto.getMemoryTotalMb());
        applyLowMemoryState(update, dto);
        update.setUploadTraffic(dto.getUploadTraffic());
        update.setDownloadTraffic(dto.getDownloadTraffic());
        update.setLastHeartbeat(now);
        update.setLastError(dto.getLastError());
        update.setStatus(dto.getLastError() == null || dto.getLastError().isEmpty() ? STATUS_ACTIVE : STATUS_ERROR);
        update.setUpdatedTime(now);

        boolean updated = this.updateById(update);
        if (updated) {
            monitorAlertService.handleHeartbeat(server, dto, now);
        }
        return updated ? R.ok("heartbeat accepted") : R.err("heartbeat update failed");
    }

    private void applyLowMemoryState(ControlServer update, ControlServerHeartbeatDto dto) {
        Long memoryTotalMb = dto.getMemoryTotalMb();
        if (memoryTotalMb == null || memoryTotalMb <= 0) {
            update.setLowMemoryMode(dto.getLowMemoryMode());
            update.setLowMemoryProfile(blankToNull(dto.getLowMemoryProfile()));
            update.setLowMemoryAdvice(blankToNull(dto.getLowMemoryAdvice()));
            return;
        }

        String profile = LowMemoryPolicyUtils.profile(memoryTotalMb);
        String advice = LowMemoryPolicyUtils.advice(memoryTotalMb);

        update.setLowMemoryMode(LowMemoryPolicyUtils.isLowMemory(memoryTotalMb) ? 1 : 0);
        update.setLowMemoryProfile(profile);
        String agentAdvice = blankToNull(dto.getLowMemoryAdvice());
        update.setLowMemoryAdvice(agentAdvice == null ? (advice == null ? "" : advice) : agentAdvice);
    }

    private String blankToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private ControlServer maskToken(ControlServer server) {
        ControlServer copy = new ControlServer();
        BeanUtils.copyProperties(server, copy);
        decryptSecrets(copy);
        copy.setApiToken(maskSecret(copy.getApiToken(), "****"));
        copy.setXrayRuntimeApiToken(maskSecret(copy.getXrayRuntimeApiToken(), "****"));
        if (copy.getXrayRuntimePassword() != null && !copy.getXrayRuntimePassword().isEmpty()) {
            copy.setXrayRuntimePassword("********");
        }
        if (copy.getXrayRuntimeTwoFactorCode() != null && !copy.getXrayRuntimeTwoFactorCode().isEmpty()) {
            copy.setXrayRuntimeTwoFactorCode("******");
        }
        copy.setJoinToken(null);
        return copy;
    }

    private ControlServer findByJoinToken(String joinToken, long now) {
        for (ControlServer server : this.list()) {
            if (server == null || server.getJoinToken() == null || server.getJoinTokenExpiresAt() == null || server.getJoinTokenUsedAt() != null) {
                continue;
            }
            if (server.getJoinTokenExpiresAt() < now) {
                continue;
            }
            String current = secretCryptoUtils.decryptIfNeeded(server.getJoinToken());
            if (joinToken.equals(current)) {
                return server;
            }
        }
        return null;
    }

    private String firstNotBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String maskSecret(String value, String fallback) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        if (value.length() <= 8) {
            return fallback;
        }
        return value.substring(0, 4) + "****" + value.substring(value.length() - 4);
    }

    private String normalizeMasterUrl(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return trimmed;
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed.replaceAll("/+$", "");
        }
        return ("http://" + trimmed).replaceAll("/+$", "");
    }

    private String shellQuote(String value) {
        if (value == null) {
            return "''";
        }
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private void encryptSecrets(ControlServer server) {
        if (server == null) {
            return;
        }
        server.setApiToken(secretCryptoUtils.encryptIfNeeded(server.getApiToken()));
        server.setXrayRuntimeApiToken(secretCryptoUtils.encryptIfNeeded(server.getXrayRuntimeApiToken()));
        server.setXrayRuntimePassword(secretCryptoUtils.encryptIfNeeded(server.getXrayRuntimePassword()));
        server.setXrayRuntimeTwoFactorCode(secretCryptoUtils.encryptIfNeeded(server.getXrayRuntimeTwoFactorCode()));
    }

    private void decryptSecrets(ControlServer server) {
        if (server == null) {
            return;
        }
        server.setApiToken(secretCryptoUtils.decryptIfNeeded(server.getApiToken()));
        server.setXrayRuntimeApiToken(secretCryptoUtils.decryptIfNeeded(server.getXrayRuntimeApiToken()));
        server.setXrayRuntimePassword(secretCryptoUtils.decryptIfNeeded(server.getXrayRuntimePassword()));
        server.setXrayRuntimeTwoFactorCode(secretCryptoUtils.decryptIfNeeded(server.getXrayRuntimeTwoFactorCode()));
    }
}
