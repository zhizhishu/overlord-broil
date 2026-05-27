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

    private String xrayRuntimeServiceStatus;

    private String xrayServiceStatus;

    private String snellServiceStatus;

    private String certificateMode;

    private String certificateDomain;

    private String certificateStatus;

    private Long certificateExpireAt;

    private Double cpuUsage;

    private Double memoryUsage;

    private Long memoryTotalMb;

    private Integer lowMemoryMode;

    private String lowMemoryProfile;

    private String lowMemoryAdvice;

    private Long uploadTraffic;

    private Long downloadTraffic;

    private String lastError;
}
