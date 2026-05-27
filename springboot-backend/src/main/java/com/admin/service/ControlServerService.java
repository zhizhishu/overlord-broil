package com.admin.service;

import com.admin.common.dto.ControlServerDto;
import com.admin.common.dto.ControlServerHeartbeatDto;
import com.admin.common.dto.ControlServerUpdateDto;
import com.admin.common.dto.AgentJoinRequestDto;
import com.admin.common.lang.R;
import com.admin.entity.ControlServer;
import com.baomidou.mybatisplus.extension.service.IService;

public interface ControlServerService extends IService<ControlServer> {

    R createServer(ControlServerDto dto);

    R getAllServers();

    R updateServer(ControlServerUpdateDto dto);

    R deleteServer(Long id);

    R getServerToken(Long id);

    R getServerInstallCommand(Long id, String masterUrl);

    R joinAgent(AgentJoinRequestDto dto);

    R rotateServerToken(Long id);

    R heartbeat(ControlServerHeartbeatDto dto, String token);
}
