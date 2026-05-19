package com.admin.common.dto;

import lombok.Data;

@Data
public class ServerForwardRuleDto {

    private Long id;

    private Long serverId;

    private String name;

    private String protocol;

    private String listenHost;

    private Integer listenPort;

    private String targetHost;

    private Integer targetPort;

    private String action;
}
