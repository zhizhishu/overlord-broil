package com.admin.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ServerForwardRule extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private Long serverId;

    private String serverName;

    private String name;

    private String protocol;

    private String listenHost;

    private Integer listenPort;

    private String targetHost;

    private Integer targetPort;

    private String engine;

    private String serviceName;

    private String state;

    private Long up;

    private Long down;

    private Long lastSync;

    private String lastError;
}
