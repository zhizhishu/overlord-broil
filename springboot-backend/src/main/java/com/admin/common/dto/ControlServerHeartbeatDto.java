package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class ControlServerHeartbeatDto {

    @NotNull(message = "server id is required")
    private Long serverId;

    private String agentVersion;

    private String xrayVersion;

    private String snellVersion;

    private Double cpuUsage;

    private Double memoryUsage;

    private Long uploadTraffic;

    private Long downloadTraffic;

    private String lastError;
}
