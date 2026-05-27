package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;

@Data
public class DeploymentPlanDto {

    @NotNull(message = "server id is required")
    private Long serverId;

    private Boolean installXrayRuntime = true;

    private Boolean configureRuntime = true;

    private String xrayRuntimeVersion;

    @Min(value = 1, message = "runtime port must be greater than 0")
    @Max(value = 65535, message = "runtime port must be less than 65536")
    private Integer runtimePort = 5168;

    private String runtimeUsername;

    private String runtimePassword;

    private String webBasePath;

    private String publicHost;

    private String listenIp = "0.0.0.0";

    private String certificateMode = "self-signed";

    private String certificateDomain;

    private String acmeEmail;

    private Boolean createVlessReality = true;

    private Boolean createVmessWs = true;

    private Boolean createTrojanTls = false;

    private Boolean createShadowsocks = true;

    @Min(value = 1)
    @Max(value = 65535)
    private Integer vlessPort = 443;

    @Min(value = 1)
    @Max(value = 65535)
    private Integer vmessPort = 2086;

    @Min(value = 1)
    @Max(value = 65535)
    private Integer trojanPort = 8443;

    @Min(value = 1)
    @Max(value = 65535)
    private Integer shadowsocksPort = 8388;

    private String realitySni = "www.cloudflare.com";

    private String realityDest = "www.cloudflare.com:443";

    private String wsPath = "/ws";

    private String ssMethod = "2022-blake3-aes-128-gcm";

    private Boolean installSnell = true;

    @Min(value = 1)
    @Max(value = 65535)
    private Integer snellPort = 8390;

    private String snellPsk;
}
