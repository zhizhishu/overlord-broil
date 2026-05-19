package com.admin.service;

import com.admin.common.dto.DeployTaskDto;
import com.admin.entity.ProtocolNode;
import com.admin.entity.ProtocolProfile;

public interface SnellTemplateService {

    String buildScript(DeployTaskDto dto, ProtocolProfile profile);

    String buildNodeScript(ProtocolNode node, String action);
}
