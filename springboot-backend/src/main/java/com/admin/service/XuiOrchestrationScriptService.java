package com.admin.service;

import com.admin.common.dto.OrchestrationPlanDto;
import com.admin.entity.ControlServer;

public interface XuiOrchestrationScriptService {

    String buildScript(OrchestrationPlanDto dto, ControlServer server);
}
