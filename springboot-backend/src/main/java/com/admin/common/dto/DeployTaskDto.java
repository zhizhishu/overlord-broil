package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class DeployTaskDto {

    @NotNull(message = "server id is required")
    private Long serverId;

    private Long profileId;

    @NotBlank(message = "protocol is required")
    private String protocol;

    private String action = "present";

    private String versionFamily;

    private String exactVersion;

    @Min(value = 1, message = "listen port must be greater than 0")
    @Max(value = 65535, message = "listen port must be less than 65536")
    private Integer listenPort;

    private String psk;

    private String requestJson;
}
