package com.admin.service.impl;

import cn.hutool.core.util.IdUtil;
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
        preserveMaskedXuiSecrets(dto, exists, server);
        server.setUpdatedTime(System.currentTimeMillis());
        encryptSecrets(server);

        return this.updateById(server) ? R.ok("server updated") : R.err("server update failed");
    }

    private void preserveMaskedXuiSecrets(ControlServerUpdateDto dto, ControlServer exists, ControlServer server) {
        if (dto.getXuiApiToken() != null && dto.getXuiApiToken().contains("****")) {
            server.setXuiApiToken(exists.getXuiApiToken());
        }
        if ("********".equals(dto.getXuiPassword())) {
            server.setXuiPassword(exists.getXuiPassword());
        }
        if ("******".equals(dto.getXuiTwoFactorCode())) {
            server.setXuiTwoFactorCode(exists.getXuiTwoFactorCode());
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
        return R.ok(secretCryptoUtils.decryptIfNeeded(server.getApiToken()));
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
        return this.updateById(server) ? R.ok(token) : R.err("server token rotate failed");
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
        update.setXuiServiceStatus(dto.getXuiServiceStatus());
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
        copy.setXuiApiToken(maskSecret(copy.getXuiApiToken(), "****"));
        if (copy.getXuiPassword() != null && !copy.getXuiPassword().isEmpty()) {
            copy.setXuiPassword("********");
        }
        if (copy.getXuiTwoFactorCode() != null && !copy.getXuiTwoFactorCode().isEmpty()) {
            copy.setXuiTwoFactorCode("******");
        }
        return copy;
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

    private void encryptSecrets(ControlServer server) {
        if (server == null) {
            return;
        }
        server.setApiToken(secretCryptoUtils.encryptIfNeeded(server.getApiToken()));
        server.setXuiApiToken(secretCryptoUtils.encryptIfNeeded(server.getXuiApiToken()));
        server.setXuiPassword(secretCryptoUtils.encryptIfNeeded(server.getXuiPassword()));
        server.setXuiTwoFactorCode(secretCryptoUtils.encryptIfNeeded(server.getXuiTwoFactorCode()));
    }

    private void decryptSecrets(ControlServer server) {
        if (server == null) {
            return;
        }
        server.setApiToken(secretCryptoUtils.decryptIfNeeded(server.getApiToken()));
        server.setXuiApiToken(secretCryptoUtils.decryptIfNeeded(server.getXuiApiToken()));
        server.setXuiPassword(secretCryptoUtils.decryptIfNeeded(server.getXuiPassword()));
        server.setXuiTwoFactorCode(secretCryptoUtils.decryptIfNeeded(server.getXuiTwoFactorCode()));
    }
}
