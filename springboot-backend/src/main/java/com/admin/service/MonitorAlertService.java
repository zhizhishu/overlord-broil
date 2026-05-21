package com.admin.service;

import com.admin.common.dto.ControlServerHeartbeatDto;
import com.admin.common.dto.MonitorAlertQueryDto;
import com.admin.common.lang.R;
import com.admin.entity.ControlServer;
import com.admin.entity.MonitorAlert;
import com.baomidou.mybatisplus.extension.service.IService;

public interface MonitorAlertService extends IService<MonitorAlert> {

    R listAlerts(MonitorAlertQueryDto dto);

    R acknowledgeAlert(Long id);

    void handleHeartbeat(ControlServer previous, ControlServerHeartbeatDto dto, long now);

    void handleTaskFailed(Long serverId, String serverName, Long taskId, String state, String resultJson, long now);
}
