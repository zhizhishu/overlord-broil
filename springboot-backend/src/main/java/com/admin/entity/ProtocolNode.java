package com.admin.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ProtocolNode extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private Long serverId;

    private String serverName;

    private String name;

    private String protocol;

    private String engine;

    private String direction;

    private String listen;

    private Integer port;

    private String transport;

    private String security;

    private String credentialJson;

    private String configJson;

    private String remoteId;

    private String serviceName;

    private String state;

    private Long up;

    private Long down;

    private Long total;

    private Long lastSync;

    private String lastError;
}
