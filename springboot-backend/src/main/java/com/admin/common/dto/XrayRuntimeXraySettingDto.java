package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class XrayRuntimeXraySettingDto {

    @NotNull(message = "server id is required")
    private Long serverId;

    @NotBlank(message = "xray setting is required")
    private String xraySetting;

    private String outboundTestUrl = "https://www.google.com/generate_204";
}
