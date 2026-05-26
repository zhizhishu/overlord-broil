package com.admin.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class OperationAuditLog extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private String actorType;

    private String actorId;

    private String actorName;

    private String eventType;

    private String resourceType;

    private String resourceId;

    private Long serverId;

    private String serverName;

    private String providerKey;

    private String action;

    private Integer danger;

    private String outcome;

    private String summary;

    private String detailJson;
}
