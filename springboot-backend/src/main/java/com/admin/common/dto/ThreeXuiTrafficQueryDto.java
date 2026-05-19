package com.admin.common.dto;

import lombok.Data;

@Data
public class ThreeXuiTrafficQueryDto {

    private Long serverId;

    private String sourceType;

    private Integer limit;
}
