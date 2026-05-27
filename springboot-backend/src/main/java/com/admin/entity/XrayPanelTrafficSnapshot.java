package com.admin.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class XrayPanelTrafficSnapshot extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private Long serverId;

    private String serverName;

    private String sourceType;

    private Integer inboundId;

    private String inboundRemark;

    private String protocol;

    private String tag;

    private String email;

    private String clientId;

    private Long up;

    private Long down;

    private Long total;

    private Long expiryTime;

    private Integer enable;

    private Long syncedTime;

    private String rawJson;
}
