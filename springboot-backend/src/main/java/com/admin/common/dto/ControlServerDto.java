package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;

@Data
public class ControlServerDto {

    @NotBlank(message = "server name is required")
    private String name;

    private String role = "agent";

    private String endpoint;

    private String xuiEndpoint;

    private String xuiBasePath;

    private String xuiApiToken;

    private String xuiUsername;

    private String xuiPassword;

    private String xuiTwoFactorCode;

    private Integer xuiAllowInsecure = 0;

    @NotBlank(message = "host is required")
    private String host;

    @Min(value = 1, message = "ssh port must be greater than 0")
    @Max(value = 65535, message = "ssh port must be less than 65536")
    private Integer sshPort = 22;

    private String sshUser = "root";

    private Integer allowInsecure = 0;

    private String agentVersion;
}
