package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class ProtocolProfileUpdateDto {

    @NotNull(message = "profile id is required")
    private Long id;

    @NotBlank(message = "profile name is required")
    private String name;

    @NotBlank(message = "protocol is required")
    private String protocol;

    private String versionFamily;

    @Min(value = 1, message = "listen port must be greater than 0")
    @Max(value = 65535, message = "listen port must be less than 65536")
    private Integer listenPort;

    private String transport;

    private String remark;

    private String configJson;

    private Integer status = 1;
}
