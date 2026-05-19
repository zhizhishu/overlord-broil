package com.admin.common.dto;

import lombok.Data;

@Data
public class ServerForwardRuleQueryDto {

    private Long serverId;

    private String protocol;

    private Integer limit;
}
