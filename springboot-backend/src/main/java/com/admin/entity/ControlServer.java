package com.admin.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ControlServer extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private String name;

    private String role;

    private String endpoint;

    private String host;

    private String xrayRuntimeEndpoint;

    private String xrayRuntimeBasePath;

    private String xrayRuntimeApiToken;

    private String xrayRuntimeUsername;

    private String xrayRuntimePassword;

    private String xrayRuntimeTwoFactorCode;

    private Integer xrayRuntimeAllowInsecure;

    private Long xrayRuntimeLastSync;

    private Integer sshPort;

    private String sshUser;

    private String apiToken;

    private Integer allowInsecure;

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

    private Long lastHeartbeat;

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
