package com.admin.common.dto;

import lombok.Data;

@Data
public class ProtocolNodeQueryDto {

    private Long serverId;

    private String protocol;

    private String engine;

    private String direction;

    private Integer limit;
}
