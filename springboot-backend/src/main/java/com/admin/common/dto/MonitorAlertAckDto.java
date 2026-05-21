package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class MonitorAlertAckDto {

    @NotNull(message = "alert id is required")
    private Long id;
}
