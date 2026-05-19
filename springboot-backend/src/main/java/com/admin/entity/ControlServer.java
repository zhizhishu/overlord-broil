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

    private Integer sshPort;

    private String sshUser;

    private String apiToken;

    private Integer allowInsecure;

    private String agentVersion;

    private String xrayVersion;

    private String snellVersion;

    private Long lastHeartbeat;

    private Double cpuUsage;

    private Double memoryUsage;

    private Long uploadTraffic;

    private Long downloadTraffic;

    private String lastError;
}
