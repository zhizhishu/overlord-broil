package com.admin.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class MonitorAlert extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private Long serverId;

    private String serverName;

    private String alertType;

    private String severity;

    private String source;

    private String message;

    private String detailJson;

    private Long firstSeenAt;

    private Long lastSeenAt;

    private Integer acknowledged;

    private Long acknowledgedTime;
}
