package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class DeployTaskStateDto {

    @NotNull(message = "task id is required")
    private Long id;

    @NotBlank(message = "state is required")
    private String state;

    private String resultJson;
}
