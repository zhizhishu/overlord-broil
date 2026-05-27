package com.admin.service;

import com.admin.common.dto.DeploymentPlanDto;
import com.admin.entity.ControlServer;

public interface XrayRuntimeDeploymentPlanScriptService {

    String buildScript(DeploymentPlanDto dto, ControlServer server);
}
