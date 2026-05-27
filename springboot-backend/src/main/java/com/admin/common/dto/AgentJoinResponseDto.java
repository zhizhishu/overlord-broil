package com.admin.common.dto;

import lombok.Data;

@Data
public class AgentJoinResponseDto {

    private Long serverId;

    private String serverName;

    private String agentToken;
}
