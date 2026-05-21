package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.MonitorAlertAckDto;
import com.admin.common.dto.MonitorAlertQueryDto;
import com.admin.common.lang.R;
import com.admin.service.MonitorAlertService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

@RestController
@CrossOrigin
@RequestMapping("/api/v1/monitor-alert")
public class MonitorAlertController {

    @Resource
    private MonitorAlertService monitorAlertService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/list")
    public R list(@RequestBody MonitorAlertQueryDto dto) {
        return monitorAlertService.listAlerts(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/ack")
    public R acknowledge(@Validated @RequestBody MonitorAlertAckDto dto) {
        return monitorAlertService.acknowledgeAlert(dto.getId());
    }
}
