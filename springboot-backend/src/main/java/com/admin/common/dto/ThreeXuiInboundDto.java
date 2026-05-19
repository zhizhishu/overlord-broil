package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;
import java.util.Map;

@Data
public class ThreeXuiInboundDto {

    @NotNull(message = "server id is required")
    private Long serverId;

    private Integer inboundId;

    private Boolean enable;

    private String email;

    private String clientId;

    private String settingsJson;

    private Map<String, Object> payload;
}
