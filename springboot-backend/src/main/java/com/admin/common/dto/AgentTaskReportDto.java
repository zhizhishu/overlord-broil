package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class AgentTaskReportDto {

    @NotNull(message = "task id is required")
    private Long taskId;

    @NotBlank(message = "state is required")
    private String state;

    private Integer exitCode;

    private String stdout;

    private String stderr;

    private String resultJson;
}
