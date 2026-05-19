package com.admin.common.dto;

import lombok.Data;

import java.util.Map;

@Data
public class ProtocolNodeDto {

    private Long id;

    private Long serverId;

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

    private String action;

    private Map<String, Object> payload;
}
