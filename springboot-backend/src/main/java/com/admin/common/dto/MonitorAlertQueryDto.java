package com.admin.common.dto;

import lombok.Data;

@Data
public class MonitorAlertQueryDto {

    private Long serverId;

    private String alertType;

    private String severity;

    private Integer acknowledged;

    private Integer limit;
}
