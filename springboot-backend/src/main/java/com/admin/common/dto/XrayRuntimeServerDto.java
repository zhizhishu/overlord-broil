package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class XrayRuntimeServerDto {

    @NotNull(message = "server id is required")
    private Long serverId;
}
