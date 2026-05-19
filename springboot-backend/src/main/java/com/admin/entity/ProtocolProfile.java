package com.admin.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ProtocolProfile extends BaseEntity {

    private static final long serialVersionUID = 1L;

    private String name;

    private String protocol;

    private String versionFamily;

    private Integer listenPort;

    private String transport;

    private String remark;

    private String configJson;
}
