package com.admin.common.dto;

import lombok.Data;

@Data
public class OperationAuditLogQueryDto {

    private String actorType;

    private String eventType;

    private String resourceType;

    private String resourceId;

    private Long serverId;

    private String providerKey;

    private String outcome;

    private Integer danger;

    private Integer limit;
}
