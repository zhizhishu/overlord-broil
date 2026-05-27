package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class AgentJoinRequestDto {

    @NotBlank(message = "join token is required")
    private String joinToken;

    private String hostname;

    private String host;

    private String endpoint;

    private String agentVersion;

    private String osName;

    private String architecture;

    private String serviceManager;

    private Long memoryTotalMb;
}
