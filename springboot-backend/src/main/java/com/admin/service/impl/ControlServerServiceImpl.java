package com.admin.service.impl;

import cn.hutool.core.util.IdUtil;
import com.admin.common.dto.ControlServerDto;
import com.admin.common.dto.ControlServerHeartbeatDto;
import com.admin.common.dto.ControlServerUpdateDto;
import com.admin.common.lang.R;
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

    @Override
    public R createServer(ControlServerDto dto) {
        long now = System.currentTimeMillis();
        ControlServer server = new ControlServer();
        BeanUtils.copyProperties(dto, server);
        server.setApiToken(IdUtil.simpleUUID());
        server.setStatus(STATUS_ACTIVE);
        server.setCreatedTime(now);
        server.setUpdatedTime(now);

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
        return R.ok(server.getApiToken());
    }

    @Override
    public R rotateServerToken(Long id) {
        ControlServer server = this.getById(id);
        if (server == null) {
            return R.err("server not found");
        }
        server.setApiToken(IdUtil.simpleUUID());
        server.setUpdatedTime(System.currentTimeMillis());
        return this.updateById(server) ? R.ok(server.getApiToken()) : R.err("server token rotate failed");
    }

    @Override
    public R heartbeat(ControlServerHeartbeatDto dto, String token) {
        ControlServer server = this.getById(dto.getServerId());
        if (server == null || server.getApiToken() == null || !server.getApiToken().equals(token)) {
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

    private ControlServer maskToken(ControlServer server) {
        ControlServer copy = new ControlServer();
        BeanUtils.copyProperties(server, copy);
        String token = copy.getApiToken();
        if (token != null && token.length() > 8) {
            copy.setApiToken(token.substring(0, 4) + "****" + token.substring(token.length() - 4));
        }
        String xuiToken = copy.getXuiApiToken();
        if (xuiToken != null && xuiToken.length() > 8) {
            copy.setXuiApiToken(xuiToken.substring(0, 4) + "****" + xuiToken.substring(xuiToken.length() - 4));
        }
        if (copy.getXuiPassword() != null && !copy.getXuiPassword().isEmpty()) {
            copy.setXuiPassword("********");
        }
        if (copy.getXuiTwoFactorCode() != null && !copy.getXuiTwoFactorCode().isEmpty()) {
            copy.setXuiTwoFactorCode("******");
        }
        return copy;
    }
}
